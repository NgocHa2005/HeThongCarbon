import datetime
import decimal
from typing import TYPE_CHECKING

from config.database import Base
from sqlalchemy import (
    BigInteger,
    Date,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    SmallInteger,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from models.dim_kmeans_cluster import DimKmeansCluster
    from models.sys_clustering_run import SysClusteringRun


class FactDailyCluster(Base):
    __tablename__ = "FACT_DAILY_CLUSTERS"
    __table_args__ = (
        ForeignKeyConstraint(
            ["ClusteringRunId", "ClusterId"],
            ["DIM_KMEANS_CLUSTERS.ClusteringRunId", "DIM_KMEANS_CLUSTERS.ClusterId"],
            name="FK_DailyClusters_DimClusters",
        ),
        ForeignKeyConstraint(
            ["ClusteringRunId"],
            ["SYS_CLUSTERING_RUNS.ClusteringRunId"],
            ondelete="CASCADE",
            name="FK_DailyClusters_Runs",
        ),
        PrimaryKeyConstraint("DailyClusterId", name="FACT_DAILY_CLUSTERS_pkey"),
        UniqueConstraint(
            "ClusteringRunId", "DateUTC", name="UQ_DailyClusters_Run_Date"
        ),
        Index("IX_DailyClusters_DateUTC", "DateUTC"),
    )

    DailyClusterId: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    ClusteringRunId: Mapped[int] = mapped_column(BigInteger, nullable=False)
    DateUTC: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    MeanIntensity: Mapped[decimal.Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    StdIntensity: Mapped[decimal.Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    ValidIntervalCount: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    ClusterId: Mapped[int] = mapped_column(Integer, nullable=False)

    kmeans_cluster: Mapped["DimKmeansCluster"] = relationship(
        "DimKmeansCluster", back_populates="daily_clusters"
    )
    clustering_run: Mapped["SysClusteringRun"] = relationship(
        "SysClusteringRun", back_populates="daily_clusters"
    )
