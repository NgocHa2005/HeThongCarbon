import decimal
from typing import TYPE_CHECKING

from config.database import Base
from sqlalchemy import (
    BigInteger,
    ForeignKeyConstraint,
    Numeric,
    PrimaryKeyConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

if TYPE_CHECKING:
    from models.fact_carbon_reading import FactCarbonReading


class FactGenerationMix(Base):
    __tablename__ = "FACT_GENERATION_MIX"
    __table_args__ = (
        ForeignKeyConstraint(
            ["ReadingId"],
            ["FACT_CARBON_READINGS.ReadingId"],
            ondelete="CASCADE",
            name="FK_GenerationMix_Readings",
        ),
        PrimaryKeyConstraint("MixId", name="FACT_GENERATION_MIX_pkey"),
        UniqueConstraint("ReadingId", name="FACT_GENERATION_MIX_ReadingId_key"),
    )

    MixId: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ReadingId: Mapped[int] = mapped_column(BigInteger, nullable=False)
    WindPerc: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    SolarPerc: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    NuclearPerc: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    HydroPerc: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    GasPerc: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    CoalPerc: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    BiomassPerc: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    ImportsPerc: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    CleanTotalPerc: Mapped[decimal.Decimal] = mapped_column(
        Numeric(5, 2), nullable=False
    )
    FossilTotalPerc: Mapped[decimal.Decimal] = mapped_column(
        Numeric(5, 2), nullable=False
    )

    carbon_reading: Mapped["FactCarbonReading"] = relationship(
        "FactCarbonReading", back_populates="generation_mix"
    )

    id = synonym("MixId")
    reading_id = synonym("ReadingId")
    wind = synonym("WindPerc")
    solar = synonym("SolarPerc")
    nuclear = synonym("NuclearPerc")
    hydro = synonym("HydroPerc")
    gas = synonym("GasPerc")
    coal = synonym("CoalPerc")
    biomass = synonym("BiomassPerc")
    imports = synonym("ImportsPerc")
    clean_total = synonym("CleanTotalPerc")
    fossil_total = synonym("FossilTotalPerc")
