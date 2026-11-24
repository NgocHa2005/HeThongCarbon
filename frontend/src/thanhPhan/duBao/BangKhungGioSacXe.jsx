
import React from "react";

const KHUNG_GIO_DIEN_HINH = [
  {
    id: "golden",
    timeRange: "02:00 - 05:30",
    subtitle: "Khung Vàng Tối Ưu (Off-Peak)",
    aiIntensity: 68,
    ciError: "±4.2 gCO₂ (CI 95%)",
    esoIntensity: 74,
    esoDiffNote: "AI thấp hơn 8.1%",
    esoDiffClass: "text-emerald-700",
    rowClass: "bg-emerald-50/50 hover:bg-emerald-50",
    iconBoxClass: "bg-emerald-600 text-on-primary",
    icon: "bolt",
    titleClass: "text-emerald-950",
    subtitleClass: "text-emerald-700 font-semibold",
    metricClass: "text-emerald-700",
    unitClass: "text-emerald-700",
    badgeClass: "bg-emerald-600 text-on-primary font-bold shadow-xs",
    badgeIcon: "electric_car",
    badgeText: "CẮM SẠC NGAY",
  },
  {
    id: "daytime",
    timeRange: "11:00 - 15:00",
    subtitle: "Khung Ban Ngày / Mặt Trời",
    aiIntensity: 138,
    ciError: "±6.8 gCO₂ (CI 95%)",
    esoIntensity: 146,
    esoDiffNote: "Sai khác 5.4%",
    esoDiffClass: "text-secondary",
    rowClass: "hover:bg-surface-container-low",
    iconBoxClass: "bg-surface-container-high text-secondary",
    icon: "wb_sunny",
    titleClass: "text-on-surface",
    subtitleClass: "text-secondary",
    metricClass: "text-amber-700",
    unitClass: "text-amber-700",
    badgeClass: "bg-amber-100 text-amber-900 font-semibold",
    badgeIcon: "check",
    badgeText: "SẠC LINH HOẠT",
  },
  {
    id: "peak",
    timeRange: "17:30 - 20:30",
    subtitle: "Khung Cao Điểm Tối (Peak Grid)",
    aiIntensity: 224,
    ciError: "±9.5 gCO₂ (CI 95%)",
    esoIntensity: 235,
    esoDiffNote: "Đỉnh phụ tải quốc gia",
    esoDiffClass: "text-red-700",
    rowClass: "bg-red-50/40 hover:bg-red-50/70",
    iconBoxClass: "bg-red-600 text-on-primary",
    icon: "priority_high",
    titleClass: "text-red-950",
    subtitleClass: "text-red-700 font-semibold",
    metricClass: "text-red-700",
    unitClass: "text-red-700",
    badgeClass: "bg-red-100 text-red-900 font-bold",
    badgeIcon: "block",
    badgeText: "TRÁNH SẠC XE",
  },
  {
    id: "latenight",
    timeRange: "22:30 - 01:30",
    subtitle: "Khung Đêm Chuyển Tiếp",
    aiIntensity: 112,
    ciError: "±5.1 gCO₂ (CI 95%)",
    esoIntensity: 118,
    esoDiffNote: "Xu hướng hạ nhiệt",
    esoDiffClass: "text-secondary",
    rowClass: "hover:bg-surface-container-low",
    iconBoxClass: "bg-surface-container-high text-secondary",
    icon: "bedtime",
    titleClass: "text-on-surface",
    subtitleClass: "text-secondary",
    metricClass: "text-on-surface",
    unitClass: "text-secondary",
    badgeClass: "bg-surface-container text-secondary font-semibold",
    badgeIcon: "timer",
    badgeText: "HẸN GIỜ ĐẾN 02:00",
  },
];

