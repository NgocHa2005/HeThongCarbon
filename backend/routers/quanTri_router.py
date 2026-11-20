from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import MetaData, Table, func, inspect, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import quoted_name
from fastapi.encoders import jsonable_encoder

from backend.config.ketNoiDb_config import lay_phien_db
from backend.config.settings import (
    CARBON_ALERT_CHANGE_PERCENT,
    CARBON_ALERT_THRESHOLD,
    CARBON_ALERT_WINDOW_HOURS,
)
from models import DuLieuKhuVuc, GenerationMix, LuotThuThap, SoLieuCarbon

router = APIRouter(prefix="/api/v1/admin", tags=["Quản trị"])
COLLECTION_INTERVAL_SECONDS = 1800
ALLOWED_INGESTION_DELAY_SECONDS = 2700
EXPECTED_REGION_IDS = tuple(range(18))
DOWNSTREAM_TABLES = (
    "DIM_KMEANS_CLUSTERS",
    "AGG_DECOMPOSITION_RESAMPLE",
    "FACT_ML_PREDICTIONS",
)


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _tao_ket_qua(job: LuotThuThap) -> dict:
    duration = None
    if job.ket_thuc_luc is not None:
        duration = round(
            (_utc(job.ket_thuc_luc) - _utc(job.bat_dau_luc)).total_seconds(),
            3,
        )
    return {
        "job_id": str(job.id),
        "started_at": job.bat_dau_luc,
        "completed_at": job.ket_thuc_luc,
        "status": job.trang_thai,
        "stage": None,
        "records_processed": job.so_ban_ghi_them + job.so_ban_ghi_cap_nhat,
        "records_inserted": job.so_ban_ghi_them,
        "records_updated": job.so_ban_ghi_cap_nhat,
        "duration_seconds": duration,
        "message": job.thong_bao_loi,
        "triggered_by": job.nguoi_kich_hoat,
    }


