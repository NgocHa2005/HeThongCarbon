
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from config.settings import GLOBAL_REGION_ID
from models import FactCarbonReading

from datetime import datetime, timedelta, timezone


def lay_du_lieu(db: Session):
    return (
        db.query(FactCarbonReading)
        .filter(FactCarbonReading.RegionId == GLOBAL_REGION_ID)
    )


def dashboard(db: Session):
    # Lấy bản ghi mới nhất
    hien_tai = (
        lay_du_lieu(db)
        .order_by(FactCarbonReading.FromTime.desc())
        .first()
    )

    if hien_tai is None:
        return {
            "hien_tai": None,
            "hom_nay": None,
        }

    # Xác định thời điểm bắt đầu ngày hôm nay theo UTC
    hom_nay_utc = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # Lấy dữ liệu trong ngày
    du_lieu_hom_nay = (
        lay_du_lieu(db)
        .filter(FactCarbonReading.FromTime >= hom_nay_utc)
        .order_by(FactCarbonReading.FromTime.asc())
        .all()
    )

    # Actual có ưu tiên; nếu NULL thì dùng Forecast
    gia_tri = [
        row.IntensityActual
        if row.IntensityActual is not None
        else row.IntensityForecast
        for row in du_lieu_hom_nay
    ]

    return {
        "hien_tai": {
            "thoi_gian": hien_tai.FromTime,
            "cuong_do": (
                hien_tai.IntensityActual
                if hien_tai.IntensityActual is not None
                else hien_tai.IntensityForecast
            ),
            "muc_do": hien_tai.IntensityIndex,
            "nguon_du_lieu": (
                "Thực tế"
                if hien_tai.IntensityActual is not None
                else "Dự báo"
            ),
        },
        "hom_nay": {
            "so_ban_ghi": len(gia_tri),
            "trung_binh": round(sum(gia_tri) / len(gia_tri), 2)
            if gia_tri else None,
            "cao_nhat": max(gia_tri) if gia_tri else None,
            "thap_nhat": min(gia_tri) if gia_tri else None,
        },
    }


def bien_dong(db: Session, kieu: str):
    # Lấy thời điểm mới nhất trong database làm mốc
    moi_nhat = (
        lay_du_lieu(db)
        .order_by(FactCarbonReading.FromTime.desc())
        .first()
    )

    if moi_nhat is None:
        return {"du_lieu": [], "xu_huong": None}

    moc_thoi_gian = moi_nhat.FromTime
    moc_ngay = moc_thoi_gian.date()

    # Xác định khoảng thời gian cần lấy
    if kieu == "ngay":
        khoang = timedelta(days=1)
        bat_dau = moc_thoi_gian - khoang
        bat_dau_truoc = bat_dau - khoang
    elif kieu == "tuan":
        khoang = timedelta(days=7)
        bat_dau = datetime.combine(
            moc_ngay - timedelta(days=6), datetime.min.time(),
            tzinfo=timezone.utc
        )
        bat_dau_truoc = bat_dau - khoang
    elif kieu == "thang":
        khoang = timedelta(days=30)
        bat_dau = datetime.combine(
            moc_ngay - timedelta(days=29), datetime.min.time(),
            tzinfo=timezone.utc
        )
        bat_dau_truoc = bat_dau - khoang
    else:
        return {"du_lieu": [], "xu_huong": None}

    # Lấy dữ liệu của kỳ hiện tại và kỳ trước
    rows = (
        lay_du_lieu(db)
        .filter(
            FactCarbonReading.FromTime >= bat_dau_truoc,
            FactCarbonReading.FromTime <= moc_thoi_gian,
            FactCarbonReading.IntensityActual.isnot(None)
        )
        .order_by(FactCarbonReading.FromTime.asc())
        .all()
    )

    hien_tai = [
        row for row in rows
        if row.FromTime >= bat_dau
    ]

    ky_truoc = [
        row for row in rows
        if row.FromTime < bat_dau
    ]

    # Gom dữ liệu theo thời gian
    du_lieu = []

    if kieu == "ngay":
        du_lieu = [
            {
                "thoi_gian": row.FromTime,
                "cuong_do": row.IntensityActual
            }
            for row in hien_tai
        ]
    else:
        nhom_ngay = {}

        for row in hien_tai:
            ngay = row.FromTime.date()
            nhom_ngay.setdefault(ngay, []).append(
                row.IntensityActual
            )

        du_lieu = [
            {
                "ngay": ngay,
                "trung_binh": round(
                    sum(gia_tri) / len(gia_tri), 2
                )
            }
            for ngay, gia_tri in sorted(nhom_ngay.items())
        ]

    # Tính xu hướng giữa hai kỳ
    gia_tri_hien_tai = [
        row.IntensityActual for row in hien_tai
    ]
    gia_tri_truoc = [
        row.IntensityActual for row in ky_truoc
    ]

    if gia_tri_hien_tai and gia_tri_truoc:
        tb_hien_tai = sum(gia_tri_hien_tai) / len(gia_tri_hien_tai)
        tb_truoc = sum(gia_tri_truoc) / len(gia_tri_truoc)

        if tb_truoc != 0:
            phan_tram = (
                (tb_hien_tai - tb_truoc) / tb_truoc
            ) * 100

            if phan_tram > 5:
                ket_luan = "Tăng"
            elif phan_tram < -5:
                ket_luan = "Giảm"
            else:
                ket_luan = "Ổn định"

            xu_huong = {
                "phan_tram": round(phan_tram, 2),
                "ket_luan": ket_luan
            }
        else:
            xu_huong = None
    else:
        xu_huong = None

    return {
        "kieu": kieu,
        "don_vi": "gCO2/kWh",
        "du_lieu": du_lieu,
        "so_diem": len(du_lieu),
        "xu_huong": xu_huong
    }


