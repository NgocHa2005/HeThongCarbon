from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from workers.clustering.data_processor import (
    build_daily_clustering_features,
    load_gb_carbon_readings,
)

FEATURE_COLS = ["MeanIntensity", "StdIntensity"]
DEFAULT_MODEL_PATH = Path("artifacts/kmeans_carbon_model.joblib")


def evaluate_k_range(
    df_daily: pd.DataFrame,
    k_values: range | list[int] = range(2, 7),
    random_state: int = 42,
) -> pd.DataFrame:
    """Chuẩn hóa MeanIntensity & StdIntensity rồi tính Inertia và Silhouette Score theo từng k."""
    if df_daily.empty or len(df_daily) < 3:
        return pd.DataFrame(columns=["k", "inertia", "silhouette_score"])

    features = df_daily[FEATURE_COLS].astype(float)
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


def _build_centers_df(
    df_clustered: pd.DataFrame,
    scaler: StandardScaler,
    model: KMeans,
    n_clusters: int,
) -> pd.DataFrame:
    """Tính tâm cụm theo thang đo gốc và đếm số ngày theo từng ClusterId."""
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
    return df_centers


def fit_kmeans_clusters(
    df_daily: pd.DataFrame,
    n_clusters: int = 3,
    random_state: int = 42,
    save_path: Path | str | None = DEFAULT_MODEL_PATH,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """Giai đoạn huấn luyện/build model: fit scaler & KMeans mới, trả về kết quả và gói artifact."""
    features = df_daily[FEATURE_COLS].astype(float)
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)

    model = KMeans(n_clusters=n_clusters, n_init=20, random_state=random_state)
    labels = model.fit_predict(scaled_features)

    df_clustered = df_daily.copy()
    df_clustered["ClusterId"] = labels

    df_centers = _build_centers_df(df_clustered, scaler, model, n_clusters)

    artifact: dict[str, Any] = {
        "scaler": scaler,
        "model": model,
        "n_clusters": int(n_clusters),
        "feature_cols": FEATURE_COLS,
        "reference_centers": df_centers.copy(),
    }

    if save_path is not None:
        save_artifact(artifact, save_path)

    return df_clustered, df_centers, artifact


def save_artifact(
    artifact: dict[str, Any], path: Path | str = DEFAULT_MODEL_PATH
) -> Path:
    """Lưu model & scaler đã huấn luyện ra file để tái sử dụng khi không train lại."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, target)
    return target


def load_artifact(path: Path | str = DEFAULT_MODEL_PATH) -> dict[str, Any]:
    """Nạp model & scaler đã build sẵn từ đĩa."""
    target = Path(path)
    if not target.exists():
        raise FileNotFoundError(
            f"Không tìm thấy model đã build tại: {target}. Hãy chạy huấn luyện model trước."
        )
    return joblib.load(target)


def predict_kmeans_clusters(
    df_daily: pd.DataFrame,
    artifact: dict[str, Any] | None = None,
    model_path: Path | str = DEFAULT_MODEL_PATH,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Giai đoạn suy luận/gán nhãn: dùng model & scaler đã build sẵn, KHÔNG train lại."""
    if df_daily.empty:
        empty_clustered = df_daily.copy()
        empty_clustered["ClusterId"] = pd.Series(dtype=int)
        empty_centers = pd.DataFrame(
            columns=[
                "ClusterId",
                "CenterMeanIntensity",
                "CenterStdIntensity",
                "DayCount",
            ]
        )
        return empty_clustered, empty_centers

    bundle = artifact if artifact is not None else load_artifact(model_path)
    scaler: StandardScaler = bundle["scaler"]
    model: KMeans = bundle["model"]
    n_clusters: int = int(bundle.get("n_clusters", model.n_clusters))
    feature_cols: list[str] = list(bundle.get("feature_cols", FEATURE_COLS))

    features = df_daily[feature_cols].astype(float)
    scaled_features = scaler.transform(features)
    labels = model.predict(scaled_features)

    df_clustered = df_daily.copy()
    df_clustered["ClusterId"] = labels
    df_centers = _build_centers_df(df_clustered, scaler, model, n_clusters)

    return df_clustered, df_centers


if __name__ == "__main__":
    df_readings = load_gb_carbon_readings()
    df_daily = build_daily_clustering_features(df_readings)
    df_eval = evaluate_k_range(df_daily, range(2, 7))

    # Huấn luyện & lưu model mới (chỉ chạy khi cần train lại)
    df_clustered, df_centers, _ = fit_kmeans_clusters(
        df_daily, n_clusters=3, save_path=DEFAULT_MODEL_PATH
    )

    df_with_month = df_clustered.copy()
    df_with_month["YearMonth"] = (
        pd.to_datetime(df_with_month["DateUTC"]).dt.to_period("M").astype(str)
    )
    month_table = pd.crosstab(df_with_month["YearMonth"], df_with_month["ClusterId"])

    print(f"=== KẾT QUẢ PHÂN CỤM K-MEANS ({len(df_daily)} NGÀY HỢP LỆ) ===")

    print("\n1. Đánh giá chọn k (2 -> 6):")
    if not df_eval.empty:
        best_row = df_eval.loc[df_eval["silhouette_score"].idxmax()]
        print(
            f"Silhouette cao nhất tại k={int(best_row['k'])} "
            f"(score={best_row['silhouette_score']:.4f}, inertia={best_row['inertia']})"
        )
    print(df_eval.to_string(index=False))

    print("\n2. Tâm cụm (k=3) & đặc trưng theo cấu hình giao diện:")
    print(df_centers.to_string(index=False))
    for _, c_row in df_centers.iterrows():
        cid = int(c_row["ClusterId"])
        print(
            f"- Cụm {cid}: MeanIntensity={c_row['CenterMeanIntensity']:.2f}, "
            f"StdIntensity={c_row['CenterStdIntensity']:.2f}, "
            f"Số ngày={int(c_row['DayCount'])}"
        )

    print("\n3. Phân bố số ngày theo tháng (YearMonth):")
    print(month_table.to_string())

    print(f"\n4. Danh sách {len(df_clustered)} ngày đã gán cụm:")
    pd.set_option("display.max_rows", None)
    print(df_clustered.to_string(index=False))
