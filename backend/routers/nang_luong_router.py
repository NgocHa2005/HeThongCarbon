from typing import Annotated

from config.database import get_db
from fastapi import APIRouter, Depends, Query
from schemas.nang_luong_schema import CorrelationHeatmapResponse, GenerationMixResponse
from services.nang_luong_service import NangLuongService
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/energy", tags=["Energy & Correlation"])

# Định nghĩa kiểu dữ liệu tiêm phụ thuộc dùng chung cho toàn bộ router
DbSession = Annotated[Session, Depends(get_db)]


@router.get(
    "/generation-mix/current",
    response_model=GenerationMixResponse,
    summary="Lấy cơ cấu nguồn điện toàn quốc hiện tại",
)
def read_current_generation_mix(db: DbSession):
    service = NangLuongService(db)
    return service.get_current_generation_mix()


@router.get(
    "/correlation-heatmap",
    response_model=CorrelationHeatmapResponse,
    summary="Tính ma trận tương quan Pearson giữa các nguồn điện và Carbon",
)
def read_correlation_heatmap(
    db: DbSession,
    days: Annotated[
        int,
        Query(
            ge=7,
            le=730,
            description="Số ngày lịch sử dùng để tính tương quan (từ 7 đến 730 ngày)",
        ),
    ] = 30,
):
    service = NangLuongService(db)
    return service.get_correlation_heatmap(days=days)
