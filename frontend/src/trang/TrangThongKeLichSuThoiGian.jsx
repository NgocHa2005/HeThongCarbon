import React from "react";
import { History } from "lucide-react";

export default function TrangThongKeLichSuThoiGian() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
          <History size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Thống Kê Lịch Sử &amp; Diễn Biến Thời Gian
          </h1>
          <p className="text-xs text-slate-500">
            Khung chờ ghép code: Biểu đồ đường OLS, Duck Curve 24h &amp; Histogram phân phối tần suất
          </p>
        </div>
      </div>
    </div>
  );
}