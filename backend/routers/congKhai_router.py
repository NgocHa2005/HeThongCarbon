from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from config.database import lay_phien_db
from config.settings import GLOBAL_REGION_ID
from models import DimRegion as DuLieuKhuVuc, FactCarbonReading as SoLieuCarbon

router = APIRouter(prefix="/api/v1", tags=["Dữ liệu công khai"])


def _carbon_dict(row: SoLieuCarbon) -> dict:
    mix = row.generation_mix
    return {
        "thoi_gian": row.FromTime,
        "cuong_do": (row.IntensityActual if row.IntensityActual is not None else row.IntensityForecast),
        "muc_do": row.IntensityIndex,
        "phat_thai": None,
        "tai_tao": (
            mix.WindPerc + mix.SolarPerc + mix.HydroPerc + mix.BiomassPerc
            if mix
            else None
        ),
        "khi": mix.GasPerc if mix else None,
        "hat_nhan": mix.NuclearPerc if mix else None,
        "gio": mix.WindPerc if mix else None,
        "mat_troi": mix.SolarPerc if mix else None,
    }


@router.get("/carbon/latest")
def lay_carbon_moi_nhat(db: Session = Depends(lay_phien_db)):
    row = (
        db.query(SoLieuCarbon)
        .options(joinedload(SoLieuCarbon.generation_mix))
        .filter(SoLieuCarbon.RegionId == GLOBAL_REGION_ID)
        .order_by(SoLieuCarbon.FromTime.desc())
        .first()
    )
    return {"data": _carbon_dict(row) if row else None}


@router.get("/carbon/history")
def lay_lich_su_carbon(limit: int = 48, db: Session = Depends(lay_phien_db)):
    rows = (
        db.query(SoLieuCarbon)
        .options(joinedload(SoLieuCarbon.generation_mix))
        .filter(SoLieuCarbon.RegionId == GLOBAL_REGION_ID)
        .order_by(SoLieuCarbon.FromTime.desc())
        .limit(min(max(limit, 1), 500))
        .all()
    )
    return {"items": [_carbon_dict(row) for row in reversed(rows)]}


@router.get("/regions")
def lay_du_lieu_khu_vuc(db: Session = Depends(lay_phien_db)):
    latest = (
        db.query(
            SoLieuCarbon.RegionId.label("RegionId"),
            func.max(SoLieuCarbon.FromTime).label("FromTime"),
        )
        .filter(SoLieuCarbon.RegionId != GLOBAL_REGION_ID)
        .group_by(SoLieuCarbon.RegionId)
        .subquery()
    )
    rows = (
        db.query(SoLieuCarbon, DuLieuKhuVuc)
        .join(DuLieuKhuVuc, SoLieuCarbon.RegionId == DuLieuKhuVuc.RegionId)
        .join(
            latest,
            (SoLieuCarbon.RegionId == latest.c.RegionId)
            & (SoLieuCarbon.FromTime == latest.c.FromTime),
        )
        .order_by(SoLieuCarbon.RegionId)
        .all()
    )
    return {
        "items": [
            {
                "ma_vung": region.RegionId,
                "ten_vung": region.ShortName,
                "thoi_gian": reading.FromTime,
                "cuong_do": (reading.IntensityActual if reading.IntensityActual is not None else reading.IntensityForecast),
                "muc_do": reading.IntensityIndex,
            }
            for reading, region in rows
        ]
    }


@router.get("/analysis/forecast")
def lay_du_bao_co_so(db: Session = Depends(lay_phien_db)):
    latest_rows = (
        db.query(SoLieuCarbon)
        .filter(SoLieuCarbon.RegionId == GLOBAL_REGION_ID)
        .order_by(SoLieuCarbon.FromTime.desc())
        .limit(48)
        .all()
    )
    if not latest_rows:
        raise HTTPException(status_code=404, detail="Chưa có dữ liệu để lập dự báo.")
    baseline = sum((row.IntensityActual if row.IntensityActual is not None else row.IntensityForecast) for row in latest_rows) / len(latest_rows)
    latest = latest_rows[0]
    return {
        "method": "baseline_average",
        "description": "Giá trị dự báo là trung bình của tối đa 48 bản ghi gần nhất.",
        "forecast": [
            {"thoi_gian": latest.FromTime, "cuong_do_du_bao": round(baseline, 2)}
        ],
    }
