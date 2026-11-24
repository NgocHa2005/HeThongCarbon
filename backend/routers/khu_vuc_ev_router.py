from typing import Annotated

from config.database import lay_phien_db
from fastapi import APIRouter, Depends, Path, Query
from schemas.khu_vuc_ev_schema import (
    EvRecommendationResponse,
    RegionItem,
    RegionRankingResponse,
    RegionStatusResponse,
)
from services.khu_vuc_ev_service import KhuVucEvService
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api", tags=["Khu Vực Và Gợi Ý Sạc Xe"])

DbSession = Annotated[Session, Depends(lay_phien_db)]


@router.get(
    "/regions",
    response_model=list[RegionItem],
    summary="Lấy danh sách 17 khu vực địa phương",
)
def read_regions(db: DbSession):
    service = KhuVucEvService(db)
    return service.get_all_regions()


# Lưu ý: Route tĩnh /regions/ranking bắt buộc phải đặt TRƯỚC route động /regions/{region_id}/status
@router.get(
    "/regions/ranking",
    response_model=RegionRankingResponse,
    summary="Xếp hạng cường độ carbon của 14 vùng phân phối điện (DNO)",
)
def read_dno_rankings(db: DbSession):
    service = KhuVucEvService(db)
    return service.get_dno_rankings()


@router.get(
    "/regions/{region_id}/status",
    response_model=RegionStatusResponse,
    summary="Tra cứu chỉ số carbon hiện tại của 1 khu vực và so sánh với toàn quốc",
)
def read_region_status(
    region_id: Annotated[int, Path(ge=1, le=17, description="Mã khu vực từ 1 đến 17")],
    db: DbSession,
):
    service = KhuVucEvService(db)
    return service.get_region_status(region_id=region_id)


@router.get(
    "/ev/recommendation",
    response_model=EvRecommendationResponse,
    summary="Gợi ý khung giờ vàng sạc xe điện xanh từ dữ liệu dự báo",
)
def read_ev_recommendation(
    db: DbSession,
    duration_hours: Annotated[
        float,
        Query(ge=0.5, le=12.0, description="Thời lượng cần sạc (từ 0.5 đến 12 giờ)"),
    ] = 2.0,
    battery_kwh: Annotated[
        float,
        Query(ge=5.0, le=200.0, description="Dung lượng pin xe điện (kWh)"),
    ] = 60.0,
):
    service = KhuVucEvService(db)
    return service.get_ev_recommendation(
        duration_hours=duration_hours,
        battery_kwh=battery_kwh,
    )
