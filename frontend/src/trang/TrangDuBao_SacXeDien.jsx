import React, { useEffect, useMemo, useState } from "react";
import {
  BatteryCharging,
  Clock,
  Download,
  Flame,
  Leaf,
  TrendingDown,
  Zap,
} from "lucide-react";
import { layDuBaoNgayMai, thongDiepLoiApi } from "../api/axiosClient.js";

function trichGioUtc(isoOrSlot, isEnd = false) {
  if (!isoOrSlot) return "--:--";
  if (typeof isoOrSlot === "string" && isoOrSlot.includes("T")) {
    const d = new Date(isoOrSlot);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(11, 16);
    }
  }
  if (typeof isoOrSlot === "string" && isoOrSlot.includes("–")) {
    const parts = isoOrSlot.split("–");
    return (isEnd ? parts[1] : parts[0])?.trim() || "--:--";
  }
  return String(isoOrSlot).slice(0, 5);
}

function dinhDangNgayVietNam(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== "string") return isoDateStr || "";
  const parts = isoDateStr.split("-");
  if (parts.length !== 3) return isoDateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function layKhungThapNhatHeThong(data) {
  if (!data) return "";
  const windows = Array.isArray(data.recommended_low_windows_utc)
    ? data.recommended_low_windows_utc
    : [];
  if (windows.length > 0 && windows[0].from_utc && windows[0].to_utc) {
    return `${windows[0].from_utc} – ${windows[0].to_utc} UTC`;
  }
  if (data.lowest_slot_utc?.from_utc && data.lowest_slot_utc?.to_utc) {
    return `${data.lowest_slot_utc.from_utc} – ${data.lowest_slot_utc.to_utc} UTC`;
  }
  return "";
}

