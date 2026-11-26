
import React from "react";
import { History } from "lucide-react";
import BieuDoChuoiThoiGian from "../thanhPhan/trangChu/BieuDoChuoiThoiGian.jsx";
import BieuDoPhanTan from "../thanhPhan/trangChu/BieuDoPhanTan.jsx";
import BieuDoTanSuat from "../thanhPhan/trangChu/BieuDoTanSuat.jsx";
import "../thanhPhan/trangChu/phanTich.css";
import ThanhChuGiaiMuc from "../thanhPhan/trangChu/ThanhChuGiaiMuc.jsx";

export default function TrangThongKeLichSuThoiGian() {
  return (
    <div className="phan-tich-wrapper flex flex-col gap-6">
      {/* Tiêu đề trang */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
          <History size={22} />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            Thống Kê Lịch Sử &amp; Diễn Biến Thời Gian
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Phân tích biến động cường độ carbon, phân bố theo khung giờ trong ngày và tần suất xuất hiện
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl px-5 py-3 border border-slate-200/80 shadow-sm">
        <ThanhChuGiaiMuc />
      </div>

      {/* Hàng 1: Biểu đồ đường diễn biến theo thời gian (Full width) */}
      <BieuDoChuoiThoiGian />

      {/* Hàng 2: Biểu đồ phân tán theo giờ & Biểu đồ tần suất (Chia 2 cột 50/50 trên màn hình lớn) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <BieuDoPhanTan />
        <BieuDoTanSuat />
      </div>
    </div>
  );
}