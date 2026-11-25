import datetime
from typing import TYPE_CHECKING, Optional

from config.database import Base
from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

if TYPE_CHECKING:
    from models.dim_region import DimRegion
    from models.fact_generation_mix import FactGenerationMix
    from models.sys_carbon_alert import SysCarbonAlert


class FactCarbonReading(Base):
    __tablename__ = "FACT_CARBON_READINGS"
    __table_args__ = (
        ForeignKeyConstraint(
            ["RegionId"], ["DIM_REGIONS.RegionId"], name="FK_CarbonReadings_Regions"
        ),
        PrimaryKeyConstraint("ReadingId", name="FACT_CARBON_READINGS_pkey"),
        UniqueConstraint(
            "RegionId", "FromTime", name="UQ_CarbonReadings_Region_FromTime"
        ),
        Index("IX_CarbonReadings_FromTime", "FromTime"),
    )

    ReadingId: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    RegionId: Mapped[int] = mapped_column(Integer, nullable=False)
    FromTime: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    ToTime: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    IntensityForecast: Mapped[int] = mapped_column(Integer, nullable=False)
    IntensityActual: Mapped[int | None] = mapped_column(Integer)
    IntensityIndex: Mapped[str] = mapped_column(String(20), nullable=False)
    HourOfDay: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    DayOfWeek: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    MonthOfYear: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    IngestedAt: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    region: Mapped["DimRegion"] = relationship(
        "DimRegion", back_populates="carbon_readings"
    )
    generation_mix: Mapped[Optional["FactGenerationMix"]] = relationship(
        "FactGenerationMix",
        uselist=False,
        back_populates="carbon_reading",
        cascade="all, delete-orphan",
    )
    carbon_alert: Mapped[Optional["SysCarbonAlert"]] = relationship(
        "SysCarbonAlert",
        uselist=False,
        back_populates="carbon_reading",
        cascade="all, delete-orphan",
    )

    id = synonym("ReadingId")
    ma_vung = synonym("RegionId")
    thoi_gian = synonym("FromTime")
    den_thoi_gian = synonym("ToTime")
    cuong_do_du_bao = synonym("IntensityForecast")
    cuong_do_thuc_te = synonym("IntensityActual")
    muc_do = synonym("IntensityIndex")
    gio = synonym("HourOfDay")
    thu_trong_tuan = synonym("DayOfWeek")
    thang = synonym("MonthOfYear")

    @property
    def cuong_do(self) -> int:
        if self.IntensityActual is not None:
            return self.IntensityActual
        return self.IntensityForecast
