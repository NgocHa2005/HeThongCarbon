from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text, func

from cauHinh.ketNoiDb import Base


class LuotThuThap(Base):
    __tablename__ = "SYS_INGESTION_RUNS"

    id = Column(
        "RunId",
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    nguoi_kich_hoat = Column("TriggeredBy", String(30), nullable=False)
    bat_dau_luc = Column("StartTime", DateTime(timezone=True), nullable=False, server_default=func.now())
    ket_thuc_luc = Column("EndTime", DateTime(timezone=True), nullable=True)
    so_ban_ghi_them = Column("RecordsInserted", Integer, nullable=False, server_default="0")
    so_ban_ghi_cap_nhat = Column("RecordsUpdated", Integer, nullable=False, server_default="0")
    trang_thai = Column("Status", String, nullable=False)
    thong_bao_loi = Column("ErrorMessage", Text, nullable=True)
