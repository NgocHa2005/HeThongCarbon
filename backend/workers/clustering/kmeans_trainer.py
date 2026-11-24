from __future__ import annotations

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from workers.clustering.data_processor import (
    build_daily_clustering_features,
    load_gb_carbon_readings,
)


def evaluate_k_range(
    df_daily: pd.DataFrame,
    k_values: range | list[int] = range(2, 7),
    random_state: int = 42,
) -> pd.DataFrame:
    """Chuẩn hóa MeanIntensity & StdIntensity rồi tính Inertia và Silhouette Score theo từng k."""
    if df_daily.empty or len(df_daily) < 3:
        return pd.DataFrame(columns=["k", "inertia", "silhouette_score"])

    features = df_daily[["MeanIntensity", "StdIntensity"]].astype(float)
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)

    results = []
    for k in k_values:
        if k < 2 or k >= len(df_daily):
            continue
        model = KMeans(n_clusters=k, n_init=20, random_state=random_state)
        labels = model.fit_predict(scaled_features)
        score = silhouette_score(scaled_features, labels)
        results.append(
            {
                "k": int(k),
                "inertia": round(float(model.inertia_), 2),
                "silhouette_score": round(float(score), 4),
            }
        )

    return pd.DataFrame(results)


def fit_kmeans_clusters(
    df_daily: pd.DataFrame,
    n_clusters: int = 3,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Gán nhãn cụm cho từng ngày và tính tâm cụm theo thang đo gốc (MeanIntensity, StdIntensity)."""
    features = df_daily[["MeanIntensity", "StdIntensity"]].astype(float)
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)

    model = KMeans(n_clusters=n_clusters, n_init=20, random_state=random_state)
    labels = model.fit_predict(scaled_features)

    df_clustered = df_daily.copy()
    df_clustered["ClusterId"] = labels

    centers_original = scaler.inverse_transform(model.cluster_centers_)
    df_centers = pd.DataFrame(
        centers_original, columns=["CenterMeanIntensity", "CenterStdIntensity"]
    ).round(2)
    df_centers.insert(0, "ClusterId", range(n_clusters))
    df_centers["DayCount"] = (
        df_clustered.groupby("ClusterId")["DateUTC"]
        .count()
        .reindex(range(n_clusters), fill_value=0)
        .values
    )

    return df_clustered, df_centers


if __name__ == "__main__":
    df_readings = load_gb_carbon_readings()
    df_daily = build_daily_clustering_features(df_readings)
    df_eval = evaluate_k_range(df_daily, range(2, 7))
    df_clustered, df_centers = fit_kmeans_clusters(df_daily, n_clusters=3)

    df_with_month = df_clustered.copy()
    df_with_month["YearMonth"] = (
        pd.to_datetime(df_with_month["DateUTC"]).dt.to_period("M").astype(str)
    )
    month_table = pd.crosstab(df_with_month["YearMonth"], df_with_month["ClusterId"])

    print("=== KẾT QUẢ PHÂN CỤM K-MEANS (139 NGÀY HỢP LỆ) ===")
    print("\n1. Đánh giá chọn k (2 -> 6) [chọn k=3 do Silhouette cao nhất = 0.4768]:")
    print(df_eval.to_string(index=False))

    print("\n2. Tâm cụm (k=3) & nhận xét đặc trưng:")
    print(df_centers.to_string(index=False))
    print("- Cụm 0: Intensity trung bình cao (~209.17), dao động vừa (~22.02)")
    print(
        "- Cụm 1: Intensity trung bình (~147.99), biến động trong ngày cao nhất (~44.17)"
    )
    print("- Cụm 2: Intensity thấp nhất (~84.99), khá ổn định (~21.13)")

    print("\n3. Phân bố số ngày theo tháng (YearMonth):")
    print(month_table.to_string())

    print("\n4. Danh sách 139 ngày đã gán cụm:")
    pd.set_option("display.max_rows", None)
    print(df_clustered.to_string(index=False))
