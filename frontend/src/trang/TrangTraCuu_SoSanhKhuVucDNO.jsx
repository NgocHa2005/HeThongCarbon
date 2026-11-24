//tra cứu và so sách các khu vực
import React, { useCallback, useEffect, useState } from "react";
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
import { ArrowDownRight, ArrowUpRight, Info, MapPin } from "lucide-react";
import {
  layDanhSachKhuVuc,
  layTrangThaiKhuVuc,
  layXepHangVungDno,
  trichXuatThongBaoLoi,
} from "../api/duLieuCarbonApi";

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

export default function TrangTraCuu_SoSanhKhuVucDNO() {
  const [regions, setRegions] = useState([]);
  const [rankingData, setRankingData] = useState(null);
  const [selectedRegionId, setSelectedRegionId] = useState(13);
  const [regionStatus, setRegionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function taiKhoiTao() {
      setLoading(true);
      try {
        const [regionList, ranking] = await Promise.all([
          layDanhSachKhuVuc(),
          layXepHangVungDno(),
        ]);
        if (!isMounted) return;
        setRegions(Array.isArray(regionList) ? regionList : []);
        setRankingData(ranking);

        if (Array.isArray(ranking?.rankings) && ranking.rankings.length > 0) {
          const hasDefault = ranking.rankings.some((r) => r.region_id === 13);
          if (!hasDefault) {
            setSelectedRegionId(ranking.rankings[0].region_id);
          }
        }
        setError("");
      } catch (err) {
        if (isMounted) setError(trichXuatThongBaoLoi(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    taiKhoiTao();
    return () => {
      isMounted = false;
    };
  }, []);

  const taiChiTietVung = useCallback(async (regId) => {
    if (!regId) return;
    try {
      const status = await layTrangThaiKhuVuc(regId);
      setRegionStatus(status);
      setError("");
    } catch (err) {
      setError(trichXuatThongBaoLoi(err));
    }
  }, []);

  useEffect(() => {
    taiChiTietVung(selectedRegionId);
  }, [selectedRegionId, taiChiTietVung]);

  const rankings = Array.isArray(rankingData?.rankings) ? rankingData.rankings : [];
  const nationalIntensity =
    regionStatus?.national_intensity ?? rankingData?.national_intensity ?? null;
  const isHigher = (regionStatus?.diff_value ?? 0) > 0;
  const currentRank = rankings.find((r) => r.region_id === selectedRegionId)?.rank;

  return (
    <div className="flex flex-col gap-6 w-full text-slate-900">
      {/* 1. Thanh tiêu đề & Bộ chọn khu vực */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Phân Tích Địa Phương • 14 Vùng Phân Phối Điện DNO
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Tra Cứu &amp; So Sánh Cường Độ Carbon Khu Vực
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <label htmlFor="select-dno" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            Chọn khu vực:
          </label>
          <select
            id="select-dno"
            value={selectedRegionId}
            onChange={(e) => setSelectedRegionId(Number(e.target.value))}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {(regions.length > 0 ? regions : rankings).map((r) => (
              <option key={r.region_id} value={r.region_id}>
                #{r.region_id} — {r.short_name} ({r.full_name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <strong>Không thể tải dữ liệu khu vực:</strong> {error}
        </div>
      )}

      {/* 2. Bố cục 2 cột: Chi tiết vùng đang chọn (Trái) & Xếp hạng 14 DNO (Phải) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Cột Trái (5/12): Chi tiết trạng thái khu vực đang chọn */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          <div className="rounded-2xl p-6 bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                {regionStatus
                  ? `${regionStatus.short_name} • ${regionStatus.full_name}`
                  : "Khu vực đang chọn"}
              </span>
              {regionStatus?.intensity_index && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold uppercase">
                  {regionStatus.intensity_index}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-4xl font-extrabold tracking-tight">
                {regionStatus ? regionStatus.regional_intensity : loading ? "…" : "—"}
              </span>
              <span className="text-sm text-emerald-100">gCO₂/kWh</span>
            </div>

            <p className="mt-3 text-xs text-emerald-100">
              {currentRank ? `Xếp hạng sạch #${currentRank} / ${rankings.length} vùng DNO` : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Bình Quân Toàn Quốc</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-extrabold text-slate-900">
                  {nationalIntensity ?? "—"}
                </span>
                <span className="text-xs text-slate-500">gCO₂/kWh</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">So Với Toàn Quốc</span>
                {isHigher ? (
                  <ArrowUpRight size={17} className="text-red-600" />
                ) : (
                  <ArrowDownRight size={17} className="text-emerald-600" />
                )}
              </div>
              <div className="mt-2">
                <span
                  className={`text-2xl font-extrabold ${
                    isHigher ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {regionStatus
                    ? `${regionStatus.diff_percent > 0 ? "+" : ""}${regionStatus.diff_percent.toFixed(
                        1
                      )}%`
                    : "—"}
                </span>
                {regionStatus && (
                  <p className="text-xs text-slate-500 mt-1">
                    ({regionStatus.diff_value > 0 ? `+${regionStatus.diff_value}` : regionStatus.diff_value}{" "}
                    gCO₂/kWh)
                  </p>
                )}
              </div>
            </div>
          </div>

          {regionStatus?.status_message && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Info size={16} className="text-emerald-700" />
                <span>Nhận Định Trạng Thái Khu Vực</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {regionStatus.status_message}
              </p>
            </div>
          )}
        </div>

        {/* Cột Phải (7/12): Biểu đồ cột ngang & Bảng xếp hạng 14 vùng DNO */}
        <div className="xl:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col gap-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Bảng Xếp Hạng Cường Độ Carbon 14 Vùng Phân Phối (DNO)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhấp vào một cột hoặc dòng bất kỳ để đối chiếu chi tiết • Đường nét đứt màu cam là bình
              quân toàn quốc ({nationalIntensity ?? "—"} gCO₂/kWh)
            </p>
          </div>

          {rankings.length > 0 ? (
            <>
              <div className="w-full h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rankings}
                    layout="vertical"
                    margin={{ top: 5, right: 24, left: 16, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} unit=" g" />
                    <YAxis
                      type="category"
                      dataKey="short_name"
                      width={125}
                      tick={{ fontSize: 11, fill: "#1e293b", fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} gCO₂/kWh`, "Cường độ khu vực"]}
                    />
                    {nationalIntensity && (
                      <ReferenceLine
                        x={nationalIntensity}
                        stroke="#ea580c"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Bar
                      dataKey="intensity"
                      radius={[0, 5, 5, 0]}
                      onClick={(entry) => entry?.region_id && setSelectedRegionId(entry.region_id)}
                      style={{ cursor: "pointer" }}
                    >
                      {rankings.map((item) => (
                        <Cell
                          key={item.region_id}
                          fill={
                            item.region_id === selectedRegionId
                              ? "#ea580c"
                              : item.intensity <= (nationalIntensity || 164)
                              ? "#16a34a"
                              : "#64748b"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto max-h-[280px] border-t border-slate-100 pt-2">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Hạng</th>
                      <th className="py-2.5 px-3 font-bold">Khu vực DNO</th>
                      <th className="py-2.5 px-3 font-bold">Cường độ</th>
                      <th className="py-2.5 px-3 font-bold">Mức độ</th>
                      <th className="py-2.5 px-3 font-bold text-right">So với GB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rankings.map((item) => {
                      const isSelected = item.region_id === selectedRegionId;
                      return (
                        <tr
                          key={item.region_id}
                          onClick={() => setSelectedRegionId(item.region_id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-orange-50 font-semibold" : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-slate-500">#{item.rank}</td>
                          <td className="py-2.5 px-3 text-slate-900">{item.short_name}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.intensity} gCO₂/kWh
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase ${layStyleBadge(
                                item.intensity_index
                              )}`}
                            >
                              {item.intensity_index}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            {item.diff_from_national_perc > 0
                              ? `+${item.diff_from_national_perc.toFixed(1)}%`
                              : `${item.diff_from_national_perc.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">
              {loading ? "Đang tải bảng xếp hạng 14 vùng DNO..." : "Chưa có dữ liệu xếp hạng."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}