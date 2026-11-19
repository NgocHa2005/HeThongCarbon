from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cauHinh.ketNoiDb import Base, SessionLocal, engine
from cauHinh.thongSoChung import CORS_ORIGINS
from dinhTuyen.tuyenCongKhai import router as public_router
from dinhTuyen.tuyenQuanTri import router as admin_router
from moHinhDl import DuLieuKhuVuc, LuotThuThap, SoLieuCarbon


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        interrupted_jobs = (
            db.query(LuotThuThap)
            .filter(LuotThuThap.trang_thai.in_(("queued", "running")))
            .all()
        )
        for job in interrupted_jobs:
            job.trang_thai = "failed"
            job.ket_thuc_luc = datetime.now(timezone.utc)
            job.thong_bao_loi = "Tiến trình bị gián đoạn khi backend khởi động lại."
        if interrupted_jobs:
            db.commit()
    finally:
        db.close()
    yield


app = FastAPI(
    title="HeThongCarbon API",
    description="Dịch vụ thu thập và cung cấp dữ liệu Carbon Intensity.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(admin_router)
app.include_router(public_router)


@app.get("/health", tags=["Hệ thống"])
def health_check():
    return {"status": "ok"}