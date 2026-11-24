from __future__ import annotations

import datetime as dt
import math
import warnings
from typing import Any

import numpy as np
import pandas as pd
from config.database import SessionLocal
from models.fact_carbon_reading import FactCarbonReading
from models.fact_ml_prediction import FactMlPrediction
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

warnings.filterwarnings("ignore", category=DeprecationWarning)

MODEL_VERSION = "ridge-timeseries-v2"


def _classify_intensity(value: int) -> tuple[str, dict[str, float]]:
    """Phân loại mức cường độ carbon (gCO2/kWh) và phân bố xác suất cho JSONB."""
    if value < 100:
        label = "low"
    elif value < 200:
        label = "moderate"
    elif value < 300:
        label = "high"
    else:
        label = "very high"

    centers = {"low": 70.0, "moderate": 150.0, "high": 250.0, "very high": 350.0}
    raw_weights = {
        k: math.exp(-(((float(value) - c) / 65.0) ** 2)) for k, c in centers.items()
    }
    total = sum(raw_weights.values()) or 1.0
    probs = {k: round(v / total, 4) for k, v in raw_weights.items()}
    return label, probs


def load_actual_series_utc(db: Session, region_id: int = 0) -> pd.DataFrame:
    """Đọc chuỗi IntensityActual hợp lệ theo UTC (mỗi mốc 30 phút) cho vùng chỉ định."""
    stmt = (
        select(
            FactCarbonReading.FromTime,
            FactCarbonReading.ToTime,
            FactCarbonReading.IntensityActual,
        )
        .where(
            FactCarbonReading.RegionId == region_id,
            FactCarbonReading.IntensityActual.isnot(None),
        )
        .order_by(FactCarbonReading.FromTime.asc())
    )
    rows = db.execute(stmt).all()
    if not rows:
        return pd.DataFrame(columns=["FromTime", "ToTime", "IntensityActual"])

    df = pd.DataFrame(rows, columns=["FromTime", "ToTime", "IntensityActual"])
    df["FromTime"] = pd.to_datetime(df["FromTime"], utc=True)
    df["ToTime"] = pd.to_datetime(df["ToTime"], utc=True)
    df["IntensityActual"] = pd.to_numeric(df["IntensityActual"], errors="coerce")
    df = df.dropna(subset=["FromTime", "ToTime", "IntensityActual"]).sort_values(
        "FromTime"
    )
    df = df.drop_duplicates(subset=["FromTime"], keep="last").reset_index(drop=True)
    return df


def _slot_index_from_ts(ts_utc: pd.Timestamp) -> int:
    return (int(ts_utc.hour) * 2) + (1 if int(ts_utc.minute) >= 30 else 0)


def _build_feature_row(
    ts_utc: pd.Timestamp,
    history_map: dict[pd.Timestamp, float],
    recent_values: list[float],
) -> list[float]:
    """Tạo đặc trưng theo chu kỳ 30 phút (UTC), thứ trong tuần, độ trễ và trung bình trượt."""
    slot_of_day = _slot_index_from_ts(ts_utc)
    dow = int(ts_utc.dayofweek)

    angle_slot = 2.0 * math.pi * (slot_of_day / 48.0)
    angle_dow = 2.0 * math.pi * (dow / 7.0)

    fallback_level = float(np.mean(recent_values[-48:])) if recent_values else 150.0
    lag_1d = history_map.get(ts_utc - dt.timedelta(days=1))
    lag_2d = history_map.get(ts_utc - dt.timedelta(days=2))
    lag_7d = history_map.get(ts_utc - dt.timedelta(days=7))

    v_1d = float(lag_1d) if lag_1d is not None else fallback_level
    v_2d = float(lag_2d) if lag_2d is not None else v_1d
    v_7d = float(lag_7d) if lag_7d is not None else v_1d

    roll_24h = float(np.mean(recent_values[-48:])) if len(recent_values) >= 1 else 150.0
    roll_7d = (
        float(np.mean(recent_values[-336:])) if len(recent_values) >= 1 else roll_24h
    )

    return [
        math.sin(angle_slot),
        math.cos(angle_slot),
        math.sin(angle_dow),
        math.cos(angle_dow),
        v_1d,
        v_2d,
        v_7d,
        roll_24h,
        roll_7d,
    ]


