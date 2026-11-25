//Tổng quan lưới điện + cơ cấu nguồn điện
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Activity, Flame, Info, Leaf, RefreshCw, Zap } from "lucide-react";
import {
  layCoCauNguonDienHienTai,
  layMaTranTuongQuan,
  trichXuatThongBaoLoi,
} from "../api/duLieuCarbonApi";

const MAU_NGUON_DIEN = {
  wind: "#16a34a",
  solar: "#eab308",
  nuclear: "#6366f1",
  hydro: "#0284c7",
  biomass: "#0d9488",
  gas: "#ea580c",
  coal: "#334155",
  imports: "#64748b",
  other: "#94a3b8",
};

function layMauOHeatmap(r) {
  if (r === null || r === undefined) {
    return { backgroundColor: "#f1f5f9", color: "#64748b" };
  }
  const val = Math.max(-1, Math.min(1, r));
  if (val < 0) {
    const alpha = 0.14 + Math.abs(val) * 0.72;
    return {
      backgroundColor: `rgba(22, 163, 74, ${alpha.toFixed(2)})`,
      color: Math.abs(val) > 0.55 ? "#ffffff" : "#14532d",
    };
  }
  const alpha = 0.14 + val * 0.72;
  return {
    backgroundColor: `rgba(220, 38, 38, ${alpha.toFixed(2)})`,
    color: val > 0.55 ? "#ffffff" : "#7f1d1d",
  };
}

