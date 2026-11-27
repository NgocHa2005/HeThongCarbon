from datetime import UTC, datetime, timedelta

import pandas as pd
from config.settings import GLOBAL_REGION_ID
from models import AggDecompositionResample, FactCarbonReading
from sqlalchemy.orm import Session

from sqlalchemy import func


def lay_du_lieu(db: Session):
    return db.query(FactCarbonReading).filter(
        FactCarbonReading.RegionId == GLOBAL_REGION_ID
    )


def dashboard(db: Session):
    # Lấy bản ghi mới nhất
    hien_tai = (
        lay_du_lieu(db)
        .filter(FactCarbonReading.FromTime <= datetime.now(UTC))
        .order_by(FactCarbonReading.FromTime.desc())
        .first()
    )

    if hien_tai is None:
        return {
            "hien_tai": None,
            "hom_nay": None,
        }

    # Xác định thời điểm bắt đầu ngày hôm nay theo UTC
    hom_nay_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

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
            "den_thoi_diem": hien_tai.ToTime,
            "cap_nhat_luc": hien_tai.IngestedAt,
            "thoi_gian": hien_tai.FromTime,
            "cuong_do": (
                hien_tai.IntensityActual
                if hien_tai.IntensityActual is not None
                else hien_tai.IntensityForecast
            ),
            "muc_do": hien_tai.IntensityIndex,
            "nguon_du_lieu": (
                "Thực tế" if hien_tai.IntensityActual is not None else "Dự báo"
            ),
        },
        "hom_nay": {
            "so_ban_ghi": len(gia_tri),
            "trung_binh": round(sum(gia_tri) / len(gia_tri), 2) if gia_tri else None,
            "cao_nhat": max(gia_tri) if gia_tri else None,
            "thap_nhat": min(gia_tri) if gia_tri else None,
            "chuoi": [
                {
                    "thoi_gian": r.FromTime,
                    "thuc_te": r.IntensityActual,
                    "du_bao": r.IntensityForecast,
                }
                for r in du_lieu_hom_nay
            ],
        },
    }


def bien_dong(db: Session, kieu: str):
    # Lấy thời điểm mới nhất trong database làm mốc
    moi_nhat = lay_du_lieu(db).order_by(FactCarbonReading.FromTime.desc()).first()

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
            moc_ngay - timedelta(days=6), datetime.min.time(), tzinfo=UTC
        )
        bat_dau_truoc = bat_dau - khoang
    elif kieu == "thang":
        khoang = timedelta(days=30)
        bat_dau = datetime.combine(
            moc_ngay - timedelta(days=29), datetime.min.time(), tzinfo=UTC
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
            FactCarbonReading.IntensityActual.isnot(None),
        )
        .order_by(FactCarbonReading.FromTime.asc())
        .all()
    )

    hien_tai = [row for row in rows if row.FromTime >= bat_dau]

    ky_truoc = [row for row in rows if row.FromTime < bat_dau]

    # Gom dữ liệu theo thời gian
    du_lieu = []

    if kieu == "ngay":
        du_lieu = [
            {"thoi_gian": row.FromTime, "cuong_do": row.IntensityActual}
            for row in hien_tai
        ]
    else:
        nhom_ngay = {}

        for row in hien_tai:
            ngay = row.FromTime.date()
            nhom_ngay.setdefault(ngay, []).append(row.IntensityActual)

        du_lieu = [
            {"ngay": ngay, "trung_binh": round(sum(gia_tri) / len(gia_tri), 2)}
            for ngay, gia_tri in sorted(nhom_ngay.items())
        ]

    # Tính xu hướng giữa hai kỳ
    gia_tri_hien_tai = [row.IntensityActual for row in hien_tai]
    gia_tri_truoc = [row.IntensityActual for row in ky_truoc]

    if gia_tri_hien_tai and gia_tri_truoc:
        tb_hien_tai = sum(gia_tri_hien_tai) / len(gia_tri_hien_tai)
        tb_truoc = sum(gia_tri_truoc) / len(gia_tri_truoc)

        if tb_truoc != 0:
            phan_tram = ((tb_hien_tai - tb_truoc) / tb_truoc) * 100

            if phan_tram > 5:
                ket_luan = "Tăng"
            elif phan_tram < -5:
                ket_luan = "Giảm"
            else:
                ket_luan = "Ổn định"

            xu_huong = {"phan_tram": round(phan_tram, 2), "ket_luan": ket_luan}
        else:
            xu_huong = None
    else:
        xu_huong = None

    return {
        "kieu": kieu,
        "don_vi": "gCO2/kWh",
        "du_lieu": du_lieu,
        "so_diem": len(du_lieu),
        "xu_huong": xu_huong,
    }


