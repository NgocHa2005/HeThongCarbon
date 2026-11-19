import argparse
import sys


def run_worker(name: str, argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=f"Entry point cho worker {name}."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Kiểm tra entry point; không chạy thuật toán.",
    )
    arguments = parser.parse_args(argv)

    if arguments.check:
        print(f"{name}: entry point OK; thuật toán chưa được triển khai.")
        return 0

    print(
        f"{name}: chưa thể chạy vì thuật toán chưa được triển khai. "
        "Hãy bổ sung xử lý vào worker này trước khi chạy thật.",
        file=sys.stderr,
    )
    return 2
