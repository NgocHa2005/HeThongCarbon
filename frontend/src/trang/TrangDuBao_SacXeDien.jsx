//gợi ý sạc xe
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BatteryCharging,
  Calendar,
  Clock,
  Download,
  Flame,
  TrendingDown,
  Zap,
} from "lucide-react";
import { layGoiYSacXeDien, trichXuatThongBaoLoi } from "../api/duLieuCarbonApi";

function dinhDangGio(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "—";
  const gioUtc = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
  return `${gioUtc} UTC`;
}

function dinhDangNgay(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function layStyleBadge(cls) {
  const norm = (cls || "").toLowerCase().replace(/\s+/g, "-");
  if (norm.includes("very-low") || norm.includes("low")) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (norm.includes("moderate")) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-red-100 text-red-800";
}

export default function TrangDuBao_SacXeDien() {
  // 2 tham số đầu vào khớp chính xác query params của GET /api/ev/recommendation
  const [durationHours, setDurationHours] = useState(2.0);
  const [batteryKwh, setBatteryKwh] = useState(60.0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const taiGoiY = useCallback(async (hours, kwh) => {
    setLoading(true);
    try {
      const res = await layGoiYSacXeDien(hours, kwh);
      setData(res);
      setError("");
    } catch (err) {
      setError(trichXuatThongBaoLoi(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    taiGoiY(2.0, 60.0);
  }, [taiGoiY]);

  const handleTinhToan = (e) => {
    e.preventDefault();
    const validHours = Math.min(12, Math.max(0.5, Number(durationHours) || 2.0));
    const validKwh = Math.min(200, Math.max(5, Number(batteryKwh) || 60.0));
    setDurationHours(validHours);
    setBatteryKwh(validKwh);
    taiGoiY(validHours, validKwh);
  };

  const chartSlots = useMemo(() => {
    if (!Array.isArray(data?.slots)) return [];
    const optStart = data?.optimal_start_time ? new Date(data.optimal_start_time).getTime() : null;
    const optEnd = data?.optimal_end_time ? new Date(data.optimal_end_time).getTime() : null;

    return data.slots.map((slot) => {
      const startMs = new Date(slot.from_time).getTime();
      const isOptimal =
        optStart !== null && optEnd !== null && startMs >= optStart && startMs < optEnd;
      return {
        ...slot,
        timeLabel: dinhDangGio(slot.from_time),
        rangeLabel: `${dinhDangGio(slot.from_time)} - ${dinhDangGio(slot.to_time)}`,
        isOptimal,
      };
    });
  }, [data]);

  const handleXuatCsv = () => {
    if (!chartSlots.length) return;
    const header = "Khung_Gio,Cuong_Do_Du_Bao_gCO2_kWh,Phan_Loai,Khung_Toi_Uu\n";
    const rows = chartSlots
      .map(
        (s) =>
          `${s.rangeLabel},${s.predicted_intensity},${s.predicted_class},${
            s.isOptimal ? "Nen_sac" : "Thuong"
          }`
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `goi-y-sac-ev-${data?.target_date || "du-bao"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-900">
      {/* 1. Thanh tiêu đề & Form nhập số giờ sạc + số kWh điện muốn sạc */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <BatteryCharging size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              {data?.region_scope || "Toàn quốc (Great Britain)"} • Ngày dự báo:{" "}
              {dinhDangNgay(data?.target_date)}
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Dự Báo Cường Độ Carbon &amp; Gợi Ý Khung Giờ Sạc Xe Điện
            </h1>
          </div>
        </div>

        {/* Form nhập duration_hours & battery_kwh */}
        <form onSubmit={handleTinhToan} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="input-hours" className="text-xs font-semibold text-slate-600">
              Số giờ muốn sạc (0.5 - 12h)
            </label>
            <div className="relative flex items-center">
              <Clock size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                id="input-hours"
                type="number"
                min="0.5"
                max="12"
                step="0.5"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-32 pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="input-kwh" className="text-xs font-semibold text-slate-600">
              Lượng điện sạc (5 - 200 kWh)
            </label>
            <div className="relative flex items-center">
              <Zap size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                id="input-kwh"
                type="number"
                min="5"
                max="200"
                step="1"
                value={batteryKwh}
                onChange={(e) => setBatteryKwh(e.target.value)}
                className="w-36 pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold shadow-sm cursor-pointer transition-colors"
          >
            <Zap size={16} />
            <span>{loading ? "Đang tính toán..." : "Gợi ý giờ sạc"}</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <strong>Không thể tải gợi ý sạc xe điện:</strong> {error}
        </div>
      )}

      {/* 2. Hàng 3 Thẻ kết quả từ EvRecommendationResponse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Thẻ 1: Khung Giờ Tối Ưu */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-100 text-xs font-semibold uppercase tracking-wide">
            <span>Khung Giờ Tối Ưu (Nên Sạc)</span>
            <Zap size={17} />
          </div>
          <div className="mt-3 text-lg sm:text-xl xl:text-2xl font-extrabold tracking-tight tabular-nums whitespace-nowrap">
            {data
              ? `${dinhDangGio(data.optimal_start_time).replace(" UTC", "")} – ${dinhDangGio(data.optimal_end_time)}`
              : "—"}
          </div>
          <p className="mt-2 text-xs text-emerald-100">
            Cường độ TB:{" "}
            <strong>{data ? `${data.optimal_avg_intensity.toFixed(1)} gCO₂/kWh` : "—"}</strong> •
            Phiên {data?.duration_hours ?? durationHours}h
          </p>
        </div>

        {/* Thẻ 2: Lượng Phát Thải Tiết Kiệm */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wide">
            <span>Lượng Phát Thải Tiết Kiệm</span>
            <TrendingDown size={17} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-3 flex-nowrap">
            <span className="text-2xl xl:text-3xl font-extrabold text-emerald-700 tabular-nums whitespace-nowrap">
              {data ? `${data.co2_saved_kg.toFixed(2)} kg` : "—"}
            </span>
            {data && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold whitespace-nowrap">
                -{data.saving_percent.toFixed(1)}% CO₂
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Tính cho lượng điện nạp <strong>{data?.battery_kwh ?? batteryKwh} kWh</strong> so với giờ cao điểm
          </p>
        </div>

        {/* Thẻ 3: Khung Giờ Cao Điểm */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wide">
            <span>Khung Giờ Cao Điểm (Tránh Sạc)</span>
            <Flame size={17} className="text-red-600" />
          </div>
          <div className="mt-3 text-lg sm:text-xl xl:text-2xl font-extrabold text-red-600 tracking-tight tabular-nums whitespace-nowrap">
            {data
              ? `${dinhDangGio(data.peak_start_time).replace(" UTC", "")} – ${dinhDangGio(data.peak_end_time)}`
              : "—"}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Cường độ đỉnh:{" "}
            <strong>{data ? `${data.peak_avg_intensity.toFixed(1)} gCO₂/kWh` : "—"}</strong>
          </p>
        </div>
      </div>

      {/* Lời khuyên tổng hợp từ Backend */}
      {data?.advice_summary && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-sm leading-relaxed">
          <strong>Khuyến nghị từ hệ thống:</strong> {data.advice_summary}
        </div>
      )}

      {/* 3. Biểu đồ cột các khung giờ dự báo (Recharts) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Biểu Đồ Dự Báo Cường Độ Carbon Theo Khung Giờ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Các cột màu xanh lá là khung giờ tối ưu được hệ thống chọn cho phiên sạc{" "}
              {data?.duration_hours ?? durationHours} giờ
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="w-3 h-3 rounded bg-emerald-600" /> Khung giờ tối ưu
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-slate-400" /> Khung giờ khác
            </span>
          </div>
        </div>

        {chartSlots.length > 0 ? (
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSlots} margin={{ top: 12, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 11, fill: "#475569" }} unit=" g" />
                <Tooltip
                  formatter={(value) => [`${value} gCO₂/kWh`, "Cường độ dự báo"]}
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.rangeLabel || `Khung ${label}`
                  }
                />
                {data?.optimal_avg_intensity && (
                  <ReferenceLine
                    y={data.optimal_avg_intensity}
                    stroke="#16a34a"
                    strokeDasharray="4 4"
                  />
                )}
                <Bar dataKey="predicted_intensity" radius={[4, 4, 0, 0]}>
                  {chartSlots.map((entry, idx) => (
                    <Cell
                      key={`slot-${idx}`}
                      fill={
                        entry.isOptimal
                          ? "#16a34a"
                          : entry.predicted_intensity > 200
                          ? "#dc2626"
                          : "#94a3b8"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-400">
            {loading ? "Đang tải dữ liệu khung giờ dự báo..." : "Chưa có dữ liệu khung giờ dự báo."}
          </div>
        )}
      </div>

      {/* 4. Bảng chi tiết các khung giờ dự báo từ API */}
      {chartSlots.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Bảng Chi Tiết Các Khung Giờ Dự Báo ({chartSlots.length} chu kỳ)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dữ liệu từng khung giờ và phân loại cường độ phát thải
              </p>
            </div>
            <button
              type="button"
              onClick={handleXuatCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer transition-colors self-start"
            >
              <Download size={14} />
              <span>Xuất file CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">Khung giờ</th>
                  <th className="py-3 px-4 font-bold">Cường độ dự báo</th>
                  <th className="py-3 px-4 font-bold">Phân loại</th>
                  <th className="py-3 px-4 font-bold text-right">Trạng thái khuyến nghị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chartSlots.map((slot, index) => (
                  <tr
                    key={`${slot.from_time}-${index}`}
                    className={slot.isOptimal ? "bg-emerald-50/70" : "hover:bg-slate-50"}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        {slot.rangeLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {slot.predicted_intensity} gCO₂/kWh
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${layStyleBadge(
                          slot.predicted_class
                        )}`}
                      >
                        {slot.predicted_class}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {slot.isOptimal ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">
                          <Zap size={13} /> Khung giờ vàng — Nên sạc
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Khung thông thường</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}