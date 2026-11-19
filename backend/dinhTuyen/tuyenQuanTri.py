import asyncio
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from cauHinh.ketNoiDb import lay_phien_db
from dichVu.dichVuCaoDuLieu import thu_thap_du_lieu, thu_thap_lich_su_du_lieu
from moHinhDl import LuotThuThap
from cauHinh.thongSoChung import COLLECTION_INTERVAL_SECONDS

router = APIRouter(prefix="/api/v1/admin", tags=["Quản trị"])
_scheduler_lock = threading.Lock()
_scheduler_stop = threading.Event()
_scheduler_thread: threading.Thread | None = None


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


def _scheduler_dang_chay() -> bool:
    return _scheduler_thread is not None and _scheduler_thread.is_alive() and not _scheduler_stop.is_set()


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
            "auto_collect_enabled": _scheduler_dang_chay(),
            "collection_interval_seconds": COLLECTION_INTERVAL_SECONDS,
        }
    result = _tao_ket_qua(job)
    result["auto_collect_enabled"] = _scheduler_dang_chay()
    result["collection_interval_seconds"] = COLLECTION_INTERVAL_SECONDS
    return result


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


def _chay_backfill(run_id: int, so_ngay: int) -> None:
    from cauHinh.ketNoiDb import SessionLocal

    db = SessionLocal()
    try:
        job = db.get(LuotThuThap, run_id)
        if job is None:
            return
        job.trang_thai = "running"
        db.commit()
        result = asyncio.run(thu_thap_lich_su_du_lieu(db, so_ngay))
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
            job.thong_bao_loi = f"Cào lịch sử thất bại ({type(exc).__name__}): {exc}"
    finally:
        job = db.get(LuotThuThap, run_id)
        if job is not None:
            job.ket_thuc_luc = datetime.now(timezone.utc)
            db.commit()
        db.close()


def _tao_job(db: Session) -> LuotThuThap:
    job = LuotThuThap(
        nguoi_kich_hoat="admin",
        trang_thai="queued",
        so_ban_ghi_them=0,
        so_ban_ghi_cap_nhat=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _chay_lich_dinh_ky() -> None:
    from cauHinh.ketNoiDb import SessionLocal

    while not _scheduler_stop.wait(COLLECTION_INTERVAL_SECONDS):
        db = SessionLocal()
        try:
            active_job = (
                db.query(LuotThuThap)
                .filter(LuotThuThap.trang_thai.in_(("queued", "running")))
                .order_by(LuotThuThap.bat_dau_luc.desc())
                .first()
            )
            if active_job is None:
                job = _tao_job(db)
                threading.Thread(target=_chay_tien_trinh, args=(job.id,), daemon=True).start()
        finally:
            db.close()


def _bat_dau_lich_dinh_ky() -> None:
    global _scheduler_thread
    with _scheduler_lock:
        if _scheduler_dang_chay():
            return
        _scheduler_stop.clear()
        _scheduler_thread = threading.Thread(target=_chay_lich_dinh_ky, daemon=True)
        _scheduler_thread.start()


def _dung_lich_dinh_ky() -> None:
    _scheduler_stop.set()


@router.post("/collect", status_code=202)
def kich_hoat_thu_thap(
    background_tasks: BackgroundTasks,
    db: Session = Depends(lay_phien_db),
):
    _bat_dau_lich_dinh_ky()
    active_job = (
        db.query(LuotThuThap)
        .filter(LuotThuThap.trang_thai.in_(("queued", "running")))
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .first()
    )
    if active_job is not None:
        return _tao_ket_qua(active_job)

    job = _tao_job(db)
    background_tasks.add_task(_chay_tien_trinh, job.id)
    return _tao_ket_qua(job)


@router.post("/collect/stop")
def dung_thu_thap_dinh_ky(db: Session = Depends(lay_phien_db)):
    _dung_lich_dinh_ky()
    active_job = (
        db.query(LuotThuThap)
        .filter(LuotThuThap.trang_thai.in_(("queued", "running")))
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .first()
    )
    result = _tao_ket_qua(active_job) if active_job is not None else {
        "job_id": None,
        "status": "idle",
        "records_processed": 0,
        "records_inserted": 0,
        "records_updated": 0,
        "duration_seconds": None,
        "message": None,
    }
    result["auto_collect_enabled"] = False
    result["collection_interval_seconds"] = COLLECTION_INTERVAL_SECONDS
    return result


@router.post("/collect/history", status_code=202)
def kich_hoat_cao_lich_su(
    days: int = 730,
    db: Session = Depends(lay_phien_db),
):
    so_ngay = min(max(days, 1), 730)
    active_job = (
        db.query(LuotThuThap)
        .filter(LuotThuThap.trang_thai.in_(("queued", "running")))
        .order_by(LuotThuThap.bat_dau_luc.desc())
        .first()
    )
    if active_job is not None:
        return _tao_ket_qua(active_job)

    job = _tao_job(db)
    job.nguoi_kich_hoat = f"admin-history-{so_ngay}d"
    db.commit()
    threading.Thread(target=_chay_backfill, args=(job.id, so_ngay), daemon=True).start()
    return _tao_ket_qua(job)