def _tao_giam_sat(db: Session) -> dict:
    last_success = (
        db.query(LuotThuThap)
        .filter(func.upper(LuotThuThap.trang_thai).in_(("SUCCESS", "SUCCEEDED")))
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .first()
    )
    latest_job = (
        db.query(LuotThuThap)
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .first()
    )
    last_success_at = last_success.ket_thuc_luc or last_success.bat_dau_luc if last_success else None
    minutes_since_success = None
    if last_success_at is not None:
        minutes_since_success = max(
            0,
            int((datetime.now(timezone.utc) - _utc(last_success_at)).total_seconds() // 60),
        )

    latest_status = latest_job.trang_thai.upper() if latest_job else ""
    if latest_status in ("QUEUED", "RUNNING"):
        state = "running"
        message = "GitHub Actions đang chạy một phiên thu thập."
    elif latest_status == "FAILED":
        state = "failed"
        message = "Phiên thu thập gần nhất thất bại."
    elif last_success is None:
        state = "never_succeeded"
        message = "Chưa có phiên thu thập thành công."
    elif minutes_since_success * 60 > ALLOWED_INGESTION_DELAY_SECONDS:
        state = "delayed"
        message = "Đã quá thời hạn dự kiến cho lịch thu thập 30 phút."
    else:
        state = "healthy"
        message = None

    return {
        "state": state,
        "message": message,
        "last_success_at": last_success_at,
        "minutes_since_success": minutes_since_success,
        "expected_interval_seconds": COLLECTION_INTERVAL_SECONDS,
        "allowed_delay_seconds": ALLOWED_INGESTION_DELAY_SECONDS,
        "latest_run": _tao_ket_qua(latest_job) if latest_job else None,
    }


def _doc_canh_bao_chat_luong(db: Session) -> dict:
    warnings = []
    known_region_ids = {
        region.ma_vung
        for region in db.query(DuLieuKhuVuc.ma_vung).all()
    }
    known_regions = known_region_ids.intersection(EXPECTED_REGION_IDS)
    missing_dimensions = [
        region_id for region_id in EXPECTED_REGION_IDS if region_id not in known_regions
    ]
    unexpected_regions = sorted(known_region_ids.difference(EXPECTED_REGION_IDS))
    if missing_dimensions:
        warnings.append(
            {
                "code": "missing_region_dimensions",
                "message": "Thiếu DIM_REGIONS cho một hoặc nhiều vùng mong đợi.",
                "region_ids": missing_dimensions,
            }
        )
    if unexpected_regions:
        warnings.append(
            {
                "code": "unexpected_region_dimensions",
                "message": "DIM_REGIONS có RegionId ngoài phạm vi 0–17.",
                "region_ids": unexpected_regions,
            }
        )

    national_latest = (
        db.query(SoLieuCarbon)
        .filter(SoLieuCarbon.ma_vung == 0)
        .order_by(SoLieuCarbon.thoi_gian.desc())
        .first()
    )
    missing_recent_data = []
    mix_present = False
    mix_totals_valid = None
    latest_at = national_latest.thoi_gian if national_latest else None
    if national_latest is None:
        warnings.append(
            {
                "code": "missing_national_data",
                "message": "Chưa có dữ liệu toàn quốc (RegionId = 0).",
            }
        )
    else:
        region_latest = (
            db.query(
                SoLieuCarbon.ma_vung,
                func.max(SoLieuCarbon.thoi_gian).label("latest_at"),
            )
            .group_by(SoLieuCarbon.ma_vung)
            .all()
        )
        latest_by_region = {region_id: _utc(value) for region_id, value in region_latest}
        national_time = _utc(national_latest.thoi_gian)
        stale_before = national_time.timestamp() - 2 * 60 * 60
        missing_recent_data = [
            region_id
            for region_id in range(1, 18)
            if region_id not in latest_by_region
            or latest_by_region[region_id].timestamp() < stale_before
        ]
        if missing_recent_data:
            warnings.append(
                {
                    "code": "missing_recent_region_data",
                    "message": "Một số vùng chưa có dữ liệu trong hai giờ gần nhất.",
                    "region_ids": missing_recent_data,
                }
            )

        mix = (
            db.query(GenerationMix)
            .filter(GenerationMix.reading_id == national_latest.id)
            .first()
        )
        mix_present = mix is not None
        if mix is None:
            warnings.append(
                {
                    "code": "missing_generation_mix",
                    "message": "Bản ghi toàn quốc mới nhất chưa có FACT_GENERATION_MIX.",
                }
            )
        else:
            clean = float(mix.clean_total or 0)
            fossil = float(mix.fossil_total or 0)
            imports = float(mix.imports or 0)
            mix_totals_valid = abs(clean + fossil + imports - 100) <= 3
            if not mix_totals_valid:
                warnings.append(
                    {
                        "code": "generation_mix_totals",
                        "message": "Tổng năng lượng sạch, hóa thạch và nhập khẩu lệch đáng kể so với 100%.",
                    }
                )

    table_names = {
        name.casefold(): name
        for name in inspect(db.get_bind()).get_table_names()
    }
    downstream_tables = {
        name: name.casefold() in table_names for name in DOWNSTREAM_TABLES
    }
    alerts_table_name = table_names.get("sys_carbon_alerts")
    alerts_exist = alerts_table_name is not None
    alerts = []
    if not alerts_exist:
        warnings.append(
            {
                "code": "alerts_table_unavailable",
                "message": "Chưa tìm thấy bảng SYS_CARBON_ALERTS trong schema đang kết nối.",
            }
        )
    if alerts_exist:
        alerts_table = Table(
            quoted_name(alerts_table_name, True),
            MetaData(),
            autoload_with=db.get_bind(),
        )
        alert_columns = {
            column.name.casefold(): column
            for column in alerts_table.columns
        }
        order_column = next(
            (
                alert_columns[name.casefold()]
                for name in ("CreatedAt", "AlertTime", "CreatedAtUtc", "created_at")
                if name.casefold() in alert_columns
            ),
            None,
        )
        statement = select(alerts_table)
        if order_column is not None:
            statement = statement.order_by(order_column.desc())
        rows = db.execute(statement.limit(100)).mappings().all()
        alerts = jsonable_encoder([dict(row) for row in rows])

    return {
        "checked_at": datetime.now(timezone.utc),
        "latest_national_reading_at": latest_at,
        "known_region_count": len(known_regions),
        "expected_region_ids": list(EXPECTED_REGION_IDS),
        "missing_region_dimensions": missing_dimensions,
        "unexpected_region_dimensions": unexpected_regions,
        "missing_recent_region_data": missing_recent_data,
        "latest_generation_mix_present": mix_present,
        "generation_mix_totals_valid": mix_totals_valid,
        "downstream_tables": downstream_tables,
        "alerts_table_available": alerts_exist,
        "alerts": alerts,
        "alert_rules": {
            "absolute_threshold_gco2_per_kwh": CARBON_ALERT_THRESHOLD,
            "change_percent": CARBON_ALERT_CHANGE_PERCENT,
            "window_hours": CARBON_ALERT_WINDOW_HOURS,
        },
        "warnings": warnings,
        "quality_state": "warning" if warnings else "healthy",
    }


@router.get("/status")
def lay_trang_thai(db: Session = Depends(lay_phien_db)):
    latest = (
        db.query(LuotThuThap)
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .first()
    )
    result = _tao_ket_qua(latest) if latest else {
        "job_id": None,
        "started_at": None,
        "completed_at": None,
        "status": "idle",
        "stage": None,
        "records_processed": 0,
        "records_inserted": 0,
        "records_updated": 0,
        "duration_seconds": None,
        "message": None,
        "triggered_by": None,
    }
    result["monitoring"] = _tao_giam_sat(db)
    return result


@router.get("/history")
def lay_lich_su(
    limit: int = 100,
    db: Session = Depends(lay_phien_db),
):
    jobs = (
        db.query(LuotThuThap)
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .limit(min(max(limit, 1), 500))
        .all()
    )
    return {"items": [_tao_ket_qua(job) for job in jobs]}


@router.get("/quality")
def lay_chat_luong_du_lieu(db: Session = Depends(lay_phien_db)):
    return _doc_canh_bao_chat_luong(db)
