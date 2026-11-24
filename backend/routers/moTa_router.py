
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config.database import lay_phien_db
from services.phanTich_service import dashboard

from services.phanTich_service import dashboard, bien_dong, phan_bo, tan_suat

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