import React, { useEffect, useMemo, useState } from "react";
import { layDuBaoNgayMai, thongDiepLoiApi } from "../../api/axiosClient";

function dinhDangNgayVietNam(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== "string") return isoDateStr || "";
  const parts = isoDateStr.split("-");
  if (parts.length !== 3) return isoDateStr;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

function layKhungThapNhatHienThi(data) {
  if (!data) return "";
  const windows = Array.isArray(data.recommended_low_windows_utc)
    ? data.recommended_low_windows_utc
    : [];
  if (windows.length > 0) {
    const first = windows[0];
    if (first.from_utc && first.to_utc) {
      return `${first.from_utc}–${first.to_utc}`;
    }
  }
  if (data.lowest_slot_utc?.from_utc && data.lowest_slot_utc?.to_utc) {
    return `${data.lowest_slot_utc.from_utc}–${data.lowest_slot_utc.to_utc}`;
  }
  return "";
}

export default function BieuDoDuBaoNgayMai({ targetDate = null }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [hoveredIdx, setHoveredIdx] = useState(null);

  useEffect(() => {
    let active = true;

    async function taiDuBao() {
      setLoading(true);
      setErrorMsg("");
      try {
        const params = targetDate ? { target_date: targetDate } : {};
        const resData = await layDuBaoNgayMai(params);
        if (active) {
          setData(resData);
        }
      } catch (err) {
        if (!active) return;
        if (err?.response?.status === 404) {
          setErrorMsg(
            err.response?.data?.detail || "Chưa có dữ liệu dự báo cho ngày mai theo UTC."
          );
        } else {
          setErrorMsg("Không tải được dữ liệu dự báo cường độ carbon ngày mai.");
        }
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
  }, [targetDate]);

  const chartMeta = useMemo(() => {
    const slots = Array.isArray(data?.slots) ? data.slots : [];
    if (slots.length === 0) return null;

    const width = 760;
    const height = 230;
    const padLeft = 44;
    const padRight = 24;
    const padTop = 26;
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
      const fromUtc = s.TargetFromTime
        ? new Date(s.TargetFromTime).toISOString().slice(11, 16)
        : (s.TimeSlotUTC || "").slice(0, 5);
      const toUtc = s.TargetToTime
        ? new Date(s.TargetToTime).toISOString().slice(11, 16)
        : (s.TimeSlotUTC || "").slice(6, 11);

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
      yMin,
      yMax,
      yTicks,
      toY,
      points,
      linePath,
      areaPath,
      minPt,
      maxPt,
      xLabels,
    };
  }, [data]);

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "20px 22px",
    marginTop: "20px",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
  };

  if (loading) {
    return (
      <section style={cardStyle} aria-label="Dự báo carbon ngày mai">
        <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
          Dự báo carbon ngày mai
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Đang tải dữ liệu dự báo 48 mốc 30 phút (UTC)...
        </p>
      </section>
    );
  }

  if (errorMsg) {
    return (
      <section style={cardStyle} aria-label="Dự báo carbon ngày mai">
        <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
          Dự báo carbon ngày mai
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#b45309" }}>{errorMsg}</p>
      </section>
    );
  }

  if (!data || !chartMeta) {
    return null;
  }

  const dateFormatted = dinhDangNgayVietNam(data.target_date_utc);
  const regionShort = (data.region || "Great Britain").split(" (")[0];
  const lowText =
    data.lowest_slot_utc?.predicted_intensity ?? chartMeta.minPt.val;
  const lowRange = data.lowest_slot_utc
    ? `${data.lowest_slot_utc.from_utc}–${data.lowest_slot_utc.to_utc}`
    : chartMeta.minPt.labelRange;

  const highText =
    data.highest_slot_utc?.predicted_intensity ?? chartMeta.maxPt.val;
  const highRange = data.highest_slot_utc
    ? `${data.highest_slot_utc.from_utc}–${data.highest_slot_utc.to_utc}`
    : chartMeta.maxPt.labelRange;

  const recommendedLowRange = layKhungThapNhatHienThi(data) || lowRange;
  const activePoint =
    hoveredIdx !== null && chartMeta.points[hoveredIdx]
      ? chartMeta.points[hoveredIdx]
      : null;

  return (
    <section style={cardStyle} aria-label="Dự báo carbon ngày mai">
      {/* Tiêu đề & dòng phụ */}
      <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
        Dự báo carbon ngày mai
      </h2>
      <div
        style={{
          marginTop: "6px",
          marginBottom: "16px",
          fontSize: "13px",
          color: "#64748b",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
        }}
      >
        <span>📅</span>
        <span>
          {dateFormatted} · {regionShort} · {data.timezone || "UTC"}
        </span>
      </div>

      {/* 3 thẻ tóm tắt */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {/* Thẻ Thấp nhất */}
        <div
          style={{
            background: "#ecfdf5",
            borderRadius: "12px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#059669",
              marginBottom: "6px",
            }}
          >
             Thấp nhất
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#047857", lineHeight: 1.2 }}>
            {lowText} <span style={{ fontSize: "13px", fontWeight: 500 }}>gCO₂/kWh</span>
          </div>
          <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
            {lowRange}
          </div>
        </div>

        {/* Thẻ Cao nhất */}
        <div
          style={{
            background: "#f5f3ff",
            borderRadius: "12px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#6d28d9",
              marginBottom: "6px",
            }}
          >
             Cao nhất
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#5b21b6", lineHeight: 1.2 }}>
            {highText} <span style={{ fontSize: "13px", fontWeight: 500 }}>gCO₂/kWh</span>
          </div>
          <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
            {highRange}
          </div>
        </div>

        {/* Thẻ Khoảng dự báo */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: "12px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "6px",
            }}
          >
             Khoảng dự báo
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
            {data.total_slots ?? 48}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            Mỗi khoảng {data.interval_minutes ?? 30} phút
          </div>
        </div>
      </div>

      {/* Tiêu đề biểu đồ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "4px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
          Diễn biến dự báo
        </h3>
        {activePoint && (
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1d4ed8" }}>
            {activePoint.labelRange} UTC · {activePoint.val} gCO₂/kWh
          </span>
        )}
      </div>
      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
        gCO₂/kWh
      </div>

      {/* Biểu đồ đường + vùng tô bóng + mốc thấp/cao */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${chartMeta.width} ${chartMeta.height}`}
          style={{ width: "100%", minWidth: "560px", height: "auto", display: "block" }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="forecastAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Đường lưới ngang & nhãn trục Y */}
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

          {/* Vùng tô bóng dưới đường dự báo */}
          <path d={chartMeta.areaPath} fill="url(#forecastAreaGrad)" />

          {/* Đường dự báo */}
          <path
            d={chartMeta.linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Điểm hover tương tác */}
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

          {/* Nhãn & chấm mốc thấp nhất (xanh) */}
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
                Math.max(chartMeta.padLeft, chartMeta.minPt.x - 66),
                chartMeta.width - chartMeta.padRight - 132
              )}
              y={Math.max(4, chartMeta.minPt.y - 36)}
              width="132"
              height="20"
              rx="6"
              fill="#ecfdf5"
              stroke="#10b981"
              strokeWidth="1"
            />
            <text
              x={
                Math.min(
                  Math.max(chartMeta.padLeft, chartMeta.minPt.x - 66),
                  chartMeta.width - chartMeta.padRight - 132
                ) + 66
              }
              y={Math.max(4, chartMeta.minPt.y - 36) + 13.5}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="#047857"
            >
              {chartMeta.minPt.labelRange} · {chartMeta.minPt.val} gCO₂/kWh
            </text>
          </g>

          {/* Nhãn & chấm mốc cao nhất (tím) */}
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
              {chartMeta.maxPt.labelRange} · {chartMeta.maxPt.val} gCO₂/kWh
            </text>
          </g>
        </svg>
      </div>

      {/* Thanh gợi ý khoảng carbon thấp nhất dưới cùng */}
      <div
        style={{
          marginTop: "14px",
          background: "#e6f4f1",
          borderRadius: "10px",
          padding: "11px 16px",
          fontSize: "13px",
          color: "#0f5132",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span>🌿</span>
        <span style={{ color: "#64748b" }}>|</span>
        <span>
          Khoảng carbon dự báo thấp nhất:{" "}
          <strong style={{ color: "#065f46" }}>{recommendedLowRange}</strong>
        </span>
      </div>
    </section>
  );
}