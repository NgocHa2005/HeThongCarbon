import datetime

from config.database import Base
from sqlalchemy import (
    BigInteger,
    DateTime,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column


class SysIngestionRun(Base):
    __tablename__ = "SYS_INGESTION_RUNS"
    __table_args__ = (PrimaryKeyConstraint("RunId", name="SYS_INGESTION_RUNS_pkey"),)

    RunId: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    TriggeredBy: Mapped[str] = mapped_column(String(30), nullable=False)
    StartTime: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    EndTime: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    RecordsInserted: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    RecordsUpdated: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    Status: Mapped[str] = mapped_column(String(20), nullable=False)
    ErrorMessage: Mapped[str | None] = mapped_column(Text)
