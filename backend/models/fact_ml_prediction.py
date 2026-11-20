import datetime

from config.database import Base
from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class FactMlPrediction(Base):
    __tablename__ = "FACT_ML_PREDICTIONS"
    __table_args__ = (
        PrimaryKeyConstraint("PredId", name="FACT_ML_PREDICTIONS_pkey"),
        UniqueConstraint(
            "TargetFromTime", name="FACT_ML_PREDICTIONS_TargetFromTime_key"
        ),
        Index("IX_MlPredictions_TargetDate", "TargetDate"),
    )

    PredId: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    TargetDate: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    TargetFromTime: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False
    )
    TargetToTime: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False
    )
    PredictedIntensity: Mapped[int] = mapped_column(Integer, nullable=False)
    ConfidenceLower: Mapped[int | None] = mapped_column(Integer)
    ConfidenceUpper: Mapped[int | None] = mapped_column(Integer)
    PredictedClass: Mapped[str] = mapped_column(String(30), nullable=False)
    ClassProbabilities: Mapped[dict | None] = mapped_column(JSONB)
    ModelVersion: Mapped[str] = mapped_column(String(100), nullable=False)
    CreatedAt: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
