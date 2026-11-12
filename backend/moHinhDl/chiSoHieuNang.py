from sqlalchemy import Column, DateTime, Float, Integer, String, func

from cauHinh.ketNoiDb import Base


class ChiSoHieuNang(Base):
    __tablename__ = "chi_so_hieu_nang"

    id = Column(Integer, primary_key=True, index=True)
    ten_mo_hinh = Column(String(100), nullable=False)
    r2 = Column(Float, nullable=True)
    mae = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    thoi_gian = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
