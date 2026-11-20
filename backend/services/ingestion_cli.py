import argparse
from datetime import datetime, time, timedelta, timezone

from backend.services.Ingestion_service import tao_luot_thu_thap, thuc_hien_luot_thu_thap


def _doc_ngay(value: str) -> datetime:
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Ngày phải có định dạng YYYY-MM-DD.") from exc
    return datetime.combine(parsed, time.min, tzinfo=timezone.utc)


def _phan_tich_tham_so(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Chạy một phiên thu thập Carbon Intensity.")
    parser.add_argument("--mode", choices=("collect", "backfill"), required=True)
    parser.add_argument("--source", choices=("schedule", "dispatch"), default="dispatch")
    parser.add_argument("--start-date", type=_doc_ngay)
    parser.add_argument("--end-date", type=_doc_ngay)
    arguments = parser.parse_args(argv)

    if arguments.mode == "backfill":
        if arguments.start_date is None or arguments.end_date is None:
            parser.error("Backfill cần cả --start-date và --end-date.")
        if arguments.end_date < arguments.start_date:
            parser.error("--end-date phải bằng hoặc sau --start-date.")
        if (arguments.end_date - arguments.start_date).days >= 730:
            parser.error("Khoảng backfill tối đa là 730 ngày.")
        arguments.end_exclusive = arguments.end_date + timedelta(days=1)
    elif arguments.start_date is not None or arguments.end_date is not None:
        parser.error("--start-date và --end-date chỉ dùng cho backfill.")
    return arguments


def _ma_kich_hoat(source: str, mode: str) -> str:
    return f"github-{source}-{mode}"


def main(argv: list[str] | None = None) -> int:
    arguments = _phan_tich_tham_so(argv)
    triggered_by = _ma_kich_hoat(arguments.source, arguments.mode)
    run_id = tao_luot_thu_thap(triggered_by)
    succeeded = thuc_hien_luot_thu_thap(
        run_id,
        arguments.mode,
        arguments.start_date,
        getattr(arguments, "end_exclusive", None),
    )
    if not succeeded:
        print(f"Phiên thu thập {run_id} thất bại; xem SYS_INGESTION_RUNS.")
        return 1
    print(f"Phiên thu thập {run_id} hoàn tất.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
