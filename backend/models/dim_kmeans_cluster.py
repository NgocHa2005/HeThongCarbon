import decimal
from typing import TYPE_CHECKING

from config.database import Base
from sqlalchemy import (
    BigInteger,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from models.fact_daily_cluster import FactDailyCluster
    from models.sys_clustering_run import SysClusteringRun


class DimKmeansCluster(Base):
    __tablename__ = "DIM_KMEANS_CLUSTERS"
    __table_args__ = (
        ForeignKeyConstraint(
            ["ClusteringRunId"],
            ["SYS_CLUSTERING_RUNS.ClusteringRunId"],
            ondelete="CASCADE",
            name="FK_DimClusters_Runs",
        ),
        PrimaryKeyConstraint("ClusterRecordId", name="DIM_KMEANS_CLUSTERS_pkey"),
        UniqueConstraint(
            "ClusteringRunId", "ClusterId", name="UQ_DimClusters_Run_Cluster"
        ),
    )

    ClusterRecordId: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    ClusteringRunId: Mapped[int] = mapped_column(BigInteger, nullable=False)
    ClusterId: Mapped[int] = mapped_column(Integer, nullable=False)
    ClusterName: Mapped[str] = mapped_column(String(100), nullable=False)
    ColorHex: Mapped[str] = mapped_column(String(10), nullable=False)
    Description: Mapped[str] = mapped_column(Text, nullable=False)
    CentroidMeanIntensity: Mapped[decimal.Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    CentroidStdIntensity: Mapped[decimal.Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )
    DayCount: Mapped[int] = mapped_column(Integer, nullable=False)

    clustering_run: Mapped["SysClusteringRun"] = relationship(
        "SysClusteringRun", back_populates="kmeans_clusters"
    )
    daily_clusters: Mapped[list["FactDailyCluster"]] = relationship(
        "FactDailyCluster", back_populates="kmeans_cluster"
    )
