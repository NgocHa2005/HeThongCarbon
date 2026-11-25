from __future__ import annotations

import pandas as pd
from config.database import SessionLocal
from models.fact_carbon_reading import FactCarbonReading
from sqlalchemy import select
from sqlalchemy.orm import Session


def load_gb_carbon_readings(db: Session | None = None) -> pd.DataFrame:
    """Đọc dữ liệu cường độ carbon thực tế của toàn GB (RegionId = 0) theo từng khoảng 30 phút."""
    owns_session = db is None
    session = SessionLocal() if owns_session else db

    try:
        stmt = (
            select(
                FactCarbonReading.ReadingId,
                FactCarbonReading.FromTime,
                FactCarbonReading.ToTime,
                FactCarbonReading.IntensityActual,
            )
            .where(
                FactCarbonReading.RegionId == 0,
                FactCarbonReading.IntensityActual.isnot(None),
            )
            .order_by(FactCarbonReading.FromTime.asc())
        )
        rows = session.execute(stmt).all()
    finally:
        if owns_session:
            session.close()

    columns = ["ReadingId", "FromTime", "ToTime", "IntensityActual"]
    if not rows:
        return pd.DataFrame(columns=columns)

    df = pd.DataFrame(rows, columns=columns)
    df["FromTime"] = pd.to_datetime(df["FromTime"], utc=True)
    df["ToTime"] = pd.to_datetime(df["ToTime"], utc=True)
    return df


def build_daily_clustering_features(df_readings: pd.DataFrame) -> pd.DataFrame:
    """Tổng hợp dữ liệu 30 phút thành đặc trưng từng ngày UTC hợp lệ (đủ 48 khoảng liên tục)."""
    output_cols = ["DateUTC", "MeanIntensity", "StdIntensity", "ValidIntervalCount"]
    if df_readings.empty:
        return pd.DataFrame(columns=output_cols)

    df = df_readings.copy()
    df["FromTime"] = pd.to_datetime(df["FromTime"], utc=True)
    df["ToTime"] = pd.to_datetime(df["ToTime"], utc=True)
    df["IntensityActual"] = pd.to_numeric(df["IntensityActual"], errors="coerce")
    df = df.dropna(subset=["FromTime", "ToTime", "IntensityActual"]).sort_values(
        "FromTime"
    )

    df["DateUTC"] = df["FromTime"].dt.date
    duration_ok = (df["ToTime"] - df["FromTime"]) == pd.Timedelta("30min")
    prev_from = df.groupby("DateUTC")["FromTime"].shift(1)
    step_ok_from_prev = (df["FromTime"] - prev_from) == pd.Timedelta("30min")

    df["_valid_duration"] = duration_ok
    df["_valid_step"] = step_ok_from_prev

    daily_records = []
    for date_utc, group in df.groupby("DateUTC", sort=True):
        count_rows = len(group)
        distinct_starts = group["FromTime"].nunique()
        all_30m_duration = bool(group["_valid_duration"].all())
        continuous_steps = (
            int(group["_valid_step"].iloc[1:].sum()) if count_rows > 1 else 0
        )

        if (
            count_rows == 48
            and distinct_starts == 48
            and all_30m_duration
            and continuous_steps == 47
        ):
            values = group["IntensityActual"].astype(float)
            daily_records.append(
                {
                    "DateUTC": date_utc,
                    "MeanIntensity": round(float(values.mean()), 2),
                    "StdIntensity": round(float(values.std(ddof=1)), 2),
                    "ValidIntervalCount": int(count_rows),
                }
            )

    if not daily_records:
        return pd.DataFrame(columns=output_cols)

    return pd.DataFrame(daily_records, columns=output_cols)


def summarize_daily_features(df_daily: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Thống kê tổng quan các đặc trưng ngày và phân bố số ngày hợp lệ theo tháng."""
    if df_daily.empty:
        return {
            "overview": pd.DataFrame(),
            "by_month": pd.DataFrame(
                columns=[
                    "YearMonth",
                    "ValidDays",
                    "AvgMeanIntensity",
                    "AvgStdIntensity",
                ]
            ),
        }

    df = df_daily.copy()
    df["DateUTC"] = pd.to_datetime(df["DateUTC"])
    df["YearMonth"] = df["DateUTC"].dt.to_period("M").astype(str)

    overview = (
        df[["MeanIntensity", "StdIntensity", "ValidIntervalCount"]].describe().round(2)
    )

    by_month = (
        df.groupby("YearMonth", as_index=False)
        .agg(
            ValidDays=("DateUTC", "count"),
            AvgMeanIntensity=("MeanIntensity", "mean"),
            AvgStdIntensity=("StdIntensity", "mean"),
        )
        .round(2)
    )

    return {"overview": overview, "by_month": by_month}


if __name__ == "__main__":
    df_readings = load_gb_carbon_readings()
    print("Số dòng đọc được:", len(df_readings))
    print(
        "Khoảng thời gian UTC:",
        df_readings["FromTime"].min(),
        "->",
        df_readings["FromTime"].max(),
    )

    df_daily = build_daily_clustering_features(df_readings)
    print("\nSố ngày hợp lệ (48 khoảng liên tục):", len(df_daily))
    print(df_daily.head(5))

    summary = summarize_daily_features(df_daily)
    print("\n--- Thống kê tổng quan ---")
    print(summary["overview"])
    print("\n--- Phân bố theo tháng ---")
    print(summary["by_month"])