export default function BangKhungGioSacXe({ xeDangChon, onXuatCsv, onMoCauHinhWallbox }) {
  const capacity = xeDangChon.capacityKwh;
  const goldenCo2Kg = (68 * capacity) / 1000;
  const peakCo2Kg = (224 * capacity) / 1000;

  return (
    <div className="rounded-xl bg-surface-container-lowest p-gutter-lg shadow-sm flex flex-col gap-space-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs pb-space-xs">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Chi Tiết 4 Khung Giờ Hoạt Động Điển Hình Ngày Mai
          </h3>
          <p className="font-body-sm text-body-sm text-secondary">
            Phân tích chi tiết thành phần nguồn điện, độ tin cậy mô hình và tác động giảm phát thải tương ứng với từng phiên sạc.
          </p>
        </div>
        <div className="flex items-center gap-space-xs">
          <button
            type="button"
            onClick={onXuatCsv}
            className="px-space-sm py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-label-sm text-label-sm font-medium transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Xuất CSV (48 Khung)</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">
              <th className="p-space-md font-semibold">Khung giờ &amp; Tính chất</th>
              <th className="p-space-md font-semibold">Mức Carbon (AI Dự báo)</th>
              <th className="p-space-md font-semibold">Dự báo ESO Đối chiếu</th>
              <th className="p-space-md font-semibold">Ước tính sạc {capacity}kWh</th>
              <th className="p-space-md font-semibold text-right">Khuyến nghị điều độ EV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
            {KHUNG_GIO_DIEN_HINH.map((slot) => {
              const slotCo2Kg = ((slot.aiIntensity * capacity) / 1000).toFixed(2);
              const savedVsPeak = (peakCo2Kg - Number(slotCo2Kg)).toFixed(1);
              const extraVsGoldenPct = Math.round(
                ((Number(slotCo2Kg) - goldenCo2Kg) / goldenCo2Kg) * 100
              );

              return (
                <tr key={slot.id} className={`${slot.rowClass} transition-colors`}>
                  <td className="p-space-md">
                    <div className="flex items-center gap-space-sm">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${slot.iconBoxClass}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{slot.icon}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-headline-sm text-headline-sm font-bold ${slot.titleClass}`}>
                          {slot.timeRange}
                        </span>
                        <span className={`font-label-sm text-label-sm ${slot.subtitleClass}`}>
                          {slot.subtitle}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="p-space-md">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-display-metric text-[22px] font-bold ${slot.metricClass}`}>
                          {slot.aiIntensity}
                        </span>
                        <span className={`font-label-sm text-label-sm ${slot.unitClass}`}>
                          gCO₂/kWh
                        </span>
                      </div>
                      <span className="font-code-metric text-[11px] text-secondary">
                        Sai số: {slot.ciError}
                      </span>
                    </div>
                  </td>

                  <td className="p-space-md">
                    <div className="flex flex-col font-code-metric text-code-metric text-secondary">
                      <span className="font-semibold text-on-surface">{slot.esoIntensity} gCO₂/kWh</span>
                      <span className={`text-[11px] ${slot.esoDiffClass}`}>{slot.esoDiffNote}</span>
                    </div>
                  </td>

                  <td className="p-space-md">
                    <div className="flex flex-col">
                      <span
                        className={`font-semibold ${
                          slot.id === "golden"
                            ? "text-emerald-800"
                            : slot.id === "peak"
                            ? "text-red-800"
                            : "text-on-surface"
                        }`}
                      >
                        {slotCo2Kg} kg CO₂ / lần sạc
                      </span>
                      <span
                        className={`font-code-metric text-[11px] ${
                          slot.id === "peak" ? "text-red-600" : "text-secondary"
                        }`}
                      >
                        {slot.id === "golden" && `Tiết kiệm ${savedVsPeak} kg vs Cao điểm`}
                        {slot.id === "daytime" && "Sạc cơ quan/văn phòng"}
                        {slot.id === "peak" && `+${extraVsGoldenPct}% phát thải vs Khung Vàng`}
                        {slot.id === "latenight" && "Chuẩn bị vào khung tối ưu"}
                      </span>
                    </div>
                  </td>

                  <td className="p-space-md text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm ${slot.badgeClass}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{slot.badgeIcon}</span>
                      {slot.badgeText}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom summary helper card */}
      <div className="rounded-lg bg-surface-container-low p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm font-body-sm text-body-sm text-secondary">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-emerald-600 text-[20px]">psychology</span>
          <span>
            <strong className="text-on-surface font-semibold">Trí tuệ tối ưu ECO-GRID:</strong> Nếu xe của bạn hỗ trợ giao thức OCPP 2.0.1 hoặc Tesla Fleet API, hãy kích hoạt{" "}
            <strong className="text-primary font-semibold">"Auto EV Green Sync"</strong> để hệ thống tự động điều khiển wallbox bật đúng 02:00 và ngắt lúc 05:30.
          </span>
        </div>
        <button
          type="button"
          onClick={onMoCauHinhWallbox}
          className="shrink-0 font-label-sm text-label-sm text-primary hover:underline font-bold flex items-center gap-1"
        >
          <span>Cấu hình kết nối Wallbox API</span>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}