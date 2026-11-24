from __future__ import annotations

import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ClusteringRunSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ClusteringRunId: int
    NumberOfClusters: int
    IsActive: bool
    CreatedAt: datetime.datetime


class KmeansClusterSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ClusterRecordId: int
    ClusteringRunId: int
    ClusterId: int
    ClusterName: str
    ColorHex: str
    Description: str
    CentroidMeanIntensity: Decimal
    CentroidStdIntensity: Decimal
    DayCount: int


class DailyClusterSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    DailyClusterId: int
    ClusteringRunId: int
    DateUTC: datetime.date
    MeanIntensity: Decimal
    StdIntensity: Decimal
    ValidIntervalCount: int
    ClusterId: int


class ClusteringOverviewResponse(BaseModel):
    run: ClusteringRunSchema
    clusters: list[KmeansClusterSchema]
    daily_clusters: list[DailyClusterSchema]
    total_days: int


# --- Schemas dự báo cường độ carbon ngày mai (48 mốc 30 phút - UTC) ---


class ForecastSlotSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    PredId: int
    TargetDate: datetime.date
    TargetFromTime: datetime.datetime
    TargetToTime: datetime.datetime
    TimeSlotUTC: str
    PredictedIntensity: int
    ConfidenceLower: int | None = None
    ConfidenceUpper: int | None = None
    PredictedClass: str
    ModelVersion: str


class ForecastExtremeSlotSchema(BaseModel):
    from_utc: str
    to_utc: str
    predicted_intensity: int


class ForecastLowWindowSchema(BaseModel):
    from_utc: str
    to_utc: str
    slots: int
    min_intensity: int
    avg_intensity: float


class TomorrowForecastResponse(BaseModel):
    target_date_utc: datetime.date
    region: str = "Great Britain (Region 0)"
    timezone: str = "UTC"
    interval_minutes: int = 30
    total_slots: int
    model_version: str | None = None
    lowest_slot_utc: ForecastExtremeSlotSchema | None = None
    highest_slot_utc: ForecastExtremeSlotSchema | None = None
    recommended_low_windows_utc: list[ForecastLowWindowSchema]
    slots: list[ForecastSlotSchema]
