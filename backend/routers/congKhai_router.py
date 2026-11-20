from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from backend.config.ketNoiDb_config import lay_phien_db
from backend.config.settings import GLOBAL_REGION_ID
from models import DuLieuKhuVuc, SoLieuCarbon

router = APIRouter(prefix="/api/v1", tags=["Dữ liệu công khai"])


def _carbon_dict(row: SoLieuCarbon) -> dict:
    mix = row.generation_mix
    return {
        "thoi_gian": row.thoi_gian,
        "cuong_do": row.cuong_do,
        "muc_do": row.muc_do,
        "phat_thai": None,
        "tai_tao": (
            mix.wind + mix.solar + mix.hydro + mix.biomass
            if mix
            else None
        ),
        "khi": mix.gas if mix else None,
        "hat_nhan": mix.nuclear if mix else None,
        "gio": mix.wind if mix else None,
        "mat_troi": mix.solar if mix else None,
    }


@router.get("/carbon/latest")
def lay_carbon_moi_nhat(db: Session = Depends(lay_phien_db)):
    row = (
        db.query(SoLieuCarbon)
        .options(joinedload(SoLieuCarbon.generation_mix))
        .filter(SoLieuCarbon.ma_vung == GLOBAL_REGION_ID)
        .order_by(SoLieuCarbon.thoi_gian.desc())
        .first()
    )
    return {"data": _carbon_dict(row) if row else None}


@router.get("/carbon/history")
def lay_lich_su_carbon(limit: int = 48, db: Session = Depends(lay_phien_db)):
    rows = (
        db.query(SoLieuCarbon)
        .options(joinedload(SoLieuCarbon.generation_mix))
        .filter(SoLieuCarbon.ma_vung == GLOBAL_REGION_ID)
        .order_by(SoLieuCarbon.thoi_gian.desc())
        .limit(min(max(limit, 1), 500))
        .all()
    )
    return {"items": [_carbon_dict(row) for row in reversed(rows)]}


@router.get("/regions")
def lay_du_lieu_khu_vuc(db: Session = Depends(lay_phien_db)):
    latest = (
        db.query(
            SoLieuCarbon.ma_vung.label("ma_vung"),
            func.max(SoLieuCarbon.thoi_gian).label("thoi_gian"),
        )
        .filter(SoLieuCarbon.ma_vung != GLOBAL_REGION_ID)
        .group_by(SoLieuCarbon.ma_vung)
        .subquery()
    )
    rows = (
        db.query(SoLieuCarbon, DuLieuKhuVuc)
        .join(DuLieuKhuVuc, SoLieuCarbon.ma_vung == DuLieuKhuVuc.ma_vung)
        .join(
            latest,
            (SoLieuCarbon.ma_vung == latest.c.ma_vung)
            & (SoLieuCarbon.thoi_gian == latest.c.thoi_gian),
        )
        .order_by(SoLieuCarbon.ma_vung)
        .all()
    )
    return {
        "items": [
            {
                "ma_vung": region.ma_vung,
                "ten_vung": region.ten_vung,
                "thoi_gian": reading.thoi_gian,
                "cuong_do": reading.cuong_do,
                "muc_do": reading.muc_do,
            }
            for reading, region in rows
        ]
    }


@router.get("/analysis/forecast")
def lay_du_bao_co_so(db: Session = Depends(lay_phien_db)):
    latest_rows = (
        db.query(SoLieuCarbon)
        .filter(SoLieuCarbon.ma_vung == GLOBAL_REGION_ID)
        .order_by(SoLieuCarbon.thoi_gian.desc())
        .limit(48)
        .all()
    )
    if not latest_rows:
        raise HTTPException(status_code=404, detail="Chưa có dữ liệu để lập dự báo.")
    baseline = sum(row.cuong_do for row in latest_rows) / len(latest_rows)
    latest = latest_rows[0]
    return {
        "method": "baseline_average",
        "description": "Giá trị dự báo là trung bình của tối đa 48 bản ghi gần nhất.",
        "forecast": [
            {"thoi_gian": latest.thoi_gian, "cuong_do_du_bao": round(baseline, 2)}
        ],
    }