def phan_bo(db: Session, kieu: str):
    # Xác định khoảng thời gian
    so_ngay = {"ngay": 1, "tuan": 7, "thang": 30}

    if kieu not in so_ngay:
        return {"du_lieu": [], "trung_binh_theo_gio": []}

    moi_nhat = lay_du_lieu(db).order_by(FactCarbonReading.FromTime.desc()).first()

    if moi_nhat is None:
        return {"du_lieu": [], "trung_binh_theo_gio": []}

    bat_dau = moi_nhat.FromTime - timedelta(days=so_ngay[kieu])

    rows = (
        lay_du_lieu(db)
        .filter(
            FactCarbonReading.FromTime >= bat_dau,
            FactCarbonReading.FromTime <= moi_nhat.FromTime,
            FactCarbonReading.IntensityActual.isnot(None),
            FactCarbonReading.HourOfDay.isnot(None),
        )
        .order_by(FactCarbonReading.FromTime.asc())
        .all()
    )

    # Dữ liệu điểm phân tán
    du_lieu = [
        {
            "thoi_gian": row.FromTime,
            "gio": row.HourOfDay,
            "cuong_do": row.IntensityActual,
        }
        for row in rows
    ]

    # Gom cường độ theo từng giờ
    nhom_gio = {}

    for row in rows:
        nhom_gio.setdefault(row.HourOfDay, []).append(row.IntensityActual)

    trung_binh_theo_gio = [
        {"gio": gio, "trung_binh": round(sum(gia_tri) / len(gia_tri), 2)}
        for gio, gia_tri in sorted(nhom_gio.items())
    ]

    return {
        "kieu": kieu,
        "don_vi": "gCO2/kWh",
        "du_lieu": du_lieu,
        "trung_binh_theo_gio": trung_binh_theo_gio,
        "so_diem": len(du_lieu),
    }