def _fit_ridge_model(
    X_rows: list[list[float]], y_rows: list[float]
) -> tuple[Any | None, float]:
    if len(X_rows) < 10:
        fallback_std = float(np.std(y_rows)) if len(y_rows) > 1 else 25.0
        return None, max(8.0, fallback_std)

    from sklearn.linear_model import Ridge

    X_arr = np.asarray(X_rows, dtype=float)
    y_arr = np.asarray(y_rows, dtype=float)
    model = Ridge(alpha=10.0)
    model.fit(X_arr, y_arr)
    preds = model.predict(X_arr)
    err_std = float(np.std(y_arr - preds))
    return model, max(8.0, err_std)


def _find_lowest_windows(predictions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gom các mốc 30 phút liên tiếp nằm trong nhóm dự báo thấp nhất thành khoảng giờ."""
    if not predictions:
        return []

    values = [p["PredictedIntensity"] for p in predictions]
    min_val = min(values)
    # Lấy các mốc trong khoảng từ min_val đến min_val + 12 gCO2/kWh (hoặc tối thiểu phân vị 20%)
    q20 = float(np.percentile(values, 20))
    threshold = max(min_val + 10, int(round(q20)))

    low_indices = [i for i, v in enumerate(values) if v <= threshold]
    if not low_indices:
        best_idx = values.index(min_val)
        low_indices = [best_idx]

    windows: list[dict[str, Any]] = []
    start_i = low_indices[0]
    prev_i = low_indices[0]

    for idx in low_indices[1:]:
        if idx == prev_i + 1:
            prev_i = idx
        else:
            seg = predictions[start_i : prev_i + 1]
            windows.append(
                {
                    "from_utc": seg[0]["TargetFromTime"].strftime("%H:%M"),
                    "to_utc": seg[-1]["TargetToTime"].strftime("%H:%M"),
                    "slots": len(seg),
                    "min_intensity": min(x["PredictedIntensity"] for x in seg),
                    "avg_intensity": round(
                        sum(x["PredictedIntensity"] for x in seg) / len(seg), 1
                    ),
                }
            )
            start_i = idx
            prev_i = idx

    seg = predictions[start_i : prev_i + 1]
    windows.append(
        {
            "from_utc": seg[0]["TargetFromTime"].strftime("%H:%M"),
            "to_utc": seg[-1]["TargetToTime"].strftime("%H:%M"),
            "slots": len(seg),
            "min_intensity": min(x["PredictedIntensity"] for x in seg),
            "avg_intensity": round(
                sum(x["PredictedIntensity"] for x in seg) / len(seg), 1
            ),
        }
    )

    # Sắp xếp khoảng có trung bình thấp nhất lên trước
    windows.sort(key=lambda w: (w["avg_intensity"], w["min_intensity"]))
    return windows


def predict_tomorrow_48_slots(
    df_history: pd.DataFrame,
    target_date_utc: dt.date | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Huấn luyện mô hình từ dữ liệu lịch sử UTC, đánh giá lỗi test và dự báo 48 mốc ngày mai."""
    now_utc = dt.datetime.now(dt.UTC)
    if target_date_utc is None:
        target_date_utc = (now_utc + dt.timedelta(days=1)).date()

    day_start_utc = pd.Timestamp(
        year=target_date_utc.year,
        month=target_date_utc.month,
        day=target_date_utc.day,
        hour=0,
        minute=0,
        second=0,
        tz="UTC",
    )

    metrics: dict[str, Any] = {
        "history_rows": len(df_history),
        "history_from_utc": (
            df_history["FromTime"].min().isoformat() if not df_history.empty else None
        ),
        "history_to_utc": (
            df_history["FromTime"].max().isoformat() if not df_history.empty else None
        ),
        "test_mae_gco2_kwh": None,
        "test_samples": 0,
    }

    if df_history.empty:
        slot_means = {s: 150.0 for s in range(48)}
        residual_std = 25.0
        model = None
    else:
        df = df_history.copy()
        df["SlotOfDay"] = df["FromTime"].apply(_slot_index_from_ts)
        overall_mean = float(df["IntensityActual"].mean())
        slot_means = {
            int(s): float(v)
            for s, v in df.groupby("SlotOfDay")["IntensityActual"].mean().items()
        }
        for s in range(48):
            slot_means.setdefault(s, overall_mean)

        history_map: dict[pd.Timestamp, float] = {
            row["FromTime"]: float(row["IntensityActual"]) for _, row in df.iterrows()
        }
        all_vals = df["IntensityActual"].astype(float).tolist()

        X_rows: list[list[float]] = []
        y_rows: list[float] = []
        for idx, row in df.iterrows():
            ts = row["FromTime"]
            y_val = float(row["IntensityActual"])
            prefix_vals = all_vals[max(0, idx - 336) : idx]
            X_rows.append(_build_feature_row(ts, history_map, prefix_vals))
            y_rows.append(y_val)

        # Đánh giá MAE trên 48 mốc cuối (nếu có ít nhất 96 mốc)
        if len(X_rows) >= 96:
            split_idx = len(X_rows) - 48
            eval_model, _ = _fit_ridge_model(X_rows[:split_idx], y_rows[:split_idx])
            if eval_model is not None:
                eval_preds = eval_model.predict(
                    np.asarray(X_rows[split_idx:], dtype=float)
                )
                mae_val = float(
                    np.mean(np.abs(np.asarray(y_rows[split_idx:]) - eval_preds))
                )
                metrics["test_mae_gco2_kwh"] = round(mae_val, 2)
                metrics["test_samples"] = 48

        model, residual_std = _fit_ridge_model(X_rows, y_rows)

    predictions: list[dict[str, Any]] = []
    working_map: dict[pd.Timestamp, float] = (
        {
            row["FromTime"]: float(row["IntensityActual"])
            for _, row in df_history.iterrows()
        }
        if not df_history.empty
        else {}
    )
    working_vals: list[float] = (
        df_history["IntensityActual"].astype(float).tolist()[-336:]
        if not df_history.empty
        else []
    )

    margin = max(8, int(round(1.28 * residual_std)))

    for slot_idx in range(48):
        from_ts = day_start_utc + dt.timedelta(minutes=30 * slot_idx)
        to_ts = from_ts + dt.timedelta(minutes=30)
        slot_baseline = slot_means.get(slot_idx, 150.0)

        if model is not None:
            feat = np.asarray(
                [_build_feature_row(from_ts, working_map, working_vals)],
                dtype=float,
            )
            ml_pred = float(model.predict(feat)[0])
            blended = 0.65 * ml_pred + 0.35 * slot_baseline
        else:
            blended = slot_baseline

        pred_int = max(0, int(round(blended)))
        lower_int = max(0, pred_int - margin)
        upper_int = pred_int + margin
        pred_class, class_probs = _classify_intensity(pred_int)

        predictions.append(
            {
                "TargetDate": target_date_utc,
                "TargetFromTime": from_ts.to_pydatetime(),
                "TargetToTime": to_ts.to_pydatetime(),
                "PredictedIntensity": pred_int,
                "ConfidenceLower": lower_int,
                "ConfidenceUpper": upper_int,
                "PredictedClass": pred_class,
                "ClassProbabilities": class_probs,
                "ModelVersion": MODEL_VERSION,
            }
        )

        working_map[from_ts] = float(pred_int)
        working_vals.append(float(pred_int))

    return predictions, metrics


def save_predictions_to_db(
    db: Session,
    target_date_utc: dt.date,
    predictions: list[dict[str, Any]],
) -> int:
    """Ghi đè dữ liệu dự báo của target_date_utc trong FACT_ML_PREDICTIONS."""
    db.execute(
        delete(FactMlPrediction).where(FactMlPrediction.TargetDate == target_date_utc)
    )
    records = [FactMlPrediction(**item) for item in predictions]
    db.add_all(records)
    db.commit()
    return len(records)


def run_tomorrow_forecast_pipeline(
    target_date_utc: dt.date | None = None,
    region_id: int = 0,
    db: Session | None = None,
) -> dict[str, Any]:
    """Chạy luồng dự báo 48 mốc ngày mai theo UTC và trả về báo cáo rõ ràng."""
    owns_session = db is None
    session = SessionLocal() if owns_session else db
    try:
        now_utc = dt.datetime.now(dt.UTC)
        resolved_date = (
            target_date_utc
            if target_date_utc is not None
            else (now_utc + dt.timedelta(days=1)).date()
        )
        df_history = load_actual_series_utc(session, region_id=region_id)
        preds, metrics = predict_tomorrow_48_slots(
            df_history, target_date_utc=resolved_date
        )
        saved_count = save_predictions_to_db(session, resolved_date, preds)

        min_item = min(preds, key=lambda x: x["PredictedIntensity"])
        max_item = max(preds, key=lambda x: x["PredictedIntensity"])
        low_windows = _find_lowest_windows(preds)

        return {
            "target_date_utc": str(resolved_date),
            "model_version": MODEL_VERSION,
            "saved_slots": saved_count,
            "evaluation": metrics,
            "lowest_slot_utc": {
                "from": min_item["TargetFromTime"].strftime("%H:%M"),
                "to": min_item["TargetToTime"].strftime("%H:%M"),
                "predicted_intensity": min_item["PredictedIntensity"],
            },
            "highest_slot_utc": {
                "from": max_item["TargetFromTime"].strftime("%H:%M"),
                "to": max_item["TargetToTime"].strftime("%H:%M"),
                "predicted_intensity": max_item["PredictedIntensity"],
            },
            "recommended_low_windows_utc": low_windows,
        }
    finally:
        if owns_session:
            session.close()


if __name__ == "__main__":
    res = run_tomorrow_forecast_pipeline()
    ev = res["evaluation"]
    low = res["lowest_slot_utc"]
    high = res["highest_slot_utc"]

    line = "─" * 56
    print(f"\n{line}")
    print("  DỰ BÁO CƯỜNG ĐỘ CARBON NGÀY MAI (GB - REGION 0 - UTC)")
    print(line)
    print(
        f"  • Ngày dự báo : {res['target_date_utc']} (đủ {res['saved_slots']}/48 mốc 30 phút)"
    )
    print(f"  • Mô hình     : {res['model_version']}")
    print(
        f"  • Dữ liệu học : {ev['history_rows']} mốc "
        f"({ev['history_from_utc'][:10]} -> {ev['history_to_utc'][:10]})"
    )
    if ev["test_mae_gco2_kwh"] is not None:
        print(
            f"  • Đánh giá    : MAE = {ev['test_mae_gco2_kwh']} gCO₂/kWh "
            f"(trên {ev['test_samples']} mốc kiểm thử gần nhất)"
        )
    print(line)
    print(
        f"  • Mốc thấp nhất : {low['from']}–{low['to']} UTC  "
        f"→  {low['predicted_intensity']} gCO₂/kWh"
    )
    print(
        f"  • Mốc cao nhất  : {high['from']}–{high['to']} UTC  "
        f"→  {high['predicted_intensity']} gCO₂/kWh"
    )
    print(line)
    print("  KHOẢNG THỜI GIAN DỰ BÁO THẤP NHẤT GỢI Ý DÙNG ĐIỆN:")
    for idx, w in enumerate(res["recommended_low_windows_utc"], start=1):
        print(
            f"    {idx}. {w['from_utc']}–{w['to_utc']} UTC  |  "
            f"TB: {w['avg_intensity']} gCO₂/kWh  |  "
            f"Thấp nhất: {w['min_intensity']} gCO₂/kWh  |  "
            f"({w['slots']} mốc)"
        )
    print(f"{line}\n")
