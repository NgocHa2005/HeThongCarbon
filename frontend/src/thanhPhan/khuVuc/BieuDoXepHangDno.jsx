// frontend/src/thanhPhan/khuVuc/BieuDoXepHangDno.jsx
import React from "react";
import { GB_AVERAGE_INTENSITY } from "../../api/duLieuCarbonApi";

function getBarColorClass(intensity, isSelected) {
  if (isSelected) {
    return {
      bar: "bg-primary shadow-md",
      text: "text-primary font-extrabold",
    };
  }
  if (intensity < 50) {
    return { bar: "bg-emerald-700 shadow-sm", text: "text-emerald-700 font-bold" };
  }
  if (intensity < 100) {
    return { bar: "bg-emerald-500 shadow-sm", text: "text-emerald-600 font-bold" };
  }
  if (intensity < 165) {
    return { bar: "bg-amber-500 shadow-sm", text: "text-amber-600 font-bold" };
  }
  if (intensity < 210) {
    return { bar: "bg-primary/85 shadow-sm", text: "text-primary font-bold" };
  }
  return { bar: "bg-tertiary shadow-sm", text: "text-tertiary font-bold" };
}

export default function BieuDoXepHangDno({ danhSachVung, maVungDangChon, onChonVung }) {
  const maxScale = 250;

  return (
    <div className="xl:col-span-7 flex flex-col gap-space-lg">
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
        {/* Header & Metric Legend */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-sm gap-space-sm">
          <div>
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Xếp Hạng Cường Độ Carbon 14 Vùng Phân Phối (DNO)
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              Đo lường gCO₂/kWh được nạp vào lưới điện khu vực hôm nay (Nhấp vào từng vùng để xem chi tiết)
            </p>
          </div>

          {/* Color Quintile Legend Chips */}
          <div className="flex items-center flex-wrap gap-1.5 self-start md:self-auto">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
              Rất sạch (&lt;50)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
              Sạch (&lt;100)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
              Vừa (&lt;165)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-950">
              Cao (&lt;210)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-900">
              Rất cao (&gt;210)
            </span>
          </div>
        </div>

        {/* Horizontal Bar Chart Representation */}
        <div className="flex flex-col gap-2 pt-space-xs">
          {danhSachVung.map((vung, index) => {
            const isSelected = vung.code === maVungDangChon;
            const prevVung = index > 0 ? danhSachVung[index - 1] : null;
            const showGbBaselineBefore =
              prevVung &&
              prevVung.intensity <= GB_AVERAGE_INTENSITY &&
              vung.intensity > GB_AVERAGE_INTENSITY;

            const widthPercent = Math.min((vung.intensity / maxScale) * 100, 100);
            const styles = getBarColorClass(vung.intensity, isSelected);

            return (
              <React.Fragment key={vung.code}>
                {/* GB AVERAGE BENCHMARK LINE */}
                {showGbBaselineBefore && (
                  <div className="relative py-1 my-1">
                    <div className="w-full h-px bg-primary/40" />
                    <div className="flex items-center justify-between text-[11px] font-code-metric text-primary font-bold px-1 pt-1">
                      <div className="flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-[14px]">flag</span>
                        <span>MỨC BÌNH QUÂN TOÀN GB (GB AVERAGE BASELINE)</span>
                      </div>
                      <span>{GB_AVERAGE_INTENSITY} gCO₂/kWh</span>
                    </div>
                  </div>
                )}

                <div
                  onClick={() => onChonVung(vung.code)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onChonVung(vung.code)}
                  className={`flex items-center gap-space-sm rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-primary-fixed/40 p-2 shadow-sm"
                      : "group hover:bg-surface-container-low p-1.5"
                  }`}
                >
                  <div
                    className={`w-40 font-label-md text-label-md truncate flex items-center gap-1 ${
                      isSelected ? "text-primary font-bold" : "text-on-surface font-medium"
                    }`}
                  >
                    {isSelected && (
                      <span className="material-symbols-outlined text-[16px]">arrow_right</span>
                    )}
                    <span className="text-secondary font-code-metric text-[11px] mr-0.5">
                      #{index + 1}
                    </span>
                    <span className="truncate">{vung.name}</span>
                  </div>

                  <div
                    className={`flex-1 ${
                      isSelected ? "h-7 bg-surface-container-lowest" : "h-6 bg-surface-container"
                    } rounded-md overflow-hidden relative flex items-center`}
                  >
                    <div
                      className={`h-full rounded-md transition-all duration-300 flex items-center justify-end pr-2 text-white font-code-metric text-[11px] font-bold ${styles.bar}`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      {vung.intensity}
                    </div>
                  </div>

                  <div className={`w-24 text-right font-code-metric text-code-metric ${styles.text}`}>
                    {vung.intensity} gCO₂
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Scale Axis Footer */}
        <div className="flex items-center justify-between text-secondary font-code-metric text-[10px] pt-space-xs pl-40 pr-24">
          <span>0 g</span>
          <span>50 g</span>
          <span>100 g</span>
          <span>150 g</span>
          <span>200 g</span>
          <span>250 gCO₂/kWh</span>
        </div>
      </div>
    </div>
  );
}