def tan_suat(db: Session, kieu: str):
    so_ngay = {"ngay": 1, "tuan": 7, "thang": 30}

    if kieu not in so_ngay:
        return {"cac_khoang": [], "tong_so": 0}

    moi_nhat = lay_du_lieu(db).order_by(FactCarbonReading.FromTime.desc()).first()

    if moi_nhat is None:
        return {"cac_khoang": [], "tong_so": 0}

    bat_dau = moi_nhat.FromTime - timedelta(days=so_ngay[kieu])

    rows = (
        lay_du_lieu(db)
        .filter(
            FactCarbonReading.FromTime >= bat_dau,
            FactCarbonReading.FromTime <= moi_nhat.FromTime,
            FactCarbonReading.IntensityActual.isnot(None),
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
        {"khoang": nhan, "so_luong": so_luong}
        for nhan, so_luong in sorted(
            cac_khoang.items(), key=lambda item: int(item[0].split("-")[0])
        )
    ]

    return {
        "kieu": kieu,
        "don_vi": "gCO2/kWh",
        "do_rong_khoang": 20,
        "cac_khoang": ket_qua,
        "tong_so": len(rows),
    }


CHU_KY_STL = {"thang": 12, "tuan": 52}  # period của STL = một năm
DON_VI_KY = {"thang": "tháng", "tuan": "tuần"}
TY_LE_TOI_THIEU = (
    0.8  # ít nhất 80% số kỳ phải có số liệu thật, phần còn lại mới được nội suy
)


def _doc_chuoi_thuc_te(db: Session) -> pd.Series:
    """Toàn bộ IntensityActual (bỏ NULL) của cả GB, chỉ số là thời gian UTC."""
    hang = (
        lay_du_lieu(db)
        .filter(FactCarbonReading.IntensityActual.isnot(None))
        .with_entities(FactCarbonReading.FromTime, FactCarbonReading.IntensityActual)
        .order_by(FactCarbonReading.FromTime.asc())
        .all()
    )
    if not hang:
        return pd.Series(dtype=float)
    thoi_gian = pd.to_datetime([h[0] for h in hang], utc=True)
    return pd.Series([float(h[1]) for h in hang], index=thoi_gian)


def _gom_trung_vi(chuoi: pd.Series, kieu: str) -> pd.Series:
    """Gom số đo 30 phút về trung vị theo tháng, hoặc theo tuần (bắt đầu thứ Hai)."""
    if kieu == "thang":
        return chuoi.resample("MS").median()
    return chuoi.resample("W-MON", closed="left", label="left").median()


def phan_ra(chuoi: pd.Series, kieu: str) -> pd.DataFrame:
    """STL cộng: Observed = Trend + Seasonal + Residual.

    Ném ValueError (có lý do rõ ràng) nếu chưa đủ dữ liệu.
    """
    chu_ky = CHU_KY_STL[kieu]
    don_vi = DON_VI_KY[kieu]
    if chuoi.empty:
        raise ValueError("Chưa có số liệu thực tế nào để phân rã.")

    gom = _gom_trung_vi(chuoi, kieu).iloc[:-1]  # bỏ kỳ cuối vì chưa kết thúc
    co_so_lieu = gom.dropna()
    if len(co_so_lieu) < 2 * chu_ky:
        raise ValueError(
            f"Cần tối thiểu {2 * chu_ky} {don_vi} có số liệu thật, "
            f"hiện mới có {len(co_so_lieu)}."
        )

    gom = gom.loc[co_so_lieu.index[0] : co_so_lieu.index[-1]]
    if len(co_so_lieu) < TY_LE_TOI_THIEU * len(gom):
        raise ValueError(
            f"Dữ liệu bị thiếu nhiều quãng: chỉ có {len(co_so_lieu)}/{len(gom)} "
            f"{don_vi} có số liệu thật."
        )
    gom = gom.interpolate()

    # Thư viện nặng nên chỉ nạp khi đã đủ dữ liệu
    from statsmodels.tsa.seasonal import STL

    kq = STL(gom, period=chu_ky, robust=True).fit()
    return pd.DataFrame(
        {
            "observed": gom,
            "trend": kq.trend,
            "seasonal": kq.seasonal,
            "resid": kq.resid,
        }
    )


def _nhan_ky(moc: pd.Timestamp, kieu: str) -> str:
    if kieu == "thang":
        return f"Tháng {moc.month}/{moc.year}"
    iso = moc.isocalendar()
    return f"Tuần {iso.week}/{iso.year}"


def tinh_va_luu_phan_ra(db: Session, kieu: str) -> int:
    """Tính phân rã và ghi đè các dòng của `kieu` trong bảng. Trả về số dòng đã ghi.

    Nếu chưa đủ dữ liệu thì ném ValueError và KHÔNG đụng đến dữ liệu cũ trong bảng.
    """
    bang = phan_ra(_doc_chuoi_thuc_te(db), kieu)
    bay_gio = datetime.now(UTC)

    db.query(AggDecompositionResample).filter(
        AggDecompositionResample.PeriodType == kieu
    ).delete(synchronize_session=False)
    db.add_all(
        [
            AggDecompositionResample(
                PeriodType=kieu,
                PeriodStartDate=moc.date(),
                PeriodLabel=_nhan_ky(moc, kieu),
                ResampleMedian=float(h["observed"]),
                TrendComponent=float(h["trend"]),
                SeasonalComponent=float(h["seasonal"]),
                ResidualComponent=float(h["resid"]),
                ComputedAt=bay_gio,
            )
            for moc, h in bang.iterrows()
        ]
    )
    db.commit()
    return len(bang)


def doc_phan_ra(db: Session, kieu: str) -> dict | None:
    """Đọc kết quả đã lưu. Bảng trống (chưa tính hoặc đã bị xóa) thì trả None."""
    dong = (
        db.query(AggDecompositionResample)
        .filter(AggDecompositionResample.PeriodType == kieu)
        .order_by(AggDecompositionResample.PeriodStartDate.asc())
        .all()
    )
    if not dong:
        return None

    bang = pd.DataFrame(
        {
            "thang": [d.PeriodStartDate.month for d in dong],
            "trend": [d.TrendComponent for d in dong],
            "seasonal": [d.SeasonalComponent for d in dong],
            "resid": [d.ResidualComponent for d in dong],
        }
    )
    trend_dau, trend_cuoi = float(bang["trend"].iloc[0]), float(bang["trend"].iloc[-1])
    thay_doi = (trend_cuoi - trend_dau) / trend_dau * 100 if trend_dau else None
    theo_thang = bang.groupby("thang")["seasonal"].mean()
    nguong = 2 * bang["resid"].std()

    return {
        "kieu": kieu,
        "tinh_luc": max(d.ComputedAt for d in dong),
        "diem": [
            {
                "nhan": d.PeriodLabel,
                "observed": round(d.ResampleMedian, 2),
                "trend": round(d.TrendComponent, 2),
                "seasonal": round(d.SeasonalComponent, 2),
                "resid": round(d.ResidualComponent, 2),
            }
            for d in dong
        ],
        "thong_ke": {
            "thay_doi_trend_phan_tram": None
            if thay_doi is None
            else round(thay_doi, 1),
            "chenh_dong_he": round(float(theo_thang.max() - theo_thang.min()), 1),
            "so_bat_thuong": 0
            if pd.isna(nguong)
            else int((bang["resid"].abs() > nguong).sum()),
        },
    }


THU_TU_MUC = ["very low", "low", "moderate", "high", "very high"]
TEN_MUC = {
    "very low": "Rất thấp",
    "low": "Thấp",
    "moderate": "Trung bình",
    "high": "Cao",
    "very high": "Rất cao",
}

NGUONG_NESO = {
    2024: [0, 35, 110, 190, 270],
    2025: [0, 30, 100, 180, 250],
    2026: [0, 25, 90, 170, 230],
    2027: [0, 20, 80, 160, 210],
}

def thang_muc(db: Session):
    moi_nhat = lay_du_lieu(db).order_by(FactCarbonReading.FromTime.desc()).first()
    nam = moi_nhat.FromTime.year if moi_nhat else datetime.now(UTC).year
    nam_dung = min(NGUONG_NESO, key=lambda n: abs(n - nam))

    cac_muc = [
        {"khoa": khoa, "ten": TEN_MUC[khoa], "tu": tu, "den": None, "so_ban_ghi": None}
        for khoa, tu in zip(THU_TU_MUC, NGUONG_NESO[nam_dung])
    ]
    return {
        "don_vi": "gCO2/kWh",
        "nam": nam_dung,
        "nguon": "NESO Carbon Intensity API",
        "cac_muc": cac_muc,
    }