import React from "react";
import BieuDoPhanCumKMeans from "../thanhPhan/khaiPha/BieuDoPhanCumKMeans";
import BieuDoDuBaoNgayMai from "../thanhPhan/khaiPha/BieuDoDuBaoNgayMai";

import TheChiSoThoiGianThuc from "../thanhPhan/trangChu/TheChiSoThoiGianThuc";
import BieuDoChuoiThoiGian from "../thanhPhan/trangChu/BieuDoChuoiThoiGian";
import BieuDoBocTach from "../thanhPhan/trangChu/BieuDoBocTach";
import BieuDoTanSuat from "../thanhPhan/trangChu/BieuDoTanSuat";
import BieuDoPhanRa from "../thanhPhan/trangChu/BieuDoPhanRa";

export default function TrangDashboardCongKhai() {
  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            KHAI PHÁ DỮ LIỆU CARBON
          </div>
          <h1>Phân tích cường độ carbon</h1>
          <p>
            Theo dõi biến động, phân bố, tần suất và dự báo cường độ carbon
            của lưới điện Great Britain (GB).
          </p>
        </div>
      </div>

      <TheChiSoThoiGianThuc />
      <BieuDoChuoiThoiGian />
      <BieuDoBocTach />
      <BieuDoTanSuat />
      <BieuDoPhanRa />
      <BieuDoPhanCumKMeans />
      <BieuDoDuBaoNgayMai />
    </div>
  );
}