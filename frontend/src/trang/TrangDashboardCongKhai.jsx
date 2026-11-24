import React, { useEffect, useState } from "react";
import { ChevronRight, Clock, Globe2, History, LayoutGrid, Sparkles } from "lucide-react";
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
    ten: "Tổng quan",
    Icon: LayoutGrid,
    mota: "Cường độ carbon hiện tại và diễn biến trong ngày",
  },
  {
    ma: "thong-ke-lich-su",
    ten: "Thống kê lịch sử",
    Icon: History,
    mota: "Biến động, phân bố theo giờ, tần suất, xu hướng và mùa vụ",
  },
  {
    ma: "kham-pha-ai",
    ten: "Khám phá tri thức AI",
    Icon: Sparkles,
    mota: "Phân cụm ngày K-Means và dự báo ngày mai",
  },
  {
    ma: "khu-vuc-nguon-dien",
    ten: "Khu vực & nguồn điện",
    Icon: Globe2,
    mota: "Cơ cấu nguồn điện và cường độ theo vùng",
  },
];
const MUC_MAC_DINH = MUC[0].ma;

function docMucTuDiaChi() {
  const ma = window.location.hash.replace(/^#\//, "");
  return MUC.some((m) => m.ma === ma) ? ma : MUC_MAC_DINH;
}

function DongHoUtc() {
  const [gio, setGio] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setGio(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="kd-dong-ho">
      <Clock size={14} /> {gio.toISOString().slice(11, 16)} UTC
    </span>
  );
}

function HangTheDieuHuong() {
  return (
    <div className="hang-the-dieu-huong">
      {MUC.filter((m) => m.ma !== MUC_MAC_DINH).map((m) => (
        <a key={m.ma} className="the-dieu-huong" href={`#/${m.ma}`}>
          <strong>{m.ten}</strong>
          <span>{m.mota}</span>
        </a>
      ))}
    </div>
  );
}

export default function TrangDashboardCongKhai({ trangNguonDien = null }) {
  const [ma, setMa] = useState(docMucTuDiaChi);

  useEffect(() => {
    const doiMuc = () => {
      setMa(docMucTuDiaChi());
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
        <TheChiSoThoiGianThuc />
        <HangTheDieuHuong />
      </>
    );
  } else if (ma === "thong-ke-lich-su") {
    noiDung = (
      <>
        <BieuDoChuoiThoiGian />
        <BieuDoPhanTan />
        <BieuDoTanSuat />
        <BieuDoPhanRa />
      </>
    );
  } else if (ma === "kham-pha-ai") {
    noiDung = (
      <>
        <BieuDoPhanCumKMeans />
        <BieuDoDuBaoNgayMai />
      </>
    );
  } else {
    noiDung = trangNguonDien;
  }

  return (
    <div className="kd-goc">
      <ThanhDieuHuong danhSach={MUC} dangChon={ma} />

      <div className="kd-noi-dung">
        <header className="kd-thanh-tren">
          <div className="kd-duong-dan">
            CarbonScope <ChevronRight size={14} /> <strong>{muc.ten}</strong>
          </div>
          <div className="kd-ben-phai">
            <DongHoUtc />
            <div className="kd-chuyen-che-do">
              <a className="kd-che-do kd-che-do-chon" href="/">
                Công khai
              </a>
              <a className="kd-che-do" href="/admin">
                Quản trị
              </a>
            </div>
          </div>
        </header>

        <main className="kd-trang page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                KHAI PHÁ DỮ LIỆU CARBON
              </div>
              <h1>{muc.ten}</h1>
              <p>{muc.mota} · lưới điện Great Britain (GB)</p>
            </div>
          </div>
          {noiDung}
        </main>
      </div>
    </div>
  );
}