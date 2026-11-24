import React from "react";
import BieuDoPhanCumKMeans from "../thanhPhan/khaiPha/BieuDoPhanCumKMeans";

export default function TrangDashboardCongKhai() {
  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            KHAI PHÁ DỮ LIỆU CARBON
          </div>
          <h1>Phân cụm cường độ carbon theo ngày</h1>
          <p>
            Tổng hợp đặc trưng trung bình và độ biến động trong ngày của lưới
            điện GB (Region 0) bằng thuật toán K-Means.
          </p>
        </div>
      </div>

      <BieuDoPhanCumKMeans />
    </div>
  );
}