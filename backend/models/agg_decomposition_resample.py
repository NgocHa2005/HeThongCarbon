import datetime

from config.database import Base
from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Float,
    Integer,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

# BigInteger tự tăng trên PostgreSQL; SQLite (dùng khi chạy thử) cần Integer
_KHOA_CHINH = BigInteger().with_variant(Integer, "sqlite")


class AggDecompositionResample(Base):
    """Kết quả phân rã STL (Observed = Trend + Seasonal + Residual).

    Worker `analysis` tính và ghi đè bảng này; API chỉ đọc.
    """

    __tablename__ = "AGG_DECOMPOSITION_RESAMPLE"
    __table_args__ = (
        PrimaryKeyConstraint("DecompId", name="AGG_DECOMPOSITION_RESAMPLE_pkey"),
        UniqueConstraint(
            "PeriodType",
            "PeriodStartDate",
            name="UQ_DecompositionResample_Period",
        ),
    )

    DecompId: Mapped[int] = mapped_column(
        _KHOA_CHINH, primary_key=True, autoincrement=True
    )
    PeriodType: Mapped[str] = mapped_column(String(10), nullable=False)  # "thang" | "tuan"
    PeriodStartDate: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    PeriodLabel: Mapped[str] = mapped_column(String(20), nullable=False)
    ResampleMedian: Mapped[float] = mapped_column(Float, nullable=False)
    TrendComponent: Mapped[float] = mapped_column(Float, nullable=False)
    SeasonalComponent: Mapped[float] = mapped_column(Float, nullable=False)
    ResidualComponent: Mapped[float] = mapped_column(Float, nullable=False)
    ComputedAt: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )