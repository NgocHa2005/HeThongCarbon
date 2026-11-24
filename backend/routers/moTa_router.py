from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config.database import lay_phien_db
from services.phanTich_service import (
    bien_dong,
    dashboard,
    tinh_phan_ra,
    phan_bo,
    tan_suat,
)

router = APIRouter(
    prefix="/api/v1/analysis",
    tags=["Phân tích dữ liệu"],
)


@router.get("/dashboard")
def lay_dashboard(db: Session = Depends(lay_phien_db)):
    return dashboard(db)

@router.get("/fluctuation")
def lay_bien_dong(
    kieu: str = "ngay",
    db: Session = Depends(lay_phien_db)
):
    if kieu not in ["ngay", "tuan", "thang"]:
        return {
            "loi": "Kiểu thời gian không hợp lệ. Chọn ngay, tuan hoặc thang."
        }

    return bien_dong(db, kieu)

@router.get("/scatter")
def lay_phan_bo(
    kieu: str = "ngay",
    db: Session = Depends(lay_phien_db)
):
    if kieu not in ["ngay", "tuan", "thang"]:
        return {"loi": "Chọn ngay, tuan hoặc thang."}

    return phan_bo(db, kieu)

@router.get("/histogram")
def lay_tan_suat(
    kieu: str = "ngay",
    db: Session = Depends(lay_phien_db)
):
    if kieu not in ["ngay", "tuan", "thang"]:
        return {"loi": "Chọn ngay, tuan hoặc thang."}

    return tan_suat(db, kieu)


@router.get("/decomposition")
def lay_phan_ra(
    kieu: str = Query("thang", pattern="^(thang|tuan)$"),
    db: Session = Depends(lay_phien_db),
):
    try:
        return tinh_phan_ra(db, kieu)
    except ValueError as loi:
        # thiếu dữ liệu lịch sử: trả 404 kèm lý do để giao diện hiện thông báo gọn
        raise HTTPException(status_code=404, detail=str(loi))