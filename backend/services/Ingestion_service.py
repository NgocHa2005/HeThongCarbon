import asyncio
from datetime import datetime, timezone

from config.database import SessionLocal
from models import SysIngestionRun

from backend.services.caoDuLieu_service import (
    thu_thap_du_lieu,
    thu_thap_khoang_thoi_gian,
)


def tao_luot_thu_thap(nguoi_kich_hoat: str) -> int:
    db = SessionLocal()
    try:
        job = SysIngestionRun(
            TriggeredBy=nguoi_kich_hoat,
            Status="QUEUED",
            RecordsInserted=0,
            RecordsUpdated=0,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job.RunId
    finally:
        db.close()


def thuc_hien_luot_thu_thap(
    run_id: int,
    mode: str,
    bat_dau: datetime | None = None,
    ket_thuc: datetime | None = None,
) -> tuple[bool, str | None]:
    db = SessionLocal()
    try:
        job = db.get(SysIngestionRun, run_id)
        if job is None:
            raise RuntimeError(f"Không tìm thấy phiên thu thập {run_id}.")
        job.Status = "RUNNING"
        db.commit()

        if mode == "collect":
            result = asyncio.run(thu_thap_du_lieu(db))
        elif mode == "backfill" and bat_dau is not None and ket_thuc is not None:

            def cap_nhat_so_lieu(partial_result):
                current_job = db.get(SysIngestionRun, run_id)
                if current_job is not None:
                    current_job.RecordsInserted = partial_result.inserted
                    current_job.RecordsUpdated = partial_result.updated
                    current_job.ErrorMessage = (
                        "; ".join(partial_result.warnings) or None
                    )
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

        job = db.get(SysIngestionRun, run_id)
        job.Status = "SUCCESS"
        job.RecordsInserted = result.inserted
        job.RecordsUpdated = result.updated
        job.ErrorMessage = "; ".join(result.warnings) or None
        return True, job.ErrorMessage
    except Exception as exc:
        db.rollback()
        job = db.get(SysIngestionRun, run_id)
        error_message = f"Thu thập thất bại ({type(exc).__name__}): {exc}"
        if job is not None:
            job.Status = "FAILED"
            job.ErrorMessage = error_message
        return False, error_message
    finally:
        job = db.get(SysIngestionRun, run_id)
        if job is not None:
            job.EndTime = datetime.now(timezone.utc)
            db.commit()
        db.close()
