from __future__ import annotations

import datetime

from models.dim_kmeans_cluster import DimKmeansCluster
from models.fact_daily_cluster import FactDailyCluster
from models.sys_clustering_run import SysClusteringRun
from sqlalchemy import select
from sqlalchemy.orm import Session


def get_active_clustering_run(db: Session) -> SysClusteringRun | None:
    """Lấy lần chạy phân cụm đang IsActive=True mới nhất."""
    stmt = (
        select(SysClusteringRun)
        .where(SysClusteringRun.IsActive.is_(True))
        .order_by(SysClusteringRun.ClusteringRunId.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def get_clusters_by_run(db: Session, clustering_run_id: int) -> list[DimKmeansCluster]:
    """Lấy danh sách các cụm và tâm cụm theo ClusteringRunId."""
    stmt = (
        select(DimKmeansCluster)
        .where(DimKmeansCluster.ClusteringRunId == clustering_run_id)
        .order_by(DimKmeansCluster.ClusterId.asc())
    )
    return list(db.scalars(stmt).all())


def get_daily_clusters(
    db: Session,
    clustering_run_id: int,
    start_date: datetime.date | None = None,
    end_date: datetime.date | None = None,
    cluster_id: int | None = None,
) -> list[FactDailyCluster]:
    """Lấy danh sách ngày đã gán cụm theo lần chạy (hỗ trợ lọc khoảng ngày và ClusterId)."""
    stmt = select(FactDailyCluster).where(
        FactDailyCluster.ClusteringRunId == clustering_run_id
    )
    if start_date is not None:
        stmt = stmt.where(FactDailyCluster.DateUTC >= start_date)
    if end_date is not None:
        stmt = stmt.where(FactDailyCluster.DateUTC <= end_date)
    if cluster_id is not None:
        stmt = stmt.where(FactDailyCluster.ClusterId == cluster_id)

    stmt = stmt.order_by(FactDailyCluster.DateUTC.asc())
    return list(db.scalars(stmt).all())


def get_clustering_overview(
    db: Session,
    start_date: datetime.date | None = None,
    end_date: datetime.date | None = None,
    cluster_id: int | None = None,
) -> dict | None:
    """Tổng hợp lần chạy đang hoạt động, danh sách cụm và danh sách ngày phân cụm."""
    active_run = get_active_clustering_run(db)
    if active_run is None:
        return None

    clusters = get_clusters_by_run(db, active_run.ClusteringRunId)
    daily_clusters = get_daily_clusters(
        db,
        clustering_run_id=active_run.ClusteringRunId,
        start_date=start_date,
        end_date=end_date,
        cluster_id=cluster_id,
    )

    return {
        "run": active_run,
        "clusters": clusters,
        "daily_clusters": daily_clusters,
        "total_days": len(daily_clusters),
    }
