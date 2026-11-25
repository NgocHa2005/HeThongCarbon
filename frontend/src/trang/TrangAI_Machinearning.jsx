// frontend/src/trang/TrangAI_Machinearning.jsx
import React from "react";
import { Sparkles } from "lucide-react";
import BieuDoPhanRa from "../thanhPhan/trangChu/BieuDoPhanRa.jsx";
import BieuDoPhanCumKMeans from "../thanhPhan/khaiPha/BieuDoPhanCumKMeans.jsx";
import "../thanhPhan/trangChu/phanTich.css";


export default function TrangAI_Machinearning() {
  return (
    <div className="phan-tich-wrapper flex flex-col gap-6">
      {/* Tiêu đề trang */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
          <Sparkles size={22} />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            Khám Phá Tri Thức &amp; Thuật Toán Phân Cụm AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Phân rã chuỗi thời gian cộng tính (Additive STL) và phân cụm hành vi phát thải theo ngày (K-Means)
          </p>
        </div>
      </div>

      {/* Khối 1: Phân rã xu hướng và mùa vụ (STL) */}
      <BieuDoPhanRa />

      {/* Khối 2: Phân cụm K-Means (k=3) & Bảng danh sách ngày theo cụm */}
      <BieuDoPhanCumKMeans />
    </div>
  );
}