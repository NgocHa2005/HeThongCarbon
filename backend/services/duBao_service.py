from __future__ import annotations

import datetime as dt
from typing import Any

import numpy as np
from models.fact_ml_prediction import FactMlPrediction
from sqlalchemy import select
from sqlalchemy.orm import Session


def lay_ngay_mai_utc() -> dt.date:
    """Lấy ngày kế tiếp theo giờ UTC."""
    return (dt.datetime.now(dt.UTC) + dt.timedelta(days=1)).date()


def _gom_khoang_thap_nhat(ordered_slots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gom các mốc 30 phút liên tiếp thuộc nhóm dự báo thấp nhất thành khoảng giờ."""
    if not ordered_slots:
        return []

    values = [item["PredictedIntensity"] for item in ordered_slots]
    min_val = min(values)
    q20 = float(np.percentile(values, 20))
    threshold = max(min_val + 10, int(round(q20)))

    low_indices = [i for i, v in enumerate(values) if v <= threshold]
    if not low_indices:
        low_indices = [values.index(min_val)]

    windows: list[dict[str, Any]] = []
    start_i = low_indices[0]
    prev_i = low_indices[0]

    for idx in low_indices[1:]:
        if idx == prev_i + 1:
            prev_i = idx
        else:
            seg = ordered_slots[start_i : prev_i + 1]
            windows.append(
                {
                    "from_utc": seg[0]["from_hhmm"],
                    "to_utc": seg[-1]["to_hhmm"],
                    "slots": len(seg),
                    "min_intensity": min(x["PredictedIntensity"] for x in seg),
                    "avg_intensity": round(
                        sum(x["PredictedIntensity"] for x in seg) / len(seg), 1
                    ),
                }
            )
            start_i = idx
            prev_i = idx

    seg = ordered_slots[start_i : prev_i + 1]
    windows.append(
        {
            "from_utc": seg[0]["from_hhmm"],
            "to_utc": seg[-1]["to_hhmm"],
            "slots": len(seg),
            "min_intensity": min(x["PredictedIntensity"] for x in seg),
            "avg_intensity": round(
                sum(x["PredictedIntensity"] for x in seg) / len(seg), 1
            ),
        }
    )

    windows.sort(key=lambda w: (w["avg_intensity"], w["min_intensity"]))
    return windows


def lay_du_bao_ngay_mai(
    db: Session,
    target_date: dt.date | None = None,
) -> dict[str, Any]:
    """Lấy 48 mốc dự báo 30 phút theo UTC từ FACT_ML_PREDICTIONS cho ngày chỉ định."""
    resolved_date = target_date if target_date is not None else lay_ngay_mai_utc()

    stmt = (
        select(FactMlPrediction)
        .where(FactMlPrediction.TargetDate == resolved_date)
        .order_by(FactMlPrediction.TargetFromTime.asc())
    )
    rows = db.execute(stmt).scalars().all()

    slot_items: list[dict[str, Any]] = []
    ordered_meta: list[dict[str, Any]] = []

    for r in rows:
        from_utc = (
            r.TargetFromTime.astimezone(dt.UTC)
            if r.TargetFromTime.tzinfo is not None
            else r.TargetFromTime.replace(tzinfo=dt.UTC)
        )
        to_utc = (
            r.TargetToTime.astimezone(dt.UTC)
            if r.TargetToTime.tzinfo is not None
            else r.TargetToTime.replace(tzinfo=dt.UTC)
        )
        from_hhmm = from_utc.strftime("%H:%M")
        to_hhmm = to_utc.strftime("%H:%M")
        label = f"{from_hhmm}–{to_hhmm}"

        slot_items.append(
            {
                "PredId": r.PredId,
                "TargetDate": r.TargetDate,
                "TargetFromTime": from_utc,
                "TargetToTime": to_utc,
                "TimeSlotUTC": label,
                "PredictedIntensity": r.PredictedIntensity,
                "ConfidenceLower": r.ConfidenceLower,
                "ConfidenceUpper": r.ConfidenceUpper,
                "PredictedClass": r.PredictedClass,
                "ModelVersion": r.ModelVersion,
            }
        )
        ordered_meta.append(
            {
                "from_hhmm": from_hhmm,
                "to_hhmm": to_hhmm,
                "PredictedIntensity": r.PredictedIntensity,
            }
        )

    lowest_slot = None
    highest_slot = None
    if ordered_meta:
        min_item = min(ordered_meta, key=lambda x: x["PredictedIntensity"])
        max_item = max(ordered_meta, key=lambda x: x["PredictedIntensity"])
        lowest_slot = {
            "from_utc": min_item["from_hhmm"],
            "to_utc": min_item["to_hhmm"],
            "predicted_intensity": min_item["PredictedIntensity"],
        }
        highest_slot = {
            "from_utc": max_item["from_hhmm"],
            "to_utc": max_item["to_hhmm"],
            "predicted_intensity": max_item["PredictedIntensity"],
        }

    model_version = rows[0].ModelVersion if rows else None

    return {
        "target_date_utc": resolved_date,
        "region": "Great Britain (Region 0)",
        "timezone": "UTC",
        "interval_minutes": 30,
        "total_slots": len(slot_items),
        "model_version": model_version,
        "lowest_slot_utc": lowest_slot,
        "highest_slot_utc": highest_slot,
        "recommended_low_windows_utc": _gom_khoang_thap_nhat(ordered_meta),
        "slots": slot_items,
    }
