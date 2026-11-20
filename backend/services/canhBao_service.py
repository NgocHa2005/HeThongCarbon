from math import ceil

from sqlalchemy import MetaData, Table, inspect, select
from sqlalchemy.sql import quoted_name
from sqlalchemy.orm import Session

from backend.config.settings import (
    CARBON_ALERT_CHANGE_PERCENT,
    CARBON_ALERT_THRESHOLD,
    CARBON_ALERT_WINDOW_HOURS,
    GLOBAL_REGION_ID,
)
from models import SoLieuCarbon


def _lay_bang_canh_bao(db: Session) -> tuple[Table | None, dict[str, object]]:
    connection = db.connection()
    table_name = next(
        (
            name
            for name in inspect(connection).get_table_names()
            if name.casefold() == "sys_carbon_alerts"
        ),
        None,
    )
    if table_name is None:
        return None, {}

    table = Table(
        quoted_name(table_name, True),
        MetaData(),
        autoload_with=connection,
    )
    columns = {column.name.casefold(): column for column in table.columns}
    required = ("readingid", "thresholdlimit", "exceededvalue", "severity")
    missing = [name for name in required if name not in columns]
    if missing:
        raise RuntimeError(
            "SYS_CARBON_ALERTS thiếu các cột bắt buộc: " + ", ".join(missing)
        )
    return table, columns


def _ghi_canh_bao(
    db: Session,
    reading_id: int,
    threshold_limit: int,
    exceeded_value: int,
    severity: str,
) -> None:
    table, columns = _lay_bang_canh_bao(db)
    if table is None:
        return

    reading_id_column = columns["readingid"]
    threshold_column = columns["thresholdlimit"]
    exceeded_column = columns["exceededvalue"]
    severity_column = columns["severity"]
    existing = db.execute(
        select(table).where(reading_id_column == reading_id)
    ).mappings().first()
    values = {
        threshold_column.name: threshold_limit,
        exceeded_column.name: exceeded_value,
        severity_column.name: severity,
    }

    if existing is None:
        cause_fuel_column = columns.get("causefuel")
        if cause_fuel_column is not None:
            values[cause_fuel_column.name] = None
        values[reading_id_column.name] = reading_id
        db.execute(table.insert().values(**values))
        return

    primary_key = next(iter(table.primary_key.columns), None)
    if primary_key is None:
        raise RuntimeError("SYS_CARBON_ALERTS cần có khóa chính để cập nhật cảnh báo.")
    db.execute(
        table.update()
        .where(primary_key == existing[primary_key.name])
        .values(**values)
    )


def kiem_tra_canh_bao_cuong_do(db: Session, reading: SoLieuCarbon) -> None:
    """Persist one alert per national reading when a configured rule is exceeded."""
    if reading.ma_vung != GLOBAL_REGION_ID:
        return
    if CARBON_ALERT_THRESHOLD < 0 or CARBON_ALERT_CHANGE_PERCENT < 0:
        raise ValueError("Ngưỡng cảnh báo không được là số âm.")
    if CARBON_ALERT_WINDOW_HOURS < 1:
        raise ValueError("Cửa sổ cảnh báo phải tối thiểu một giờ.")

    value = reading.cuong_do
    if value > CARBON_ALERT_THRESHOLD:
        _ghi_canh_bao(
            db,
            reading.id,
            CARBON_ALERT_THRESHOLD,
            value,
            "HIGH",
        )
        return

    previous_count = CARBON_ALERT_WINDOW_HOURS * 2
    previous_readings = (
        db.query(SoLieuCarbon)
        .filter(
            SoLieuCarbon.ma_vung == GLOBAL_REGION_ID,
            SoLieuCarbon.thoi_gian < reading.thoi_gian,
        )
        .order_by(SoLieuCarbon.thoi_gian.desc())
        .limit(previous_count)
        .all()
    )
    if len(previous_readings) != previous_count:
        return

    average = sum(item.cuong_do for item in previous_readings) / previous_count
    if average <= 0:
        return
    change_percent = (value - average) / average * 100
    if change_percent <= CARBON_ALERT_CHANGE_PERCENT:
        return

    _ghi_canh_bao(
        db,
        reading.id,
        ceil(average * (1 + CARBON_ALERT_CHANGE_PERCENT / 100)),
        value,
        "MEDIUM",
    )
