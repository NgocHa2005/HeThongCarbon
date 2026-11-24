import React from "react";
import { GB_AVERAGE_INTENSITY, NEUTRAL_TARGET_INTENSITY } from "../../api/duLieuCarbonApi";

function getBadgeStyle(intensity) {
  if (intensity < 50) {
    return { label: "Cấp: Very Low (Rất sạch)", className: "bg-emerald-100 text-emerald-900" };
  }
  if (intensity < 100) {
    return { label: "Cấp: Low (Sạch)", className: "bg-emerald-50 text-emerald-800" };
  }
  if (intensity < 165) {
    return { label: "Cấp: Moderate (Vừa)", className: "bg-amber-100 text-amber-900" };
  }
  if (intensity < 210) {
    return { label: "Cấp: High (Cao)", className: "bg-primary-fixed text-on-primary-fixed" };
  }
  return { label: "Cấp: Very High (Rất cao)", className: "bg-red-100 text-red-900" };
}

export default function TheThongSoKhuVuc({ vungDangChon, thuHang, tongSoVung }) {
  if (!vungDangChon) return null;

  const badge = getBadgeStyle(vungDangChon.intensity);
  const deltaGbPercent = (
    ((vungDangChon.intensity - GB_AVERAGE_INTENSITY) / GB_AVERAGE_INTENSITY) *
    100
  ).toFixed(1);
  const isHigherThanGb = vungDangChon.intensity >= GB_AVERAGE_INTENSITY;
  const deltaNeutral = vungDangChon.intensity - NEUTRAL_TARGET_INTENSITY;

  return (
    <div className="xl:col-span-5 flex flex-col gap-space-lg">
      {/* 1. Primary KPI Pair Card */}
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Thời Gian Thực • Dữ Liệu Khu Vực
            </span>
          </div>
          <span className={`px-space-sm py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        {/* Metric Counter Grid */}
        <div className="grid grid-cols-2 gap-space-md pt-space-xs">
          {/* Selected Region */}
          <div className="p-space-md rounded-lg bg-primary-fixed/20 flex flex-col gap-space-xs">
            <div className="flex items-center justify-between text-secondary">
              <span className="font-label-md text-label-md font-medium text-on-surface-variant">
                {vungDangChon.name} DNO
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary">location_city</span>
            </div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-metric text-display-metric text-primary font-bold">
                {vungDangChon.intensity}
              </span>
              <span className="font-body-sm text-body-sm text-secondary">gCO₂/kWh</span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {vungDangChon.summaryTag}
            </span>
          </div>

          {/* GB Average Baseline */}
          <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
            <div className="flex items-center justify-between text-secondary">
              <span className="font-label-md text-label-md font-medium">Bình quân Toàn GB</span>
              <span className="material-symbols-outlined text-[18px] text-secondary">public</span>
            </div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-metric text-display-metric text-on-surface font-bold">
                {GB_AVERAGE_INTENSITY}
              </span>
              <span className="font-body-sm text-body-sm text-secondary">gCO₂/kWh</span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span
                className={`material-symbols-outlined text-[16px] ${
                  isHigherThanGb ? "text-tertiary" : "text-emerald-600"
                }`}
              >
                {isHigherThanGb ? "arrow_drop_up" : "arrow_drop_down"}
              </span>
              <span
                className={`font-code-metric text-code-metric font-bold ${
                  isHigherThanGb ? "text-tertiary" : "text-emerald-700"
                }`}
              >
                {isHigherThanGb ? `+${deltaGbPercent}%` : `${deltaGbPercent}%`}
              </span>
              <span className="font-body-sm text-body-sm text-secondary">
                {isHigherThanGb ? "cao hơn cả nước" : "thấp hơn cả nước"}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Delta Indicator Meter */}
        <div className="flex flex-col gap-space-xs pt-space-xs">
          <div className="flex justify-between font-label-sm text-label-sm text-secondary">
            <span>Độ lệch so với mức chuẩn trung hòa ({NEUTRAL_TARGET_INTENSITY}g)</span>
            <span className={`font-bold ${deltaNeutral > 0 ? "text-primary" : "text-emerald-700"}`}>
              {deltaNeutral > 0
                ? `+${deltaNeutral} gCO₂ vượt ngưỡng`
                : `${Math.abs(deltaNeutral)} gCO₂ dưới ngưỡng chuẩn`}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: "25%" }} />
            <div className="bg-amber-400 h-full" style={{ width: "25%" }} />
            <div className="bg-primary h-full" style={{ width: "35%" }} />
            <div className="bg-tertiary h-full" style={{ width: "15%" }} />
          </div>
        </div>
      </div>

      {/* 2. Local Generation Mix */}
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Cơ Cấu Nguồn Điện Cục Bộ (Local Generation Mix)
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Khu vực {vungDangChon.name} ({vungDangChon.operator}) • Cập nhật 14:30 UTC
            </p>
          </div>
          <span className="material-symbols-outlined text-secondary text-[20px]">donut_large</span>
        </div>

        {/* Segmented Proportion Bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex shadow-inner">
          {vungDangChon.fuelMix.map((fuel) => (
            <div
              key={fuel.label}
              className={`${fuel.color} transition-all duration-300`}
              style={{ width: `${fuel.value}%` }}
              title={`${fuel.label}: ${fuel.value}%`}
            />
          ))}
        </div>

        {/* Detailed Fuel Distribution Rows */}
        <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
          {vungDangChon.fuelMix.map((fuel) => (
            <div
              key={fuel.label}
              className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low"
            >
              <div className="flex items-center gap-space-xs">
                <span className={`w-3 h-3 rounded ${fuel.color}`} />
                <span className="font-label-md text-label-md text-on-surface">{fuel.label}</span>
              </div>
              <span
                className={`font-code-metric text-code-metric font-bold ${
                  fuel.textAccent ? "text-primary" : "text-on-surface"
                }`}
              >
                {fuel.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {/* Mini callout insight */}
        <div className="p-space-sm rounded-lg bg-surface-container-high/40 flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">info</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {vungDangChon.insight}
          </span>
        </div>
      </div>

      {/* 3. Urban Decarbonization Trend & Standing */}
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Đánh Giá Tiến Trình Khử Carbon
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Xếp hạng bền vững theo thời gian thực
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-secondary">military_tech</span>
          </div>
        </div>

        <div className="flex items-center gap-space-md p-space-md rounded-lg bg-surface-container-low">
          <div className="flex flex-col items-center justify-center px-space-md py-space-xs rounded bg-surface-container-lowest shadow-sm shrink-0">
            <span className="font-display-metric text-display-metric font-extrabold text-primary">
              {thuHang}
            </span>
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-semibold">
              / {tongSoVung} Vùng
            </span>
          </div>
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-md text-label-md font-bold text-on-surface">
              {vungDangChon.standingTitle}
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {vungDangChon.standingNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}