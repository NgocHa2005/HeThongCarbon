import React, { useEffect, useState } from "react";
import {
  BatteryCharging,
  ChevronRight,
  Clock,
  History,
  LayoutGrid,
  Map as BanDo,
  Menu,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import ThanhDieuHuong from "../thanhPhan/chung/ThanhDieuHuong";
import BieuDoPhanCumKMeans from "../thanhPhan/khaiPha/BieuDoPhanCumKMeans";
import BieuDoDuBaoNgayMai from "../thanhPhan/khaiPha/BieuDoDuBaoNgayMai";

import TheChiSoThoiGianThuc from "../thanhPhan/trangChu/TheChiSoThoiGianThuc";
import BieuDoChuoiThoiGian from "../thanhPhan/trangChu/BieuDoChuoiThoiGian";
import BieuDoPhanTan from "../thanhPhan/trangChu/BieuDoPhanTan";
import BieuDoTanSuat from "../thanhPhan/trangChu/BieuDoTanSuat";
import BieuDoPhanRa from "../thanhPhan/trangChu/BieuDoPhanRa";
import "../thanhPhan/trangChu/phanTich.css";

const MUC = [
  {
    ma: "tong-quan",
    ten: "Tổng quan lưới điện",
    Icon: LayoutGrid,
    chucNang: true,
    nhan: "TELEMETRY QUỐC GIA · TRỰC TIẾP",
    tieuDe: "Tổng quan cường độ carbon thời gian thực",
    mota: "Cường độ phát thải carbon (gCO₂/kWh) và diễn biến trong ngày của lưới điện Great Britain.",
  },
  {
    ma: "du-bao-sac-ev",
    ten: "Dự báo & Sạc EV",
    Icon: BatteryCharging,
    chucNang: false,
    mota: "Gợi ý thời điểm sạc xe điện",
  },
  {
    ma: "khu-vuc-nguon-dien",
    ten: "Khu vực & nguồn điện",
    Icon: BanDo,
    chucNang: false,
    mota: "Cơ cấu nguồn điện và cường độ theo vùng",
  },
  {
    ma: "thong-ke-lich-su",
    ten: "Thống kê lịch sử",
    Icon: History,
    chucNang: true,
    nhan: "PHÂN TÍCH LỊCH SỬ",
    tieuDe: "Thống kê lịch sử cường độ carbon",
    mota: "Biến động, phân bố theo giờ, tần suất, xu hướng và mùa vụ của lưới điện GB.",
  },
  {
    ma: "kham-pha-ai",
    ten: "Khám phá tri thức AI",
    Icon: Sparkles,
    chucNang: true,
    nhan: "KHAI PHÁ DỮ LIỆU",
    tieuDe: "Khám phá tri thức AI",
    mota: "Phân cụm ngày bằng K-Means và dự báo cường độ carbon ngày mai.",
  },
];
const MUC_MAC_DINH = MUC[0].ma;

function docMucTuDiaChi() {
  const ma = window.location.hash.replace(/^#\//, "");
  return MUC.some((m) => m.ma === ma && m.chucNang) ? ma : MUC_MAC_DINH;
}

function DongHoUtc() {
  const [gio, setGio] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setGio(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="kd-dong-ho">
      <Clock size={14} /> {gio.toISOString().slice(11, 19)} UTC
    </span>
  );
}

function HangTheDieuHuong() {
  return (
    <div className="hang-the-dieu-huong">
      {MUC.filter((m) => m.ma !== MUC_MAC_DINH).map(({ ma, ten, mota, Icon, chucNang }) =>
        chucNang ? (
          <a key={ma} className="the-dieu-huong" href={`#/${ma}`}>
            <Icon size={18} />
            <strong>{ten}</strong>
            <span>{mota}</span>
          </a>
        ) : (
          <div key={ma} className="the-dieu-huong the-dieu-huong-tat" aria-disabled="true">
            <Icon size={18} />
            <strong>
              {ten} <em className="kd-nhan kd-nhan-xam">Sắp có</em>
            </strong>
            <span>{mota}</span>
          </div>
        )
      )}
    </div>
  );
}

export default function TrangDashboardCongKhai() {
  const [ma, setMa] = useState(docMucTuDiaChi);
  const [moSider, setMoSider] = useState(false);
  const [lanLamMoi, setLanLamMoi] = useState(0);

  useEffect(() => {
    const doiMuc = () => {
      setMa(docMucTuDiaChi());
      setMoSider(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", doiMuc);
    return () => window.removeEventListener("hashchange", doiMuc);
  }, []);

  const muc = MUC.find((m) => m.ma === ma);

  let noiDung;
  if (ma === "tong-quan") {
    noiDung = (
      <>
        <TheChiSoThoiGianThuc key={lanLamMoi} />
        <HangTheDieuHuong />
      </>
    );
  } else if (ma === "thong-ke-lich-su") {
    noiDung = (
      <div className="luoi-thong-ke">
        <BieuDoChuoiThoiGian />
        <BieuDoPhanTan />
        <BieuDoTanSuat />
        <BieuDoPhanRa />
      </div>
    );
  } else {
    noiDung = (
      <>
        <BieuDoPhanCumKMeans />
        <BieuDoDuBaoNgayMai />
      </>
    );
  }

  return (
    <div className="kd-goc">
      <ThanhDieuHuong
        danhSach={MUC}
        dangChon={ma}
        dangMo={moSider}
        onDong={() => setMoSider(false)}
      />
      {moSider && <div className="kd-che" onClick={() => setMoSider(false)} aria-hidden="true" />}

      <div className="kd-noi-dung">
        <header className="kd-thanh-tren">
          <div className="kd-trai">
            <button
              type="button"
              className="kd-nut-menu"
              onClick={() => setMoSider((v) => !v)}
              aria-label={moSider ? "Đóng menu" : "Mở menu"}
              aria-expanded={moSider}
            >
              {moSider ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="kd-duong-dan">
              ECO-GRID <ChevronRight size={14} /> <strong>{muc.ten}</strong>
            </div>
          </div>
          <div className="kd-ben-phai">
            <DongHoUtc />
            <div className="kd-chuyen-che-do">
              <a className="kd-che-do kd-che-do-chon" href="/">
                Public Dashboard
              </a>
              <a className="kd-che-do" href="/admin">
                Admin DataOps
              </a>
            </div>
          </div>
        </header>

        <main className="kd-trang">
          <section className="kd-hero">
            <div>
              <span className="kd-hero-nhan">{muc.nhan}</span>
              <h1>{muc.tieuDe}</h1>
              <p>{muc.mota}</p>
            </div>
            {ma === "tong-quan" && (
              <button
                type="button"
                className="kd-nut-chinh"
                onClick={() => setLanLamMoi((n) => n + 1)}
              >
                <RefreshCw size={16} /> Làm mới
              </button>
            )}
          </section>
          {noiDung}
        </main>
      </div>
    </div>
  );
}