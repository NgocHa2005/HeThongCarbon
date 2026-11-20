from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config.database import Base, engine
from backend.config.settings import CORS_ORIGINS
from routers.tuyenCongKhai import router as public_router
from backend.routers.quanTri_router import router as admin_router
from models import DuLieuKhuVuc, LuotThuThap, SoLieuCarbon


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
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