export default function TrangDuBao_SacXeDien() {
  // Tham số người dùng nhập cho phiên sạc EV
  const [durationHours, setDurationHours] = useState(2);
  const [batteryKwh, setBatteryKwh] = useState(60);

  // Dữ liệu duy nhất từ FACT_ML_PREDICTIONS (/phan-tich/du-bao/ngay-mai)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [chiXemKhungTot, setChiXemKhungTot] = useState(false);

  useEffect(() => {
    let active = true;

    async function taiDuBao() {
      setLoading(true);
      setErrorMsg("");
      try {
        const resData = await layDuBaoNgayMai();
        if (active) {
          setData(resData);
        }
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err?.response?.status === 404
            ? err.response?.data?.detail || "Chưa có dữ liệu dự báo ngày mai (UTC)."
            : thongDiepLoiApi(err)
        );
        setData(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    taiDuBao();
    return () => {
      active = false;
    };
  }, []);

  // Tính toán khung giờ sạc tối ưu, cao điểm và lượng CO2 tiết kiệm từ chính mảng data.slots
  const evAnalysis = useMemo(() => {
    const slots = Array.isArray(data?.slots) ? data.slots : [];
    if (slots.length === 0) return null;

    const validHours = Math.min(12, Math.max(0.5, Number(durationHours) || 2));
    const validKwh = Math.max(1, Number(batteryKwh) || 60);
    const windowSize = Math.min(slots.length, Math.max(1, Math.round(validHours * 2)));

    let bestStart = 0;
    let bestAvg = Infinity;
    let worstStart = 0;
    let worstAvg = -Infinity;

    for (let i = 0; i <= slots.length - windowSize; i += 1) {
      let sum = 0;
      for (let j = i; j < i + windowSize; j += 1) {
        sum += Number(slots[j].PredictedIntensity) || 0;
      }
      const avg = sum / windowSize;
      if (avg < bestAvg) {
        bestAvg = avg;
        bestStart = i;
      }
      if (avg > worstAvg) {
        worstAvg = avg;
        worstStart = i;
      }
    }

    const bestEnd = bestStart + windowSize - 1;
    const worstEnd = worstStart + windowSize - 1;

    const optStartStr = trichGioUtc(slots[bestStart].TargetFromTime || slots[bestStart].TimeSlotUTC, false);
    const optEndStr = trichGioUtc(slots[bestEnd].TargetToTime || slots[bestEnd].TimeSlotUTC, true);

    const peakStartStr = trichGioUtc(slots[worstStart].TargetFromTime || slots[worstStart].TimeSlotUTC, false);
    const peakEndStr = trichGioUtc(slots[worstEnd].TargetToTime || slots[worstEnd].TimeSlotUTC, true);

    const co2SavedKg = ((worstAvg - bestAvg) * validKwh) / 1000;
    const savingPercent = worstAvg > 0 ? ((worstAvg - bestAvg) / worstAvg) * 100 : 0;

    return {
      windowSize,
      validHours,
      validKwh,
      bestStart,
      bestEnd,
      worstStart,
      worstEnd,
      optimalRange: `${optStartStr} – ${optEndStr} UTC`,
      peakRange: `${peakStartStr} – ${peakEndStr} UTC`,
      optimalAvg: bestAvg,
      peakAvg: worstAvg,
      co2SavedKg,
      savingPercent,
    };
  }, [data, durationHours, batteryKwh]);

  // Chuẩn bị tọa độ biểu đồ SVG từ chính mảng data.slots
  const chartMeta = useMemo(() => {
    const slots = Array.isArray(data?.slots) ? data.slots : [];
    if (slots.length === 0) return null;

    const width = 820;
    const height = 250;
    const padLeft = 46;
    const padRight = 24;
    const padTop = 34;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const values = slots.map((s) => Number(s.PredictedIntensity) || 0);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    const yMin = Math.max(0, Math.floor((rawMin - 20) / 50) * 50);
    const yMax = Math.max(yMin + 100, Math.ceil((rawMax + 25) / 50) * 50);

    const yTicks = [];
    for (let v = yMin; v <= yMax; v += 50) {
      yTicks.push(v);
    }

    const toX = (i) => {
      if (slots.length <= 1) return padLeft + plotW / 2;
      return padLeft + (i / (slots.length - 1)) * plotW;
    };

    const toY = (val) => {
      const ratio = (val - yMin) / (yMax - yMin || 1);
      return padTop + plotH - ratio * plotH;
    };

    const points = slots.map((s, i) => {
      const val = Number(s.PredictedIntensity) || 0;
      const fromUtc = trichGioUtc(s.TargetFromTime || s.TimeSlotUTC, false);
      const toUtc = trichGioUtc(s.TargetToTime || s.TimeSlotUTC, true);
      return {
        index: i,
        raw: s,
        val,
        x: toX(i),
        y: toY(val),
        labelRange: `${fromUtc}–${toUtc}`,
      };
    });

    const linePath = points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
      padTop + plotH
    ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

    let minPt = points[0];
    let maxPt = points[0];
    for (const p of points) {
      if (p.val < minPt.val) minPt = p;
      if (p.val > maxPt.val) maxPt = p;
    }

    const xLabels = [
      { text: "00:00", x: toX(0) },
      { text: "06:00", x: padLeft + plotW * 0.25 },
      { text: "12:00", x: padLeft + plotW * 0.5 },
      { text: "18:00", x: padLeft + plotW * 0.75 },
      { text: "24:00", x: padLeft + plotW },
    ];

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      yTicks,
      toX,
      toY,
      points,
      linePath,
      areaPath,
      minPt,
      maxPt,
      xLabels,
    };
  }, [data]);

  // Xuất CSV từ chính dữ liệu dự báo & trạng thái sạc EV
  const handleXuatCsv = () => {
    const slots = data?.slots || [];
    if (!slots.length) return;

    const headers = [
      "Khung_Gio_UTC",
      "Cuong_Do_Du_Bao_gCO2_kWh",
      "Phan_Loai",
      "Khuyen_Nghi_Sac_EV",
    ];

    const rows = slots.map((s, idx) => {
      const fromUtc = trichGioUtc(s.TargetFromTime || s.TimeSlotUTC, false);
      const toUtc = trichGioUtc(s.TargetToTime || s.TimeSlotUTC, true);
      let trangThai = "Bình thường";
      if (evAnalysis && idx >= evAnalysis.bestStart && idx <= evAnalysis.bestEnd) {
        trangThai = "Nên sạc (Tối ưu)";
      } else if (evAnalysis && idx >= evAnalysis.worstStart && idx <= evAnalysis.worstEnd) {
        trangThai = "Tránh sạc (Cao điểm)";
      }
      return [
        `${fromUtc}-${toUtc}`,
        s.PredictedIntensity,
        s.PredictedClass || "",
        trangThai,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `du-bao-sac-ev-${data?.target_date_utc || "ngay-mai"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const slots = Array.isArray(data?.slots) ? data.slots : [];
  const filteredSlots = useMemo(() => {
    return slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ index }) => {
        if (!chiXemKhungTot || !evAnalysis) return true;
        return index >= evAnalysis.bestStart && index <= evAnalysis.bestEnd;
      });
  }, [slots, chiXemKhungTot, evAnalysis]);

  const dateFormatted = dinhDangNgayVietNam(data?.target_date_utc);
  const regionShort = (data?.region || "Great Britain").split(" (")[0];
  const recommendedLowRange = layKhungThapNhatHeThong(data);
  const activePoint =
    hoveredIdx !== null && chartMeta?.points[hoveredIdx]
      ? chartMeta.points[hoveredIdx]
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Thanh điều khiển tham số sạc EV */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <BatteryCharging size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Dự Báo Cường Độ Carbon &amp; Tối Ưu Lịch Sạc EV
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Dữ liệu hợp nhất từ mô hình dự báo ML ({data?.model_version || "48 mốc 30 phút UTC"})
            </p>
          </div>
        </div>

        {/* Bộ 2 ô nhập thông số */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-slate-400" /> Thời lượng sạc (giờ)
            </span>
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
            >
              {[0.5, 1, 1.5, 2, 3, 4, 6, 8].map((h) => (
                <option key={h} value={h}>
                  {h} giờ ({h * 2} mốc)
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1">
              <Zap size={13} className="text-slate-400" /> Dung lượng nạp (kWh)
            </span>
            <input
              type="number"
              min={1}
              max={300}
              step={1}
              value={batteryKwh}
              onChange={(e) => setBatteryKwh(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
            />
          </label>
        </div>
      </div>

      {/* Trạng thái tải hoặc lỗi */}
      {loading && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 text-sm text-slate-500">
          Đang tải dữ liệu dự báo 48 mốc 30 phút (UTC)...
        </div>
      )}

      {!loading && errorMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
          <strong>Không thể tải dữ liệu dự báo:</strong> {errorMsg}
        </div>
      )}

      {/* 2. Cụm 3 thẻ KPI sạc EV (nằm gọn trên 1 hàng) */}
      {!loading && !errorMsg && evAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Thẻ 1: Khung giờ tối ưu */}
          <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-100 text-xs font-semibold uppercase tracking-wide">
              <span>Khung Giờ Tối Ưu (Nên Sạc)</span>
              <Zap size={17} />
            </div>
            <div className="mt-3 text-lg sm:text-xl xl:text-2xl font-extrabold tracking-tight tabular-nums whitespace-nowrap">
              {evAnalysis.optimalRange}
            </div>
            <p className="mt-2 text-xs text-emerald-100">
              Cường độ TB:{" "}
              <strong>{evAnalysis.optimalAvg.toFixed(1)} gCO₂/kWh</strong> • Phiên{" "}
              {evAnalysis.validHours}h
            </p>
          </div>

          {/* Thẻ 2: Lượng phát thải tiết kiệm */}
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wide">
              <span>Lượng Phát Thải Tiết Kiệm</span>
              <TrendingDown size={17} className="text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-3 flex-nowrap">
              <span className="text-2xl xl:text-3xl font-extrabold text-emerald-700 tabular-nums whitespace-nowrap">
                {evAnalysis.co2SavedKg.toFixed(2)} kg
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold whitespace-nowrap">
                -{evAnalysis.savingPercent.toFixed(1)}% CO₂
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Tính cho lượng điện nạp{" "}
              <strong>{evAnalysis.validKwh} kWh</strong> so với giờ cao điểm
            </p>
          </div>

          {/* Thẻ 3: Khung giờ cao điểm */}
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wide">
              <span>Khung Giờ Cao Điểm (Tránh Sạc)</span>
              <Flame size={17} className="text-red-600" />
            </div>
            <div className="mt-3 text-lg sm:text-xl xl:text-2xl font-extrabold text-red-600 tracking-tight tabular-nums whitespace-nowrap">
              {evAnalysis.peakRange}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Cường độ đỉnh:{" "}
              <strong>{evAnalysis.peakAvg.toFixed(1)} gCO₂/kWh</strong>
            </p>
          </div>
        </div>
      )}

      {/* 3. Biểu đồ Dự báo carbon ngày mai */}
      {!loading && !errorMsg && data && chartMeta && evAnalysis && (
        <section
          aria-label="Dự báo carbon ngày mai"
          className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Dự báo carbon ngày mai
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                📅 {dateFormatted} · {regionShort} · {data.timezone || "UTC"} ·{" "}
                {data.total_slots ?? slots.length} mốc ({data.interval_minutes ?? 30} phút/mốc)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-600" />
                Vùng sạc EV tối ưu ({evAnalysis.validHours}h)
              </span>
              {activePoint && (
                <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                  {activePoint.labelRange} UTC · {activePoint.val} gCO₂/kWh
                </span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 mb-1">gCO₂/kWh</div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartMeta.width} ${chartMeta.height}`}
              className="w-full min-w-[600px] h-auto block"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="forecastAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Lưới ngang & trục Y */}
              {chartMeta.yTicks.map((tick) => {
                const yPos = chartMeta.toY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={chartMeta.padLeft}
                      x2={chartMeta.width - chartMeta.padRight}
                      y1={yPos}
                      y2={yPos}
                      stroke="#eef2f6"
                      strokeWidth="1"
                    />
                    <text
                      x={chartMeta.padLeft - 8}
                      y={yPos + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#64748b"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Tô vùng khung giờ sạc EV tối ưu ngay trên biểu đồ */}
              {chartMeta.points[evAnalysis.bestStart] &&
                chartMeta.points[evAnalysis.bestEnd] && (
                  <rect
                    x={chartMeta.points[evAnalysis.bestStart].x}
                    y={chartMeta.padTop}
                    width={Math.max(
                      8,
                      chartMeta.points[evAnalysis.bestEnd].x -
                        chartMeta.points[evAnalysis.bestStart].x
                    )}
                    height={chartMeta.plotH}
                    fill="#10b981"
                    fillOpacity="0.14"
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                )}

              {/* Nhãn trục X */}
              {chartMeta.xLabels.map((lbl) => (
                <text
                  key={lbl.text}
                  x={lbl.x}
                  y={chartMeta.height - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {lbl.text}
                </text>
              ))}

              {/* Vùng tô bóng & đường dự báo */}
              <path d={chartMeta.areaPath} fill="url(#forecastAreaGrad)" />
              <path
                d={chartMeta.linePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Điểm tương tác khi rê chuột */}
              {chartMeta.points.map((pt) => (
                <circle
                  key={pt.index}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIdx === pt.index ? 5 : 9}
                  fill={hoveredIdx === pt.index ? "#2563eb" : "transparent"}
                  stroke={hoveredIdx === pt.index ? "#ffffff" : "transparent"}
                  strokeWidth="1.5"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIdx(pt.index)}
                />
              ))}

              {/* Mốc đơn lẻ thấp nhất */}
              <g>
                <line
                  x1={chartMeta.minPt.x}
                  y1={chartMeta.minPt.y - 16}
                  x2={chartMeta.minPt.x}
                  y2={chartMeta.minPt.y}
                  stroke="#10b981"
                  strokeWidth="1.2"
                />
                <circle
                  cx={chartMeta.minPt.x}
                  cy={chartMeta.minPt.y}
                  r="4.5"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <rect
                  x={Math.min(
                    Math.max(chartMeta.padLeft, chartMeta.minPt.x - 68),
                    chartMeta.width - chartMeta.padRight - 136
                  )}
                  y={Math.max(4, chartMeta.minPt.y - 36)}
                  width="136"
                  height="20"
                  rx="6"
                  fill="#ecfdf5"
                  stroke="#10b981"
                  strokeWidth="1"
                />
                <text
                  x={
                    Math.min(
                      Math.max(chartMeta.padLeft, chartMeta.minPt.x - 68),
                      chartMeta.width - chartMeta.padRight - 136
                    ) + 68
                  }
                  y={Math.max(4, chartMeta.minPt.y - 36) + 13.5}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="600"
                  fill="#047857"
                >
                  Thấp: {chartMeta.minPt.labelRange} · {chartMeta.minPt.val}g
                </text>
              </g>

              {/* Mốc đơn lẻ cao nhất */}
              <g>
                <line
                  x1={chartMeta.maxPt.x}
                  y1={chartMeta.maxPt.y - 16}
                  x2={chartMeta.maxPt.x}
                  y2={chartMeta.maxPt.y}
                  stroke="#7c3aed"
                  strokeWidth="1.2"
                />
                <circle
                  cx={chartMeta.maxPt.x}
                  cy={chartMeta.maxPt.y}
                  r="4.5"
                  fill="#7c3aed"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <rect
                  x={Math.min(
                    Math.max(chartMeta.padLeft, chartMeta.maxPt.x - 68),
                    chartMeta.width - chartMeta.padRight - 136
                  )}
                  y={Math.max(4, chartMeta.maxPt.y - 36)}
                  width="136"
                  height="20"
                  rx="6"
                  fill="#f5f3ff"
                  stroke="#7c3aed"
                  strokeWidth="1"
                />
                <text
                  x={
                    Math.min(
                      Math.max(chartMeta.padLeft, chartMeta.maxPt.x - 68),
                      chartMeta.width - chartMeta.padRight - 136
                    ) + 68
                  }
                  y={Math.max(4, chartMeta.maxPt.y - 36) + 13.5}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="600"
                  fill="#5b21b6"
                >
                  Cao: {chartMeta.maxPt.labelRange} · {chartMeta.maxPt.val}g
                </text>
              </g>
            </svg>
          </div>

          {/* Thanh tổng hợp gợi ý dưới chân biểu đồ */}
          <div className="mt-4 bg-emerald-50/90 border border-emerald-200/70 rounded-xl px-4 py-3 text-xs sm:text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Leaf size={16} className="text-emerald-700 shrink-0" />
              <span>
                Khoảng carbon thấp nhất toàn ngày:{" "}
                <strong>{recommendedLowRange || evAnalysis.optimalRange}</strong>
              </span>
            </div>
            <div>
              Khuyến nghị sạc EV ({evAnalysis.validHours}h):{" "}
              <strong className="text-emerald-800">{evAnalysis.optimalRange}</strong>
            </div>
          </div>
        </section>
      )}

      {/* 4. Bảng chi tiết 48 chu kỳ 30 phút */}
      {!loading && !errorMsg && slots.length > 0 && evAnalysis && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Chi tiết dự báo từng chu kỳ 30 phút
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hiển thị {filteredSlots.length}/{slots.length} khung giờ dự báo ngày{" "}
                {dateFormatted}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setChiXemKhungTot((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  chiXemKhungTot
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {chiXemKhungTot ? "Hiện tất cả 48 mốc" : "Chỉ xem khung nên sạc"}
              </button>

              <button
                type="button"
                onClick={handleXuatCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
              >
                <Download size={14} /> Xuất CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold sticky top-0">
                <tr>
                  <th className="py-3 px-4 border-b border-slate-200">Khung giờ (UTC)</th>
                  <th className="py-3 px-4 border-b border-slate-200">Cường độ dự báo</th>
                  <th className="py-3 px-4 border-b border-slate-200">Khoảng tin cậy</th>
                  <th className="py-3 px-4 border-b border-slate-200">Phân loại</th>
                  <th className="py-3 px-4 border-b border-slate-200">Đánh giá sạc EV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSlots.map(({ slot, index }) => {
                  const fromUtc = trichGioUtc(slot.TargetFromTime || slot.TimeSlotUTC, false);
                  const toUtc = trichGioUtc(slot.TargetToTime || slot.TimeSlotUTC, true);
                  const isOptimal =
                    index >= evAnalysis.bestStart && index <= evAnalysis.bestEnd;
                  const isPeak =
                    index >= evAnalysis.worstStart && index <= evAnalysis.worstEnd;

                  return (
                    <tr
                      key={slot.PredId || index}
                      className={
                        isOptimal
                          ? "bg-emerald-50/60"
                          : isPeak
                            ? "bg-red-50/40"
                            : "hover:bg-slate-50/70"
                      }
                    >
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                        {fromUtc} – {toUtc}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {slot.PredictedIntensity} gCO₂/kWh
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-xs">
                        {slot.ConfidenceLower != null && slot.ConfidenceUpper != null
                          ? `${slot.ConfidenceLower} – ${slot.ConfidenceUpper}`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 capitalize">
                        {slot.PredictedClass || "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        {isOptimal ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            Nên sạc (Tối ưu)
                          </span>
                        ) : isPeak ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            Tránh sạc (Cao điểm)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Bình thường</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}