function dinhDangKhungGio(fromStr, toStr) {
  if (!fromStr || !toStr) return "Chưa có dữ liệu thời gian";
  const f = new Date(fromStr);
  const t = new Date(toStr);
  if (Number.isNaN(f.getTime())) return "Chưa có dữ liệu thời gian";
  const fmtStart = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const fmtEnd = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmtStart.format(f)} - ${fmtEnd.format(t)}`;
}

export default function TrangTongQuanLuoiDien() {
  const [mixData, setMixData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const taiDuLieu = useCallback(async (soNgay) => {
    setLoading(true);
    try {
      const [mix, heatmap] = await Promise.all([
        layCoCauNguonDienHienTai(),
        layMaTranTuongQuan(soNgay),
      ]);
      setMixData(mix);
      setHeatmapData(heatmap);
      setError("");
    } catch (err) {
      setError(trichXuatThongBaoLoi(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    taiDuLieu(days);
  }, [days, taiDuLieu]);

  const fuels = useMemo(() => {
    if (!Array.isArray(mixData?.fuels)) return [];
    return mixData.fuels.map((f) => ({
      ...f,
      color: MAU_NGUON_DIEN[f.fuel_key] || "#3b82f6",
    }));
  }, [mixData]);

  const matrixLookup = useMemo(() => {
    const map = {};
    if (Array.isArray(heatmapData?.matrix_data)) {
      heatmapData.matrix_data.forEach(([x, y, r]) => {
        map[`${x}-${y}`] = r;
      });
    }
    return map;
  }, [heatmapData]);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-900">
      {/* 1. Thanh tiêu đề */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Activity size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Cơ Cấu Năng Lượng &amp; Phân Tích Tương Quan
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Tổng Quan Lưới Điện &amp; Cơ Cấu Nguồn Phát
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
            Chu kỳ: {dinhDangKhungGio(mixData?.from_time, mixData?.to_time)}
          </span>
          <button
            type="button"
            onClick={() => taiDuLieu(days)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <strong>Chưa tải được dữ liệu năng lượng:</strong> {error}
        </div>
      )}

      {/* 2. Hàng 4 thẻ KPI từ GenerationMixResponse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-sm">
          <div className="flex items-center justify-between text-emerald-100 text-xs font-semibold uppercase tracking-wide">
            <span>Cường độ Carbon Hiện Tại</span>
            <Zap size={17} />
          </div>
          <div className="flex items-baseline gap-1.5 mt-3">
            <span className="text-3xl font-extrabold tracking-tight">
              {loading ? "…" : mixData?.intensity_actual ?? mixData?.intensity_forecast ?? "—"}
            </span>
            <span className="text-xs text-emerald-100">gCO₂/kWh</span>
          </div>
          <p className="mt-2 text-xs text-emerald-100">
            Dự báo chu kỳ: <strong>{mixData?.intensity_forecast ?? "—"} gCO₂/kWh</strong>
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wide">
            <span>Năng Lượng Sạch (Clean)</span>
            <Leaf size={17} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-3">
            <span className="text-3xl font-extrabold text-emerald-700">
              {loading ? "…" : mixData ? `${mixData.clean_total_perc.toFixed(1)}%` : "—"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Tái tạo &amp; không phát thải trực tiếp
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wide">
            <span>Nhiệt Điện Hóa Thạch</span>
            <Flame size={17} className="text-orange-600" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-3">
            <span className="text-3xl font-extrabold text-orange-600">
              {loading ? "…" : mixData ? `${mixData.fossil_total_perc.toFixed(1)}%` : "—"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Nguồn phát thải carbon cao trên lưới
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wide">
            <span>Điện Nhập Khẩu (Imports)</span>
            <Activity size={17} className="text-slate-600" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-3">
            <span className="text-3xl font-extrabold text-slate-800">
              {loading ? "…" : mixData ? `${mixData.imports_perc.toFixed(1)}%` : "—"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Trao đổi điện qua lưới liên kết
          </p>
        </div>
      </div>

      {/* 3. Khu vực 2 cột: Biểu đồ Tròn Cơ cấu nguồn điện (Trái) & Ma trận tương quan Pearson (Phải) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Cột Trái (5/12): Biểu đồ tròn Donut Cơ cấu nguồn phát */}
        <div className="xl:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Cơ Cấu Nguồn Phát Điện Quốc Gia
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Biểu đồ tỷ trọng phần trăm (%) theo từng loại hình nguồn phát
            </p>
          </div>

          {fuels.length > 0 ? (
            <>
              {/* Biểu đồ tròn Donut Recharts */}
              <div className="relative w-full h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fuels}
                      dataKey="percentage"
                      nameKey="fuel_name"
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={105}
                      paddingAngle={2}
                    >
                      {fuels.map((entry) => (
                        <Cell key={entry.fuel_key} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Nhãn tổng hợp ở tâm biểu đồ tròn */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">
                    Nguồn sạch
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-700">
                    {mixData?.clean_total_perc?.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Danh sách chú thích chi tiết từng nguồn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {fuels.map((f) => (
                  <div
                    key={f.fuel_key}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {f.fuel_name}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 ml-2">
                      {f.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">
              {loading ? "Đang tải biểu đồ cơ cấu nguồn điện..." : "Chưa có dữ liệu nguồn điện."}
            </div>
          )}
        </div>

        {/* Cột Phải (7/12): Ma trận tương quan Pearson */}
        <div className="xl:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ma Trận Tương Quan Pearson (Nguồn Điện &amp; Carbon)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {heatmapData
                  ? `Phân tích ${heatmapData.days_analyzed} ngày lịch sử (${heatmapData.total_samples} chu kỳ đo)`
                  : "Hệ số r từ -1.0 (giảm phát thải) đến +1.0 (tăng phát thải)"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="days-filter" className="text-xs font-semibold text-slate-600">
                Khoảng thời gian:
              </label>
              <select
                id="days-filter"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value={7}>7 ngày qua</option>
                <option value={30}>30 ngày qua</option>
                <option value={90}>90 ngày qua</option>
                <option value={180}>180 ngày qua</option>
                <option value={365}>365 ngày qua</option>
              </select>
            </div>
          </div>

          {heatmapData?.labels?.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 text-xs">
                  <thead>
                    <tr>
                      <th className="p-1" />
                      {heatmapData.labels.map((lbl) => (
                        <th
                          key={lbl}
                          className="p-1.5 text-center font-bold text-slate-600 whitespace-nowrap"
                        >
                          {lbl}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.labels.map((rowLabel, y) => (
                      <tr key={rowLabel}>
                        <th className="pr-2 py-1 text-right font-bold text-slate-700 whitespace-nowrap">
                          {rowLabel}
                        </th>
                        {heatmapData.labels.map((colLabel, x) => {
                          const rVal = matrixLookup[`${x}-${y}`];
                          return (
                            <td
                              key={`${x}-${y}`}
                              style={layMauOHeatmap(rVal)}
                              className="h-9 min-w-[48px] rounded-md text-center font-bold tabular-nums"
                              title={`${rowLabel} vs ${colLabel}: r = ${
                                rVal !== undefined ? rVal.toFixed(2) : "N/A"
                              }`}
                            >
                              {rVal !== undefined ? rVal.toFixed(2) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-slate-700 space-y-2">
                <div className="flex flex-wrap gap-4">
                  <span>
                    <strong className="text-emerald-800">Nhân tố giảm carbon mạnh nhất:</strong>{" "}
                    {heatmapData.strongest_negative_driver}
                  </span>
                  <span>
                    <strong className="text-red-700">Nhân tố tăng carbon mạnh nhất:</strong>{" "}
                    {heatmapData.strongest_positive_driver}
                  </span>
                </div>
                <div className="flex items-start gap-2 pt-1 border-t border-emerald-200/60">
                  <Info size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{heatmapData.insight_summary}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">
              {loading ? "Đang tính toán ma trận tương quan..." : "Chưa có dữ liệu ma trận tương quan."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}