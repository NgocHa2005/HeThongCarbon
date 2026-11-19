import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from cauHinh.ketNoiDb import lay_phien_db
from dichVu.dichVuCaoDuLieu import thu_thap_du_lieu
from moHinhDl import LuotThuThap

router = APIRouter(prefix="/api/v1/admin", tags=["Quản trị"])


def _tao_ket_qua(job: LuotThuThap) -> dict:
    duration = None
    if job.ket_thuc_luc is not None:
        duration = round((job.ket_thuc_luc - job.bat_dau_luc).total_seconds(), 3)
    return {
        "job_id": str(job.id),
        "started_at": job.bat_dau_luc,
        "completed_at": job.ket_thuc_luc,
        "status": job.trang_thai,
        "stage": None,
        "records_processed": job.so_ban_ghi_them + job.so_ban_ghi_cap_nhat,
        "records_inserted": job.so_ban_ghi_them,
        "records_updated": job.so_ban_ghi_cap_nhat,
        "duration_seconds": duration,
        "message": job.thong_bao_loi,
    }


@router.get("/status")
def lay_trang_thai(db: Session = Depends(lay_phien_db)):
    job = db.query(LuotThuThap).order_by(LuotThuThap.bat_dau_luc.desc()).first()
    if job is None:
        return {
            "job_id": None,
            "started_at": None,
            "completed_at": None,
            "status": "idle",
            "stage": None,
            "records_processed": 0,
            "records_inserted": 0,
            "records_updated": 0,
            "duration_seconds": None,
            "message": None,
        }
    return _tao_ket_qua(job)


@router.get("/history")
def lay_lich_su(
    limit: int = 100,
    db: Session = Depends(lay_phien_db),
):
    jobs = (
        db.query(LuotThuThap)
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .limit(min(max(limit, 1), 500))
        .all()
    )
    return {"items": [_tao_ket_qua(job) for job in jobs]}


def _chay_tien_trinh(run_id: int) -> None:
    from cauHinh.ketNoiDb import SessionLocal

    db = SessionLocal()
    try:
        job = db.get(LuotThuThap, run_id)
        if job is None:
            return
        job.trang_thai = "running"
        db.commit()

        result = asyncio.run(thu_thap_du_lieu(db))
        job = db.get(LuotThuThap, run_id)
        if job is not None:
            job.trang_thai = "succeeded"
            job.so_ban_ghi_them = result.inserted
            job.so_ban_ghi_cap_nhat = result.updated
            job.thong_bao_loi = None
    except Exception as exc:
        db.rollback()
        job = db.get(LuotThuThap, run_id)
        if job is not None:
            job.trang_thai = "failed"
            job.thong_bao_loi = f"Thu thập thất bại ({type(exc).__name__}): {exc}"
    finally:
        job = db.get(LuotThuThap, run_id)
        if job is not None:
            job.ket_thuc_luc = datetime.now(timezone.utc)
            db.commit()
        db.close()


@router.post("/collect", status_code=202)
def kich_hoat_thu_thap(
    background_tasks: BackgroundTasks,
    db: Session = Depends(lay_phien_db),
):
    active_job = (
        db.query(LuotThuThap)
        .filter(LuotThuThap.trang_thai.in_(("queued", "running")))
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .first()
    )
    if active_job is not None:
        return _tao_ket_qua(active_job)

    job = LuotThuThap(
        nguoi_kich_hoat="admin",
        trang_thai="queued",
        so_ban_ghi_them=0,
        so_ban_ghi_cap_nhat=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(_chay_tien_trinh, job.id)
    return _tao_ket_qua(job)
