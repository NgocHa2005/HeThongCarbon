from typing import TYPE_CHECKING

from config.database import Base
from sqlalchemy import Integer, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from models.fact_carbon_reading import FactCarbonReading


class DimRegion(Base):
    __tablename__ = "DIM_REGIONS"
    __table_args__ = (PrimaryKeyConstraint("RegionId", name="DIM_REGIONS_pkey"),)

    RegionId: Mapped[int] = mapped_column(Integer, primary_key=True)
    ShortName: Mapped[str] = mapped_column(String(50), nullable=False)
    FullName: Mapped[str] = mapped_column(String(100), nullable=False)

    carbon_readings: Mapped[list["FactCarbonReading"]] = relationship(
        "FactCarbonReading", back_populates="region"
    )
