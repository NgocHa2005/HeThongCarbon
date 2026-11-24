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
