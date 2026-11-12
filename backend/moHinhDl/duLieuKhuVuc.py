from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint

from cauHinh.ketNoiDb import Base


class DuLieuKhuVuc(Base):
    __tablename__ = "du_lieu_khu_vuc"
    __table_args__ = (UniqueConstraint("ma_vung", "thoi_gian", name="uq_vung_thoi_gian"),)

    id = Column(Integer, primary_key=True, index=True)
    ma_vung = Column(Integer, nullable=False, index=True)
    ten_vung = Column(String(120), nullable=False)
    thoi_gian = Column(DateTime(timezone=True), nullable=False, index=True)
    cuong_do = Column(Float, nullable=False)
    muc_do = Column(String(20), nullable=True)
