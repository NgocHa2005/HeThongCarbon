import datetime
from typing import TYPE_CHECKING

from config.database import Base
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKeyConstraint,
    Integer,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from models.fact_carbon_reading import FactCarbonReading


class SysCarbonAlert(Base):
    __tablename__ = "SYS_CARBON_ALERTS"
    __table_args__ = (
        ForeignKeyConstraint(
            ["ReadingId"],
            ["FACT_CARBON_READINGS.ReadingId"],
            ondelete="CASCADE",
            name="FK_CarbonAlerts_Readings",
        ),
        PrimaryKeyConstraint("AlertId", name="SYS_CARBON_ALERTS_pkey"),
        UniqueConstraint("ReadingId", name="SYS_CARBON_ALERTS_ReadingId_key"),
    )

    AlertId: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    ReadingId: Mapped[int] = mapped_column(BigInteger, nullable=False)
    AlertTime: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    ThresholdLimit: Mapped[int] = mapped_column(Integer, nullable=False)
    ExceededValue: Mapped[int] = mapped_column(Integer, nullable=False)
    Severity: Mapped[str] = mapped_column(String(15), nullable=False)
    CauseFuel: Mapped[str | None] = mapped_column(String(50))
    IsDismissed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )

    carbon_reading: Mapped["FactCarbonReading"] = relationship(
        "FactCarbonReading", back_populates="carbon_alert"
    )
