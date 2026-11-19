import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

import httpx
from sqlalchemy import tuple_
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


def _khoa_thoi_gian(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _tao_gia_tri_ban_ghi(region_id: int, period: dict) -> dict:
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

    return {
        "RegionId": region_id,
        "FromTime": from_time,
        "ToTime": to_time,
        "IntensityForecast": int(forecast),
        "IntensityActual": int(actual) if actual is not None else None,
        "IntensityIndex": intensity["index"],
        "HourOfDay": from_time.hour,
        "DayOfWeek": from_time.weekday(),
        "MonthOfYear": from_time.month,
    }


def _upsert_nhieu_ban_ghi(
    db: Session,
    readings: list[dict],
    generation_by_time: dict[datetime, dict],
) -> tuple[int, int]:
    if not readings:
        return 0, 0

    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    else:
        inserted = updated = 0
        for item in readings:
            period = {
                "from": item["FromTime"].isoformat(),
                "to": item["ToTime"].isoformat(),
                "intensity": {
                    "forecast": item["IntensityForecast"],
                    "actual": item["IntensityActual"],
                    "index": item["IntensityIndex"],
                },
            }
            mix_values = generation_by_time.get(_khoa_thoi_gian(item["FromTime"]))
            if _upsert_reading(db, item["RegionId"], period, mix_values):
                inserted += 1
            else:
                updated += 1
        return inserted, updated

    reading_table = SoLieuCarbon.__table__
    generation_table = GenerationMix.__table__
    reading_columns = (
        "ToTime",
        "IntensityForecast",
        "IntensityActual",
        "IntensityIndex",
        "HourOfDay",
        "DayOfWeek",
        "MonthOfYear",
    )
    generation_columns = (
        "WindPerc",
        "SolarPerc",
        "NuclearPerc",
        "HydroPerc",
        "GasPerc",
        "CoalPerc",
        "BiomassPerc",
        "ImportsPerc",
        "CleanTotalPerc",
        "FossilTotalPerc",
    )
    inserted = updated = 0

    for offset in range(0, len(readings), 500):
        batch = readings[offset : offset + 500]
        keys = [(item["RegionId"], item["FromTime"]) for item in batch]
        existing = db.query(SoLieuCarbon.ma_vung, SoLieuCarbon.thoi_gian).filter(
            tuple_(SoLieuCarbon.ma_vung, SoLieuCarbon.thoi_gian).in_(keys)
        )
        existing_keys = {
            (region_id, _khoa_thoi_gian(from_time))
            for region_id, from_time in existing.all()
        }
        new_count = sum(
            (item["RegionId"], _khoa_thoi_gian(item["FromTime"])) not in existing_keys
            for item in batch
        )
        inserted += new_count
        updated += len(batch) - new_count

        statement = insert(reading_table).values(batch)
        statement = statement.on_conflict_do_update(
            index_elements=[reading_table.c.RegionId, reading_table.c.FromTime],
            set_={column: statement.excluded[column] for column in reading_columns},
        ).returning(
            reading_table.c.ReadingId,
            reading_table.c.RegionId,
            reading_table.c.FromTime,
        )
        result = db.execute(statement)
        mix_rows = []
        for reading_id, region_id, from_time in result:
            if region_id != GLOBAL_REGION_ID:
                continue
            mix = generation_by_time.get(_khoa_thoi_gian(from_time))
            if mix is not None:
                mix_rows.append(
                    {
                        "ReadingId": reading_id,
                        "WindPerc": mix["wind"],
                        "SolarPerc": mix["solar"],
                        "NuclearPerc": mix["nuclear"],
                        "HydroPerc": mix["hydro"],
                        "GasPerc": mix["gas"],
                        "CoalPerc": mix["coal"],
                        "BiomassPerc": mix["biomass"],
                        "ImportsPerc": mix["imports"],
                        "CleanTotalPerc": mix["clean_total"],
                        "FossilTotalPerc": mix["fossil_total"],
                    }
                )
        if mix_rows:
            mix_statement = insert(generation_table).values(mix_rows)
            mix_statement = mix_statement.on_conflict_do_update(
                index_elements=[generation_table.c.ReadingId],
                set_={
                    column: mix_statement.excluded[column]
                    for column in generation_columns
                },
            )
            db.execute(mix_statement)

    return inserted, updated


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
    values = _tao_gia_tri_ban_ghi(region_id, period)
    from_time = values["FromTime"]

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

    reading.den_thoi_gian = values["ToTime"]
    reading.cuong_do_du_bao = values["IntensityForecast"]
    reading.cuong_do_thuc_te = values["IntensityActual"]
    reading.muc_do = values["IntensityIndex"]
    reading.gio = values["HourOfDay"]
    reading.thu_trong_tuan = values["DayOfWeek"]
    reading.thang = values["MonthOfYear"]
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
    if isinstance(generation_result, Exception):
        raise RuntimeError(f"Không thể lấy dữ liệu cơ cấu nguồn điện: {generation_result}") from generation_result
    if isinstance(regional_result, Exception):
        raise RuntimeError(f"Không thể lấy dữ liệu vùng: {regional_result}") from regional_result

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
    if mix_values is None:
        raise RuntimeError("Carbon Intensity API không trả về cơ cấu nguồn điện hợp lệ.")
    inserted = int(_upsert_reading(db, GLOBAL_REGION_ID, periods[0], mix_values))
    updated = 1 - inserted
    national_time = _doc_thoi_gian(periods[0].get("from"))
    national_reading = (
        db.query(SoLieuCarbon)
        .filter(
            SoLieuCarbon.ma_vung == GLOBAL_REGION_ID,
            SoLieuCarbon.thoi_gian == national_time,
        )
        .one()
    )
    from dichVu.dichVuCanhBao import kiem_tra_canh_bao_cuong_do

    kiem_tra_canh_bao_cuong_do(db, national_reading)

    if cap_nhat_giai_doan:
        cap_nhat_giai_doan("database")

    regional_periods = regional_result.get("data") or []
    regional_period = regional_periods[0] if regional_periods else {}
    regions = regional_period.get("regions") or []
    if not regions:
        raise RuntimeError("Carbon Intensity API không trả về dữ liệu vùng.")
    returned_region_ids = {
        int(region["regionid"])
        for region in regions
        if region.get("regionid") is not None and 1 <= int(region["regionid"]) <= 17
    }
    if returned_region_ids != set(range(1, 18)):
        raise RuntimeError("Carbon Intensity API không trả về đủ các vùng 1–17.")
    for region in regions:
        region_id = region.get("regionid")
        short_name = region.get("shortname") or region.get("name")
        full_name = region.get("name") or short_name
        if region_id is None or not 1 <= int(region_id) <= 17 or not short_name:
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
    return await thu_thap_khoang_thoi_gian(db, bat_dau, ket_thuc, cap_nhat_giai_doan)


async def thu_thap_khoang_thoi_gian(
    db: Session,
    bat_dau: datetime,
    ket_thuc: datetime,
    cap_nhat_giai_doan: Callable[[str], None] | None = None,
    cap_nhat_ket_qua: Callable[[KetQuaThuThap], None] | None = None,
) -> KetQuaThuThap:
    """Fetch a requested time range in API-sized windows and upsert every reading."""
    if bat_dau.tzinfo is None or ket_thuc.tzinfo is None:
        raise ValueError("Thời gian bắt đầu và kết thúc phải có múi giờ.")
    bat_dau = bat_dau.astimezone(timezone.utc)
    ket_thuc = ket_thuc.astimezone(timezone.utc)
    if ket_thuc <= bat_dau:
        raise ValueError("Thời gian kết thúc phải sau thời gian bắt đầu.")

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
                _lay_json(client, f"regional/intensity/{start_text}/{end_text}"),
                return_exceptions=True,
            )
            if isinstance(intensity_result, Exception):
                raise RuntimeError(f"Không thể lấy lịch sử cường độ carbon: {intensity_result}") from intensity_result
            if isinstance(generation_result, Exception):
                raise RuntimeError(f"Không thể lấy lịch sử cơ cấu nguồn điện: {generation_result}") from generation_result
            if isinstance(regional_result, Exception):
                raise RuntimeError(f"Không thể lấy lịch sử dữ liệu vùng: {regional_result}") from regional_result

            generation_by_time = {
                _doc_thoi_gian(item.get("from")): _lay_mix_nguon_dien(item)
                for item in generation_result.get("data") or []
                if item.get("from")
                and cursor <= _doc_thoi_gian(item.get("from")) < window_end
            }
            national_periods = [
                item
                for item in intensity_result.get("data") or []
                if item.get("from")
                and cursor <= _doc_thoi_gian(item.get("from")) < window_end
            ]
            if not national_periods:
                raise RuntimeError("Carbon Intensity API không trả về dữ liệu lịch sử.")

            regional_periods = regional_result.get("data") or []
            regional_by_time = {
                _doc_thoi_gian(item.get("from")): item
                for item in regional_periods
                if item.get("from")
                and cursor <= _doc_thoi_gian(item.get("from")) < window_end
            }
            if not regional_by_time:
                raise RuntimeError("Carbon Intensity API không trả về dữ liệu vùng lịch sử.")

            region_names = {
                GLOBAL_REGION_ID: (GLOBAL_REGION_SHORT_NAME, GLOBAL_REGION_FULL_NAME)
            }
            reading_rows = {}
            for period in national_periods:
                period_time = _doc_thoi_gian(period.get("from"))
                if generation_by_time.get(period_time) is None:
                    raise RuntimeError(
                        f"Thiếu dữ liệu cơ cấu nguồn điện tại {period.get('from')}."
                    )
                reading_rows[(GLOBAL_REGION_ID, period_time)] = _tao_gia_tri_ban_ghi(
                    GLOBAL_REGION_ID,
                    period,
                )

                regional_period = regional_by_time.get(period_time)
                if regional_period is None:
                    raise RuntimeError(
                        f"Thiếu dữ liệu vùng tại {period.get('from')}."
                    )
                regions = regional_period.get("regions") or []
                region_ids = {
                    int(region["regionid"])
                    for region in regions
                    if region.get("regionid") is not None
                    and 1 <= int(region["regionid"]) <= 17
                }
                if region_ids != set(range(1, 18)):
                    raise RuntimeError(
                        f"API vùng không trả về đủ IDs 1–17 tại {period.get('from')}."
                    )
                for region in regions:
                    if region.get("regionid") is None:
                        continue
                    region_id = int(region["regionid"])
                    if not 1 <= region_id <= 17:
                        continue
                    short_name = region.get("shortname") or region.get("name")
                    if not short_name:
                        raise RuntimeError(f"Vùng {region_id} thiếu tên trong dữ liệu API.")
                    region_names[region_id] = (
                        short_name,
                        region.get("name") or short_name,
                    )
                    region_record = {
                        "from": regional_period.get("from"),
                        "to": regional_period.get("to"),
                        "intensity": region.get("intensity") or {},
                    }
                    reading_rows[(region_id, period_time)] = _tao_gia_tri_ban_ghi(
                        region_id,
                        region_record,
                    )

            for region_id, (short_name, full_name) in region_names.items():
                _upsert_vung(db, region_id, short_name, full_name)

            added, changed = _upsert_nhieu_ban_ghi(
                db,
                list(reading_rows.values()),
                generation_by_time,
            )
            inserted += added
            updated += changed

            db.commit()
            cursor = window_end
            if cap_nhat_ket_qua:
                cap_nhat_ket_qua(KetQuaThuThap(inserted=inserted, updated=updated))
            if cap_nhat_giai_doan:
                cap_nhat_giai_doan("database")

    return KetQuaThuThap(inserted=inserted, updated=updated)