def phan_bo(db: Session, kieu: str):
    # Xác định khoảng thời gian
    so_ngay = {
        "ngay": 1,
        "tuan": 7,
        "thang": 30
    }

    if kieu not in so_ngay:
        return {"du_lieu": [], "trung_binh_theo_gio": []}

    moi_nhat = (
        lay_du_lieu(db)
        .order_by(FactCarbonReading.FromTime.desc())
        .first()
    )

    if moi_nhat is None:
        return {"du_lieu": [], "trung_binh_theo_gio": []}

    bat_dau = moi_nhat.FromTime - timedelta(days=so_ngay[kieu])

    rows = (
        lay_du_lieu(db)
        .filter(
            FactCarbonReading.FromTime >= bat_dau,
            FactCarbonReading.FromTime <= moi_nhat.FromTime,
            FactCarbonReading.IntensityActual.isnot(None),
            FactCarbonReading.HourOfDay.isnot(None)
        )
        .order_by(FactCarbonReading.FromTime.asc())
        .all()
    )

    # Dữ liệu điểm phân tán
    du_lieu = [
        {
            "thoi_gian": row.FromTime,
            "gio": row.HourOfDay,
            "cuong_do": row.IntensityActual
        }
        for row in rows
    ]

    # Gom cường độ theo từng giờ
    nhom_gio = {}

    for row in rows:
        nhom_gio.setdefault(row.HourOfDay, []).append(
            row.IntensityActual
        )

    trung_binh_theo_gio = [
        {
            "gio": gio,
            "trung_binh": round(sum(gia_tri) / len(gia_tri), 2)
        }
        for gio, gia_tri in sorted(nhom_gio.items())
    ]

    return {
        "kieu": kieu,
        "don_vi": "gCO2/kWh",
        "du_lieu": du_lieu,
        "trung_binh_theo_gio": trung_binh_theo_gio,
        "so_diem": len(du_lieu)
    }


def tan_suat(db: Session, kieu: str):
    so_ngay = {
        "ngay": 1,
        "tuan": 7,
        "thang": 30
    }

    if kieu not in so_ngay:
        return {"cac_khoang": [], "tong_so": 0}

    moi_nhat = (
        lay_du_lieu(db)
        .order_by(FactCarbonReading.FromTime.desc())
        .first()
    )

    if moi_nhat is None:
        return {"cac_khoang": [], "tong_so": 0}

    bat_dau = moi_nhat.FromTime - timedelta(days=so_ngay[kieu])

    rows = (
        lay_du_lieu(db)
        .filter(
            FactCarbonReading.FromTime >= bat_dau,
            FactCarbonReading.FromTime <= moi_nhat.FromTime,
            FactCarbonReading.IntensityActual.isnot(None)
        )
        .all()
    )

    # Tạo các khoảng có độ rộng cố định 20 gCO2/kWh
    cac_khoang = {}

    for row in rows:
        gia_tri = row.IntensityActual
        moc_duoi = (gia_tri // 20) * 20
        moc_tren = moc_duoi + 20

        nhan = f"{moc_duoi}-{moc_tren}"

        cac_khoang[nhan] = cac_khoang.get(nhan, 0) + 1

    ket_qua = [
        {
            "khoang": nhan,
            "so_luong": so_luong
        }
        for nhan, so_luong in sorted(
            cac_khoang.items(),
            key=lambda item: int(item[0].split("-")[0])
        )
    ]

    return {
        "kieu": kieu,
        "don_vi": "gCO2/kWh",
        "do_rong_khoang": 20,
        "cac_khoang": ket_qua,
        "tong_so": len(rows)
    }

