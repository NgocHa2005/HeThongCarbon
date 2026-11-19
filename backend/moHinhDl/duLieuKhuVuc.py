from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from cauHinh.ketNoiDb import Base


class DuLieuKhuVuc(Base):
    __tablename__ = "DIM_REGIONS"

    ma_vung = Column("RegionId", Integer, primary_key=True)
    ten_vung = Column("ShortName", String, nullable=False)
    ten_day_du = Column("FullName", String, nullable=False)

    readings = relationship("SoLieuCarbon", backref="region")
