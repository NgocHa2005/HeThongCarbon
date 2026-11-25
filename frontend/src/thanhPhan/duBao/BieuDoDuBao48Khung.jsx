
import React, { useState } from "react";

function getSlotStatus(intensity) {
  if (intensity < 50) {
    return {
      badge: "VERY LOW",
      badgeClass: "bg-emerald-100 text-emerald-900",
      advice: "Ưu tiên sạc tối đa",
      adviceClass: "text-emerald-700",
      icon: "bolt",
    };
  }
  if (intensity < 100) {
    return {
      badge: "LOW",
      badgeClass: "bg-emerald-100 text-emerald-800",
      advice: "Khung giờ vàng sạc xe",
      adviceClass: "text-emerald-700",
      icon: "ev_station",
    };
  }
  if (intensity < 175) {
    return {
      badge: "MODERATE",
      badgeClass: "bg-amber-100 text-amber-800",
      advice: "Không ưu tiên sạc",
      adviceClass: "text-amber-800",
      icon: "pause_circle",
    };
  }
  return {
    badge: "HIGH",
    badgeClass: "bg-red-100 text-red-900",
    advice: "Tránh sạc cao điểm",
    adviceClass: "text-red-700",
    icon: "block",
  };
}

export default function BieuDoDuBao48Khung({ duLieuChuKy, kichBan }) {
  // Mặc định ghim marker tại 14:00 (index 14) giống thiết kế gốc
  const [selectedIndex, setSelectedIndex] = useState(14);

  const width = 1000;
  const baseLineY = 240;
  const scaleY = 0.9;

  const points = duLieuChuKy.map((item, idx) => {
    const x = (idx / (duLieuChuKy.length - 1)) * width;
    const yAi = baseLineY - item.ai * scaleY;
    const yEso = baseLineY - item.eso * scaleY;
    const yUpper = baseLineY - (item.ai + item.margin) * scaleY;
    const yLower = baseLineY - (item.ai - item.margin) * scaleY;
    return { ...item, idx, x, yAi, yEso, yUpper, yLower };
  });

  const aiLinePoints = points.map((p) => `${p.x.toFixed(1)},${p.yAi.toFixed(1)}`).join(" ");
  const esoLinePoints = points.map((p) => `${p.x.toFixed(1)},${p.yEso.toFixed(1)}`).join(" ");
  const polygonPoints = [
    ...points.map((p) => `${p.x.toFixed(1)},${p.yUpper.toFixed(1)}`),
    ...[...points].reverse().map((p) => `${p.x.toFixed(1)},${p.yLower.toFixed(1)}`),
  ].join(" ");

  const activePoint = points[selectedIndex] || points[14];
  const slotStatus = getSlotStatus(activePoint.ai);
  const tooltipLeftPercent = Math.min(Math.max((activePoint.x / width) * 100, 14), 86);

  const showAi = kichBan === "ai" || kichBan === "compare";
  const showEso = kichBan === "eso" || kichBan === "compare";

  return (
    <div className="rounded-xl bg-surface-container-lowest p-gutter-lg shadow-sm flex flex-col gap-space-md">
      {/* Header of Chart */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm pb-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Biểu Đồ Cường Độ Carbon 48 Chu Kỳ Bán Giờ (30 Phút) Ngày Mai
            </h3>
            <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-code-metric text-code-metric font-medium">
              D+1 Dispatch Schedule
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary">
            So sánh đường dự báo Mô hình AI Nhóm (ML Ensemble / LightGBM + LSTM) vs. Dự báo chính thức National Grid ESO.
          </p>
        </div>

        {/* Chart Legend */}
        <div className="flex flex-wrap items-center gap-space-md font-label-sm text-label-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded bg-primary" />
            <span className="text-on-surface font-semibold">AI Ensemble (LightGBM + LSTM)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 border-b-2 border-dashed border-slate-600" />
            <span className="text-secondary">Dự báo National Grid ESO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100" />
            <span className="text-emerald-800 font-semibold">⚡ Khung Giờ Vàng Sạc (02:00 - 05:30)</span>
          </div>
        </div>
      </div>

      {/* SVG Chart Canvas */}
      <div className="relative w-full overflow-hidden rounded-lg bg-surface-container-low p-space-md">
        <div className="relative w-full h-[320px]">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 300">
            <defs>
              <linearGradient id="aiConfidenceGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#EA580C" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#EA580C" stopOpacity="0.03" />
              </linearGradient>
              <pattern height="60" id="gridY" patternUnits="userSpaceOnUse" width="1000">
                <line
                  opacity="0.6"
                  stroke="#CBD5E1"
                  strokeDasharray="3 3"
                  strokeWidth="0.75"
                  x1="0"
                  x2="1000"
                  y1="0"
                  y2="0"
                />
              </pattern>
            </defs>

            {/* Y-Axis Grid Background */}
            <rect fill="url(#gridY)" height="240" width="1000" />

            {/* Golden Charge Window Highlight (02:00 -> 05:30: X from ~83 to ~229) */}
            <rect fill="#10B981" fillOpacity="0.14" height="230" rx="6" width="146" x="83" y="10" />
            <line stroke="#10B981" strokeDasharray="4 2" strokeWidth="1.5" x1="83" x2="83" y1="10" y2="240" />
            <line stroke="#10B981" strokeDasharray="4 2" strokeWidth="1.5" x1="229" x2="229" y1="10" y2="240" />

            {/* Golden Zone Badge */}
            <g transform="translate(100, 24)">
              <rect fill="#047857" height="22" rx="4" width="112" />
              <text
                fill="#FFFFFF"
                fontFamily="Inter"
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
                x="56"
                y="15"
              >
                ⚡ KHUNG SẠC VÀNG
              </text>
            </g>

            {/* AI Confidence Interval Area */}
            {showAi && <polygon fill="url(#aiConfidenceGrad)" points={polygonPoints} />}

            {/* ESO Forecast Curve */}
            {showEso && (
              <polyline
                fill="none"
                points={esoLinePoints}
                stroke="#475569"
                strokeDasharray="5 4"
                strokeWidth={kichBan === "eso" ? "3" : "2"}
              />
            )}

            {/* AI Ensemble Primary Forecast Curve */}
            {showAi && (
              <polyline
                fill="none"
                points={aiLinePoints}
                stroke="#EA580C"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            )}

            {/* Active Hover/Selected Marker */}
            <line
              stroke="#EA580C"
              strokeDasharray="2 2"
              strokeWidth="1.5"
              x1={activePoint.x}
              x2={activePoint.x}
              y1="10"
              y2="245"
            />
            {showAi && (
              <circle
                cx={activePoint.x}
                cy={activePoint.yAi}
                fill="#EA580C"
                r="6"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            )}
            {showEso && (
              <circle
                cx={activePoint.x}
                cy={activePoint.yEso}
                fill="#475569"
                r="4.5"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            )}

            {/* Invisible Interactive Columns for Mouse Hover / Click */}
            {points.map((p) => (
              <rect
                key={p.time}
                x={Math.max(p.x - 20, 0)}
                y={0}
                width={40}
                height={250}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setSelectedIndex(p.idx)}
                onClick={() => setSelectedIndex(p.idx)}
              />
            ))}

            {/* Bottom Time Markers */}
            <g fill="#64748B" fontFamily="Inter" fontSize="11">
              <text textAnchor="start" x="0" y="262">00:00</text>
              <text textAnchor="middle" x="83" y="262">02:00</text>
              <text textAnchor="middle" x="167" y="262">04:00</text>
              <text textAnchor="middle" x="250" y="262">06:00</text>
              <text textAnchor="middle" x="333" y="262">08:00</text>
              <text textAnchor="middle" x="417" y="262">10:00</text>
              <text textAnchor="middle" x="500" y="262">12:00</text>
              <text fill="#EA580C" fontWeight="700" textAnchor="middle" x="583" y="262">14:00</text>
              <text textAnchor="middle" x="667" y="262">16:00</text>
              <text fill="#991B1B" fontWeight="600" textAnchor="middle" x="750" y="262">18:00</text>
              <text textAnchor="middle" x="833" y="262">20:00</text>
              <text textAnchor="middle" x="917" y="262">22:00</text>
              <text textAnchor="end" x="1000" y="262">23:30</text>
            </g>
          </svg>

          {/* Dynamic Tooltip */}
          <div
            style={{ left: `${tooltipLeftPercent}%` }}
            className="absolute top-4 -translate-x-1/2 w-64 rounded-xl bg-surface-container-lowest p-space-sm shadow-xl z-20 pointer-events-none transition-all duration-150"
          >
            <div className="flex items-center justify-between pb-1 border-b border-surface-container">
              <span className="font-code-metric text-code-metric font-bold text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
                {activePoint.time} UTC
              </span>
              <span className={`px-1.5 py-0.5 rounded font-label-sm text-[10px] font-bold ${slotStatus.badgeClass}`}>
                {slotStatus.badge}
              </span>
            </div>

            <div className="flex flex-col gap-1 py-1.5">
              <div className="flex items-center justify-between font-label-sm text-label-sm">
                <span className="text-secondary flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Dự báo AI Ensemble:
                </span>
                <span className="font-code-metric text-code-metric font-bold text-primary">
                  {activePoint.ai} gCO₂/kWh
                </span>
              </div>
              <div className="flex items-center justify-between font-label-sm text-[11px] text-secondary">
                <span>Khoảng tin cậy 95%:</span>
                <span className="font-code-metric text-code-metric">±{activePoint.margin} gCO₂/kWh</span>
              </div>
              <div className="flex items-center justify-between font-label-sm text-label-sm">
                <span className="text-secondary flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-slate-600" />
                  Dự báo National ESO:
                </span>
                <span className="font-code-metric text-code-metric text-slate-700 font-semibold">
                  {activePoint.eso} gCO₂/kWh
                </span>
              </div>
            </div>

            <div className="pt-1 border-t border-surface-container flex items-center justify-between font-label-sm text-label-sm">
              <span className="text-secondary">Khuyến nghị EV:</span>
              <span className={`font-semibold flex items-center gap-0.5 ${slotStatus.adviceClass}`}>
                <span className="material-symbols-outlined text-[15px]">{slotStatus.icon}</span>
                {slotStatus.advice}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-space-xs font-label-sm text-label-sm text-secondary gap-1">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px]">touch_app</span>
            <span>Rê chuột trên 48 chu kỳ để xem chi tiết từng mốc 30 phút • Cập nhật tự động mỗi chu kỳ dispatch</span>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="font-code-metric text-code-metric text-primary font-semibold">MAE: 4.12 gCO₂/kWh</span>
            <span>•</span>
            <span className="font-code-metric text-code-metric text-emerald-700 font-semibold">R² = 0.964</span>
          </div>
        </div>
      </div>

      {/* 5 Cấp Độ Chuẩn Màu */}
      <div className="flex flex-col gap-space-xs pt-space-xs">
        <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
          Quy chuẩn 5 mức cường độ phát thải theo National Grid ESO:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-space-sm">
          <div className="flex items-center gap-space-xs p-2 rounded-lg bg-emerald-50 text-emerald-900">
            <span className="w-3 h-3 rounded-full bg-[#047857]" />
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-bold">VERY LOW</span>
              <span className="font-code-metric text-[11px] text-emerald-700">&lt; 50 gCO₂/kWh</span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs p-2 rounded-lg bg-emerald-100/70 text-emerald-950">
            <span className="w-3 h-3 rounded-full bg-[#10B981]" />
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-bold">LOW</span>
              <span className="font-code-metric text-[11px] text-emerald-800">50 - 100 gCO₂/kWh</span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs p-2 rounded-lg bg-amber-50 text-amber-950">
            <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-bold">MODERATE</span>
              <span className="font-code-metric text-[11px] text-amber-800">100 - 175 gCO₂/kWh</span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs p-2 rounded-lg bg-orange-50 text-orange-950">
            <span className="w-3 h-3 rounded-full bg-[#F97316]" />
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-bold">HIGH</span>
              <span className="font-code-metric text-[11px] text-orange-800">175 - 250 gCO₂/kWh</span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs p-2 rounded-lg bg-red-50 text-red-950">
            <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-bold">VERY HIGH</span>
              <span className="font-code-metric text-[11px] text-red-800">&gt; 250 gCO₂/kWh</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}