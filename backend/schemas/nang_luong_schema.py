from datetime import datetime
from pydantic import BaseModel, Field


class FuelMixItem(BaseModel):
    fuel_key: str = Field(..., description="Mã định danh nguồn điện (wind, gas, ...)")
    fuel_name: str = Field(..., description="Tên hiển thị tiếng Việt")
    percentage: float = Field(..., description="Tỷ trọng phần trăm (%)")
    category: str = Field(..., description="Nhóm nguồn: clean | fossil | imports")

#Cơ cấu 8 nguồn điện hiện tại
class GenerationMixResponse(BaseModel):
    from_time: datetime
    to_time: datetime
    intensity_actual: int | None
    intensity_forecast: int
    clean_total_perc: float
    fossil_total_perc: float
    imports_perc: float
    fuels: list[FuelMixItem]

#Ma trận tương quan
class CorrelationHeatmapResponse(BaseModel):
    days_analyzed: int
    total_samples: int
    labels: list[str]
    matrix_data: list[list[float | int]] = Field(
        ..., description="Danh sách tọa độ [cột_x, hàng_y, hệ_số_r] chuẩn ECharts"
    )
    strongest_negative_driver: str
    strongest_positive_driver: str
    insight_summary: str