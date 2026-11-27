"""Worker Data Analysis: tính phân rã Trend/Seasonal/Residual và ghi vào DB.

Chạy lặp mỗi 5 phút (theo sơ đồ khối của đề bài). API chỉ đọc bảng kết quả.

    python -m workers.analysis            # chạy lặp
    python -m workers.analysis --once     # tính một lần rồi thoát
    python -m workers.analysis --check    # chỉ kiểm tra entry point
"""
import argparse
import sys
import time
from datetime import UTC, datetime

CAC_KIEU = ("thang", "tuan")
CHU_KY_MAC_DINH = 300  # giây = 5 phút


def _ghi_log(noi_dung: str, ra_loi: bool = False) -> None:
    dau = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[{dau}] Data Analysis: {noi_dung}", file=sys.stderr if ra_loi else sys.stdout, flush=True)


def chay_mot_lan() -> int:
    """Tính lại phân rã cho từng kiểu. Trả về số kiểu đã ghi thành công."""
    # Nạp muộn để `--check` không cần kết nối DB hay nạp pandas/statsmodels
    from config.database import Base, SessionLocal, engine
    from services.phanTich_service import tinh_va_luu_phan_ra

    Base.metadata.create_all(bind=engine)  # tạo bảng nếu backend chưa kịp tạo
    thanh_cong = 0
    for kieu in CAC_KIEU:
        db = SessionLocal()
        try:
            so_dong = tinh_va_luu_phan_ra(db, kieu)
            _ghi_log(f"đã ghi {so_dong} dòng phân rã kiểu '{kieu}'.")
            thanh_cong += 1
        except ValueError as loi:
            # Thiếu dữ liệu lịch sử: không phải lỗi chương trình, bảng cũ được giữ nguyên
            _ghi_log(f"bỏ qua kiểu '{kieu}': {loi}")
        except Exception as loi:  # noqa: BLE001 - worker không được chết vì một lần lỗi
            db.rollback()
            _ghi_log(f"lỗi khi tính kiểu '{kieu}': {loi}", ra_loi=True)
        finally:
            db.close()
    return thanh_cong


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Worker Data Analysis (phân rã STL).")
    parser.add_argument("--once", action="store_true", help="Tính một lần rồi thoát.")
    parser.add_argument("--check", action="store_true", help="Chỉ kiểm tra entry point.")
    parser.add_argument(
        "--interval",
        type=int,
        default=CHU_KY_MAC_DINH,
        help="Số giây giữa hai lần tính (mặc định 300 = 5 phút).",
    )
    tham_so = parser.parse_args(argv)

    if tham_so.check:
        print("Data Analysis: entry point OK.")
        return 0

    if tham_so.once:
        return 0 if chay_mot_lan() > 0 else 1

    _ghi_log(f"bắt đầu, chu kỳ {tham_so.interval} giây.")
    try:
        while True:
            try:
                chay_mot_lan()
            except Exception as loi:  # noqa: BLE001 - mất kết nối DB thì thử lại ở lần sau
                _ghi_log(f"không chạy được: {loi}", ra_loi=True)
            time.sleep(tham_so.interval)
    except KeyboardInterrupt:
        _ghi_log("đã dừng.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())