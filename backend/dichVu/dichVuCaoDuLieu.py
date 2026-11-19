import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

import httpx
from sqlalchemy.orm import Session

from cauHinh.thongSoChung import (
    CARBON_API_BASE_URL,
    GLOBAL_REGION_FULL_NAME,
    GLOBAL_REGION_ID,
    GLOBAL_REGION_SHORT_NAME,
)
from moHinhDl import DuLieuKhuVuc, GenerationMix, SoLieuCarbon


@dataclass(frozen=True)
class KetQuaThuThap:
    inserted: int
    updated: int

    @property
    def total(self) -> int:
        return self.inserted + self.updated


def _doc_thoi_gian(value: str | None) -> datetime:
    if not value:
        raise ValueError("Carbon Intensity API không trả về thời gian cho bản ghi.")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


async def _lay_json(client: httpx.AsyncClient, endpoint: str) -> dict:
    response = await client.get(f"{CARBON_API_BASE_URL}/{endpoint}")
    response.raise_for_status()
    return response.json()


def _lay_mix_nguon_dien(generation_result: dict | Exception) -> dict | None:
    if isinstance(generation_result, Exception):
        return None

    generation_data = generation_result.get("data") or generation_result
    mix = {
        entry.get("fuel", "").lower(): float(entry.get("perc") or 0)
        for entry in generation_data.get("generationmix", [])
        if entry.get("fuel")
    }
    if not mix:
        return None

    clean_total = sum(mix.get(fuel, 0) for fuel in ("wind", "solar", "nuclear", "hydro", "biomass"))
    fossil_total = sum(mix.get(fuel, 0) for fuel in ("gas", "coal", "oil", "other"))
    return {
        "wind": mix.get("wind", 0),
        "solar": mix.get("solar", 0),
        "nuclear": mix.get("nuclear", 0),
        "hydro": mix.get("hydro", 0),
        "gas": mix.get("gas", 0),
        "coal": mix.get("coal", 0),
        "biomass": mix.get("biomass", 0),
        "imports": mix.get("imports", 0),
        "clean_total": clean_total,
        "fossil_total": fossil_total,
    }


def _upsert_vung(
    db: Session,
    region_id: int,
    short_name: str,
    full_name: str,
) -> None:
    region = db.get(DuLieuKhuVuc, region_id)
    if region is None:
        db.add(
            DuLieuKhuVuc(
                ma_vung=region_id,
                ten_vung=short_name,
                ten_day_du=full_name,
            )
        )
        return
    if region_id == GLOBAL_REGION_ID and region.ten_vung != GLOBAL_REGION_SHORT_NAME:
        raise RuntimeError("RegionId 0 đã được dùng cho một vùng khác.")
    region.ten_vung = short_name
    region.ten_day_du = full_name


def _upsert_reading(
    db: Session,
    region_id: int,
    period: dict,
    mix_values: dict | None = None,
) -> bool:
    intensity = period.get("intensity") or {}
    forecast = intensity.get("forecast")
    actual = intensity.get("actual")
    if forecast is None:
        forecast = actual
    if forecast is None or not intensity.get("index"):
        raise ValueError("Bản ghi cường độ thiếu forecast/actual hoặc index.")

    from_time = _doc_thoi_gian(period.get("from"))
    to_time = _doc_thoi_gian(period.get("to"))
    if to_time < from_time:
        raise ValueError("Thời gian kết thúc của bản ghi trước thời gian bắt đầu.")

    reading = (
        db.query(SoLieuCarbon)
        .filter(
            SoLieuCarbon.ma_vung == region_id,
            SoLieuCarbon.thoi_gian == from_time,
        )
        .first()
    )
    is_insert = reading is None
    if reading is None:
        reading = SoLieuCarbon(ma_vung=region_id, thoi_gian=from_time)
        db.add(reading)

    utc_from_time = from_time.astimezone(timezone.utc)
    reading.den_thoi_gian = to_time
    reading.cuong_do_du_bao = int(forecast)
    reading.cuong_do_thuc_te = int(actual) if actual is not None else None
    reading.muc_do = intensity["index"]
    reading.gio = utc_from_time.hour
    reading.thu_trong_tuan = utc_from_time.weekday()
    reading.thang = utc_from_time.month
    db.flush()

    if mix_values is not None:
        mix = (
            db.query(GenerationMix)
            .filter(GenerationMix.reading_id == reading.id)
            .first()
        )
        if mix is None:
            mix = GenerationMix(reading_id=reading.id)
            db.add(mix)
        for field, value in mix_values.items():
            setattr(mix, field, value)
    return is_insert


