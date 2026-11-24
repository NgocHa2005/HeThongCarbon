import asyncio
from datetime import datetime, timezone

from backend.config.database import SessionLocal
from backend.services.caoDuLieu_service import (
    thu_thap_du_lieu,
    thu_thap_khoang_thoi_gian,
)
from models import luotThuThap


def tao_luot_thu_thap(nguoi_kich_hoat: str) -> int:
    db = SessionLocal()
    try:
        job = luotThuThap(
            nguoi_kich_hoat=nguoi_kich_hoat,
            trang_thai="QUEUED",
            so_ban_ghi_them=0,
            so_ban_ghi_cap_nhat=0,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job.id
    finally:
        db.close()


def thuc_hien_luot_thu_thap(
    run_id: int,
    mode: str,
    bat_dau: datetime | None = None,
    ket_thuc: datetime | None = None,
) -> bool:
    db = SessionLocal()
    try:
        job = db.get(luotThuThap, run_id)
        if job is None:
            raise RuntimeError(f"Không tìm thấy phiên thu thập {run_id}.")
        job.trang_thai = "RUNNING"
        db.commit()

        if mode == "collect":
            result = asyncio.run(thu_thap_du_lieu(db))
        elif mode == "backfill" and bat_dau is not None and ket_thuc is not None:
            def cap_nhat_so_lieu(partial_result):
                current_job = db.get(luotThuThap, run_id)
                if current_job is not None:
                    current_job.so_ban_ghi_them = partial_result.inserted
                    current_job.so_ban_ghi_cap_nhat = partial_result.updated
                    db.commit()

            result = asyncio.run(
                thu_thap_khoang_thoi_gian(
                    db,
                    bat_dau,
                    ket_thuc,
                    cap_nhat_ket_qua=cap_nhat_so_lieu,
                )
            )
        else:
            raise ValueError("Chế độ thu thập hoặc khoảng thời gian không hợp lệ.")

        job = db.get(luotThuThap, run_id)
        job.trang_thai = "SUCCESS"
        job.so_ban_ghi_them = result.inserted
        job.so_ban_ghi_cap_nhat = result.updated
        job.thong_bao_loi = None
        return True
    except Exception as exc:
        db.rollback()
        job = db.get(luotThuThap, run_id)
        if job is not None:
            job.trang_thai = "FAILED"
            job.thong_bao_loi = f"Thu thập thất bại ({type(exc).__name__}): {exc}"
        return False
    finally:
        job = db.get(luotThuThap, run_id)
        if job is not None:
            job.ket_thuc_luc = datetime.now(timezone.utc)
            db.commit()
        db.close()
