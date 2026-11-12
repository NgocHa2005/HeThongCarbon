from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint

from cauHinh.ketNoiDb import Base


class SoLieuCarbon(Base):
    __tablename__ = "so_lieu_carbon"
    __table_args__ = (UniqueConstraint("thoi_gian", name="uq_carbon_thoi_gian"),)

    id = Column(Integer, primary_key=True, index=True)
    thoi_gian = Column(DateTime(timezone=True), nullable=False, index=True)
    cuong_do = Column(Float, nullable=False)
    muc_do = Column(String(20), nullable=True)
    phat_thai = Column(Float, nullable=True)
    tai_tao = Column(Float, nullable=True)
    khi = Column(Float, nullable=True)
    hat_nhan = Column(Float, nullable=True)
    gio = Column(Float, nullable=True)
    mat_troi = Column(Float, nullable=True)