async def thu_thap_du_lieu(
    db: Session,
    cap_nhat_giai_doan: Callable[[str], None] | None = None,
) -> KetQuaThuThap:
    """Fetch national and regional readings and persist them in the Supabase schema."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        intensity_result, generation_result, regional_result = await asyncio.gather(
            _lay_json(client, "intensity"),
            _lay_json(client, "generation"),
            _lay_json(client, "regional"),
            return_exceptions=True,
        )

    if isinstance(intensity_result, Exception):
        raise RuntimeError(f"Không thể lấy dữ liệu cường độ carbon: {intensity_result}") from intensity_result

    if cap_nhat_giai_doan:
        cap_nhat_giai_doan("clean")

    periods = intensity_result.get("data") or []
    if not periods:
        raise RuntimeError("Carbon Intensity API không trả về dữ liệu cường độ.")

    _upsert_vung(
        db,
        GLOBAL_REGION_ID,
        GLOBAL_REGION_SHORT_NAME,
        GLOBAL_REGION_FULL_NAME,
    )
    mix_values = _lay_mix_nguon_dien(generation_result)
    inserted = int(_upsert_reading(db, GLOBAL_REGION_ID, periods[0], mix_values))
    updated = 1 - inserted

    if cap_nhat_giai_doan:
        cap_nhat_giai_doan("database")

    if not isinstance(regional_result, Exception):
        regional_periods = regional_result.get("data") or []
        regional_period = regional_periods[0] if regional_periods else {}
        for region in regional_period.get("regions", []):
            region_id = region.get("regionid")
            short_name = region.get("shortname") or region.get("name")
            full_name = region.get("name") or short_name
            if region_id is None or int(region_id) <= 0 or not short_name:
                continue

            _upsert_vung(db, int(region_id), short_name, full_name)
            intensity = region.get("intensity") or {}
            regional_record = {
                "from": regional_period.get("from"),
                "to": regional_period.get("to"),
                "intensity": intensity,
            }
            if _upsert_reading(db, int(region_id), regional_record):
                inserted += 1
            else:
                updated += 1

    db.commit()
    return KetQuaThuThap(inserted=inserted, updated=updated)


async def thu_thap_lich_su_du_lieu(
    db: Session,
    so_ngay: int = 730,
    cap_nhat_giai_doan: Callable[[str], None] | None = None,
) -> KetQuaThuThap:
    """Fetch the last two years in API-sized windows instead of one large request."""
    so_ngay = min(max(int(so_ngay), 1), 730)
    ket_thuc = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    bat_dau = ket_thuc - timedelta(days=so_ngay)
    inserted = 0
    updated = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        cursor = bat_dau
        while cursor < ket_thuc:
            window_end = min(cursor + timedelta(days=14), ket_thuc)
            start_text = cursor.strftime("%Y-%m-%dT%H:%MZ")
            end_text = window_end.strftime("%Y-%m-%dT%H:%MZ")
            intensity_result, generation_result, regional_result = await asyncio.gather(
                _lay_json(client, f"intensity/{start_text}/{end_text}"),
                _lay_json(client, f"generation/{start_text}/{end_text}"),
                _lay_json(client, f"regional/{start_text}/{end_text}"),
                return_exceptions=True,
            )
            if isinstance(intensity_result, Exception):
                raise RuntimeError(f"Không thể lấy lịch sử cường độ carbon: {intensity_result}") from intensity_result

            _upsert_vung(db, GLOBAL_REGION_ID, GLOBAL_REGION_SHORT_NAME, GLOBAL_REGION_FULL_NAME)
            generation_by_time = {}
            if not isinstance(generation_result, Exception):
                generation_by_time = {
                    item.get("from"): _lay_mix_nguon_dien(item)
                    for item in generation_result.get("data") or []
                    if item.get("from")
                }
            for period in intensity_result.get("data") or []:
                if _upsert_reading(
                    db,
                    GLOBAL_REGION_ID,
                    period,
                    generation_by_time.get(period.get("from")),
                ):
                    inserted += 1
                else:
                    updated += 1

            if not isinstance(regional_result, Exception):
                for regional_period in regional_result.get("data") or []:
                    for region in regional_period.get("regions") or []:
                        region_id = region.get("regionid")
                        short_name = region.get("shortname") or region.get("name")
                        full_name = region.get("name") or short_name
                        if region_id is None or int(region_id) <= 0 or not short_name:
                            continue
                        region_record = {
                            "from": regional_period.get("from"),
                            "to": regional_period.get("to"),
                            "intensity": region.get("intensity") or {},
                        }
                        _upsert_vung(db, int(region_id), short_name, full_name)
                        if _upsert_reading(db, int(region_id), region_record):
                            inserted += 1
                        else:
                            updated += 1

            db.commit()
            cursor = window_end
            if cap_nhat_giai_doan:
                cap_nhat_giai_doan("database")

    return KetQuaThuThap(inserted=inserted, updated=updated)
