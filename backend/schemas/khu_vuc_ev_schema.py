from datetime import date, datetime

from pydantic import BaseModel, Field


# khu vực
class RegionItem(BaseModel):
    region_id: int
    short_name: str
    full_name: str


# 1 dòng dữ liệu trong bảng xếp hạng mức độ phát thải Carbon của từng khu vực
class RegionRankingItem(BaseModel):
    rank: int
    region_id: int
    short_name: str
    full_name: str
    intensity: int
    intensity_index: str
    diff_from_national_perc: float = Field(
        ..., description="Độ chênh lệch % so với mức trung bình toàn quốc"
    )


# Bảng xếp hạng các khu vực trong một khung giờ.
class RegionRankingResponse(BaseModel):
    from_time: datetime
    to_time: datetime
    national_intensity: int
    rankings: list[RegionRankingItem]


# chi tiết trạng thái của 1 khu vực cụ thể (đối chiếu với mức trung bình cả nước)
class RegionStatusResponse(BaseModel):
    region_id: int
    short_name: str
    full_name: str
    from_time: datetime
    to_time: datetime
    regional_intensity: int
    intensity_index: str
    national_intensity: int
    diff_value: int
    diff_percent: float
    status_message: str


# Gợi ý xác xe điện
# 1 khung giờ nhỏ (slot) được dự báo trong ngày
class TimeSlotDetail(BaseModel):
    from_time: datetime
    to_time: datetime
    predicted_intensity: int
    predicted_class: str


# Tư vấn giờ sạc xe điện tối ưu
class EvRecommendationResponse(BaseModel):
    region_scope: str = Field(
        default="Toàn quốc (Great Britain)",
        description="Phạm vi áp dụng của gợi ý sạc",
    )
    target_date: date  # Ngày dự định sạc xe
    duration_hours: float  # Số giờ cần cắm sạc
    battery_kwh: float  # Số giờ cần cắm sạc
    optimal_start_time: datetime  # Khung giờ tối ưu (Sạch nhất - Nên sạc)
    optimal_end_time: datetime
    optimal_avg_intensity: float
    peak_start_time: datetime  # Khung giờ cao điểm (
    peak_end_time: datetime
    peak_avg_intensity: float
    co2_saved_kg: float  # Lượng khí co2(tính bằng kg) tiết kiệm được
    saving_percent: float  # Tỷ lệ phần trăm (%) phát thải giảm được
    advice_summary: str
    slots: list[TimeSlotDetail]  # Danh sách chi tiết tất cả các khung giờ dự báo
