from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Any

import pandas as pd
from config.database import SessionLocal
from models.dim_kmeans_cluster import DimKmeansCluster
from models.fact_daily_cluster import FactDailyCluster
from models.sys_clustering_run import SysClusteringRun
from sqlalchemy import select, update
from sqlalchemy.orm import Session

DEFAULT_CLUSTER_PROFILES: dict[int, dict[str, str]] = {
    0: {
        "name": "Cường độ cao - Dao động vừa",
        "color": "#EF4444",
        "desc": "Nhóm ngày có cường độ carbon trung bình cao và mức biến động trong ngày ở mức vừa phải.",
    },
    1: {
        "name": "Cường độ trung bình - Biến động cao",
        "color": "#F59E0B",
        "desc": "Nhóm ngày có cường độ carbon mức trung bình nhưng biên độ dao động trong ngày lớn nhất.",
    },
    2: {
        "name": "Cường độ thấp - Ổn định",
        "color": "#10B981",
        "desc": "Nhóm ngày có cường độ carbon thấp nhất và tương đối ổn định, thuận lợi cho tải linh hoạt.",
    },
}


def _to_decimal_2(value: float | Decimal) -> Decimal:
    return Decimal(f"{float(value):.2f}")


def _to_date(value: Any) -> datetime.date:
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    return pd.to_datetime(value).date()


def _get_cluster_meta(cluster_id: int) -> dict[str, str]:
    if cluster_id in DEFAULT_CLUSTER_PROFILES:
        return DEFAULT_CLUSTER_PROFILES[cluster_id]
    return {
        "name": f"Cụm {cluster_id}",
        "color": "#3B82F6",
        "desc": f"Cụm phân cụm K-Means số {cluster_id}.",
    }


def create_clustering_run(
    session: Session,
    number_of_clusters: int,
    is_active: bool = True,
    deactivate_previous: bool = True,
) -> int:
    """Tạo bản ghi lần chạy mới trong SYS_CLUSTERING_RUNS và trả về ClusteringRunId."""
    if is_active and deactivate_previous:
        session.execute(
            update(SysClusteringRun)
            .where(SysClusteringRun.IsActive.is_(True))
            .values(IsActive=False)
        )

    run_record = SysClusteringRun(
        NumberOfClusters=int(number_of_clusters),
        IsActive=bool(is_active),
    )
    session.add(run_record)
    session.flush()
    return int(run_record.ClusteringRunId)


def save_kmeans_clusters(
    session: Session,
    clustering_run_id: int,
    df_centers: pd.DataFrame,
) -> int:
    """Lưu thông tin tâm cụm và đặc trưng từng cụm vào DIM_KMEANS_CLUSTERS."""
    if df_centers.empty:
        return 0

    cluster_objects: list[DimKmeansCluster] = []
    for _, row in df_centers.iterrows():
        cluster_id = int(row["ClusterId"])
        meta = _get_cluster_meta(cluster_id)

        cluster_objects.append(
            DimKmeansCluster(
                ClusteringRunId=clustering_run_id,
                ClusterId=cluster_id,
                ClusterName=meta["name"][:100],
                ColorHex=meta["color"][:10],
                Description=meta["desc"],
                CentroidMeanIntensity=_to_decimal_2(row["CenterMeanIntensity"]),
                CentroidStdIntensity=_to_decimal_2(row["CenterStdIntensity"]),
                DayCount=int(row["DayCount"]),
            )
        )

    session.add_all(cluster_objects)
    session.flush()
    return len(cluster_objects)


def save_daily_clusters(
    session: Session,
    clustering_run_id: int,
    df_clustered: pd.DataFrame,
) -> int:
    """Lưu nhãn cụm của từng ngày hợp lệ vào FACT_DAILY_CLUSTERS."""
    if df_clustered.empty:
        return 0

    daily_objects: list[FactDailyCluster] = []
    for _, row in df_clustered.iterrows():
        daily_objects.append(
            FactDailyCluster(
                ClusteringRunId=clustering_run_id,
                DateUTC=_to_date(row["DateUTC"]),
                MeanIntensity=_to_decimal_2(row["MeanIntensity"]),
                StdIntensity=_to_decimal_2(row["StdIntensity"]),
                ValidIntervalCount=int(row["ValidIntervalCount"]),
                ClusterId=int(row["ClusterId"]),
            )
        )

    session.add_all(daily_objects)
    return len(daily_objects)


def persist_clustering_result(
    df_clustered: pd.DataFrame,
    df_centers: pd.DataFrame,
    n_clusters: int = 3,
    is_active: bool = True,
    deactivate_previous: bool = True,
    db: Session | None = None,
) -> dict[str, Any]:
    """Lưu trọn gói 1 lần chạy phân cụm vào SYS_CLUSTERING_RUNS, DIM_KMEANS_CLUSTERS, FACT_DAILY_CLUSTERS."""
    owns_session = db is None
    session = SessionLocal() if owns_session else db

    try:
        run_id = create_clustering_run(
            session=session,
            number_of_clusters=n_clusters,
            is_active=is_active,
            deactivate_previous=deactivate_previous,
        )
        saved_clusters = save_kmeans_clusters(
            session=session,
            clustering_run_id=run_id,
            df_centers=df_centers,
        )
        saved_days = save_daily_clusters(
            session=session,
            clustering_run_id=run_id,
            df_clustered=df_clustered,
        )

        if owns_session:
            session.commit()

        return {
            "clustering_run_id": run_id,
            "clusters_saved": saved_clusters,
            "daily_rows_saved": saved_days,
        }
    except Exception:
        if owns_session:
            session.rollback()
        raise
    finally:
        if owns_session:
            session.close()


def get_latest_active_run_id(session: Session) -> int | None:
    """Lấy ClusteringRunId của lần chạy đang IsActive=True mới nhất."""
    stmt = (
        select(SysClusteringRun.ClusteringRunId)
        .where(SysClusteringRun.IsActive.is_(True))
        .order_by(SysClusteringRun.ClusteringRunId.desc())
        .limit(1)
    )
    return session.scalar(stmt)


def run_clustering_pipeline(
    retrain: bool = False,
    n_clusters: int = 3,
    is_active: bool = True,
    deactivate_previous: bool = True,
) -> dict[str, Any]:
    """Chạy luồng phân cụm từ dữ liệu DB hiện tại: mặc định dùng model có sẵn (retrain=False)."""
    from workers.clustering.data_processor import (
        build_daily_clustering_features,
        load_gb_carbon_readings,
    )
    from workers.clustering.kmeans_trainer import (
        fit_kmeans_clusters,
        predict_kmeans_clusters,
    )

    df_readings = load_gb_carbon_readings()
    df_daily = build_daily_clustering_features(df_readings)

    if retrain:
        df_clustered, df_centers, _ = fit_kmeans_clusters(
            df_daily, n_clusters=n_clusters
        )
    else:
        df_clustered, df_centers = predict_kmeans_clusters(df_daily)

    return persist_clustering_result(
        df_clustered=df_clustered,
        df_centers=df_centers,
        n_clusters=n_clusters,
        is_active=is_active,
        deactivate_previous=deactivate_previous,
    )


if __name__ == "__main__":
    result = run_clustering_pipeline(retrain=False, n_clusters=3)
    print("Đã lưu phân cụm vào DB thành công:", result)
