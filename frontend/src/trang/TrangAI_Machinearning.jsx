import React from "react";
import { Sparkles } from "lucide-react";

export default function TrangAI_Machinearning() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Khám Phá Tri Thức &amp; Thuật Toán Phân Cụm AI
          </h1>
          <p className="text-xs text-slate-500">
            Khung chờ ghép code: Phân rã chuỗi thời gian Additive STL (4 thành phần) &amp; Phân cụm K-Means (k=3)
          </p>
        </div>
      </div>
    </div>
  );
}