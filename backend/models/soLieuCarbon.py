from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from backend.config.database import Base


class SoLieuCarbon(Base):
    __tablename__ = "FACT_CARBON_READINGS"
    __table_args__ = (
        UniqueConstraint(
            "RegionId",
            "FromTime",
            name="UQ_CarbonReadings_Region_FromTime",
        ),
    )

    id = Column(
        "ReadingId",
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    ma_vung = Column("RegionId", Integer, ForeignKey("DIM_REGIONS.RegionId"), nullable=False)
    thoi_gian = Column("FromTime", DateTime(timezone=True), nullable=False)
    den_thoi_gian = Column("ToTime", DateTime(timezone=True), nullable=False)
    cuong_do_du_bao = Column("IntensityForecast", Integer, nullable=False)
    cuong_do_thuc_te = Column("IntensityActual", Integer, nullable=True)
    muc_do = Column("IntensityIndex", String, nullable=False)
    gio = Column("HourOfDay", SmallInteger, nullable=False)
    thu_trong_tuan = Column("DayOfWeek", SmallInteger, nullable=False)
    thang = Column("MonthOfYear", SmallInteger, nullable=False)
    da_nhap_luc = Column("IngestedAt", DateTime(timezone=True), nullable=False, server_default=func.now())

    generation_mix = relationship(
        "GenerationMix",
        back_populates="reading",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def cuong_do(self):
        if self.cuong_do_thuc_te is not None:
            return self.cuong_do_thuc_te
        return self.cuong_do_du_bao
