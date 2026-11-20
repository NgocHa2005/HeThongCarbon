import datetime
from typing import TYPE_CHECKING

from config.database import Base
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    PrimaryKeyConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from models.dim_kmeans_cluster import DimKmeansCluster
    from models.fact_daily_cluster import FactDailyCluster


class SysClusteringRun(Base):
    __tablename__ = "SYS_CLUSTERING_RUNS"
    __table_args__ = (
        PrimaryKeyConstraint("ClusteringRunId", name="SYS_CLUSTERING_RUNS_pkey"),
    )

    ClusteringRunId: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    NumberOfClusters: Mapped[int] = mapped_column(Integer, nullable=False)
    IsActive: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    CreatedAt: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    kmeans_clusters: Mapped[list["DimKmeansCluster"]] = relationship(
        "DimKmeansCluster",
        back_populates="clustering_run",
        cascade="all, delete-orphan",
    )
    daily_clusters: Mapped[list["FactDailyCluster"]] = relationship(
        "FactDailyCluster",
        back_populates="clustering_run",
        cascade="all, delete-orphan",
    )
