from sqlalchemy import BigInteger, Column, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.config.database import Base


class GenerationMix(Base):
    __tablename__ = "FACT_GENERATION_MIX"
    __table_args__ = (
        UniqueConstraint("ReadingId", name="FACT_GENERATION_MIX_ReadingId_key"),
    )

    id = Column(
        "MixId",
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    reading_id = Column(
        "ReadingId",
        BigInteger,
        ForeignKey("FACT_CARBON_READINGS.ReadingId"),
        nullable=False,
    )
    wind = Column("WindPerc", Numeric(asdecimal=False), nullable=False)
    solar = Column("SolarPerc", Numeric(asdecimal=False), nullable=False)
    nuclear = Column("NuclearPerc", Numeric(asdecimal=False), nullable=False)
    hydro = Column("HydroPerc", Numeric(asdecimal=False), nullable=False)
    gas = Column("GasPerc", Numeric(asdecimal=False), nullable=False)
    coal = Column("CoalPerc", Numeric(asdecimal=False), nullable=False)
    biomass = Column("BiomassPerc", Numeric(asdecimal=False), nullable=False)
    imports = Column("ImportsPerc", Numeric(asdecimal=False), nullable=False)
    clean_total = Column("CleanTotalPerc", Numeric(asdecimal=False), nullable=False)
    fossil_total = Column("FossilTotalPerc", Numeric(asdecimal=False), nullable=False)

    reading = relationship("SoLieuCarbon", back_populates="generation_mix")
