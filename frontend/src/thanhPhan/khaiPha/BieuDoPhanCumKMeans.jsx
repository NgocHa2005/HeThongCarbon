import React, { useEffect, useMemo, useRef, useState } from "react";
import { layTongQuanPhanCum, thongDiepLoiApi } from "../../api/axiosClient";

const DEFAULT_VISIBLE_ROWS = 15;

function moTaGocNhin(clusterId, name = "") {
  const lower = name.toLowerCase();
  if (lower.includes("thấp") || clusterId === 2) {
    return "Mức carbon thấp & ổn định — dễ sắp xếp phụ tải";
  }
  if (lower.includes("cao") || clusterId === 0) {
    return "Mức carbon cao — hạn chế dồn tải lớn nếu có thể";
  }
  return "Biến động cao trong ngày — cần theo dõi khung giờ";
}

function pastelCardStyle(clusterId, color = "#07866c", isSelected = false) {
  let bg = "#f8fafc";
  let accent = color || "#07866c";

  if (clusterId === 0) {
    bg = "#fff1f2";
    accent = color || "#e11d48";
  } else if (clusterId === 1) {
    bg = "#fffbeb";
    accent = color || "#d97706";
  } else if (clusterId === 2) {
    bg = "#ecfdf5";
    accent = color || "#059669";
  }

  return {
    accent,
    style: {
      textAlign: "left",
      padding: "14px 16px",
      borderRadius: "12px",
      background: bg,
      border: isSelected ? `2px solid ${accent}` : "1px solid transparent",
      boxShadow: isSelected ? "0 2px 8px rgba(15, 23, 42, 0.06)" : "none",
      display: "flex",
      flexDirection: "column",
      gap: 5,
      cursor: "pointer",
      transition: "all 0.15s ease",
    },
  };
}

export default function BieuDoPhanCumKMeans() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all" | "0" | "1" | "2"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hoveredDay, setHoveredDay] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);

  const tableAreaRef = useRef(null);

  async function taiDuLieu(filters = {}) {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;

      const res = await layTongQuanPhanCum(params);
      setData(res);
      setShowAllRows(false);
    } catch (err) {
      setError(thongDiepLoiApi(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    taiDuLieu();
  }, []);

  function handleLocNgay(e) {
    e.preventDefault();
    taiDuLieu({ startDate, endDate });
  }

  function handleDatLai() {
    setActiveTab("all");
    setStartDate("");
    setEndDate("");
    setHoveredDay(null);
    setShowAllRows(false);
    taiDuLieu({});
  }

  function handleChonCum(targetTab, cuonXuongTab = false) {
    setActiveTab(String(targetTab));
    setShowAllRows(false);
    if (cuonXuongTab && tableAreaRef.current) {
      tableAreaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const clusters = data?.clusters || [];
  const allDailyClusters = data?.daily_clusters || [];

  const clusterMap = useMemo(() => {
    const map = new Map();
    for (const c of clusters) {
      map.set(Number(c.ClusterId), c);
    }
    return map;
  }, [clusters]);

  const filteredDailyClusters = useMemo(() => {
    if (activeTab === "all") return allDailyClusters;
    return allDailyClusters.filter(
      (row) => String(row.ClusterId) === String(activeTab)
    );
  }, [allDailyClusters, activeTab]);

  const visibleDailyClusters = useMemo(() => {
    if (showAllRows) return filteredDailyClusters;
    return filteredDailyClusters.slice(0, DEFAULT_VISIBLE_ROWS);
  }, [filteredDailyClusters, showAllRows]);

  const chartBounds = useMemo(() => {
    const stdValues = [
      ...allDailyClusters.map((d) => Number(d.StdIntensity)),
      ...clusters.map((c) => Number(c.CentroidStdIntensity)),
    ].filter((v) => !Number.isNaN(v));

    const meanValues = [
      ...allDailyClusters.map((d) => Number(d.MeanIntensity)),
      ...clusters.map((c) => Number(c.CentroidMeanIntensity)),
    ].filter((v) => !Number.isNaN(v));

    if (!stdValues.length || !meanValues.length) {
      return { minX: 0, maxX: 80, minY: 0, maxY: 300 };
    }

    const rawMinX = Math.min(...stdValues);
    const rawMaxX = Math.max(...stdValues);
    const rawMinY = Math.min(...meanValues);
    const rawMaxY = Math.max(...meanValues);

    const padX = Math.max((rawMaxX - rawMinX) * 0.1, 4);
    const padY = Math.max((rawMaxY - rawMinY) * 0.1, 15);

    return {
      minX: Math.max(0, Math.floor(rawMinX - padX)),
      maxX: Math.ceil(rawMaxX + padX),
      minY: Math.max(0, Math.floor(rawMinY - padY)),
      maxY: Math.ceil(rawMaxY + padY),
    };
  }, [allDailyClusters, clusters]);

  if (loading) {
    return (
      <div
        className="card"
        style={{ padding: 24, fontSize: 14, color: "#52615a" }}
      >
        Đang tải dữ liệu phân cụm...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-banner" style={{ fontSize: 13, padding: 16 }}>
        <div>
          <strong style={{ fontSize: 14 }}>Không tải được dữ liệu phân cụm</strong>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const svgWidth = 780;
  const svgHeight = 350;
  const pad = { top: 22, right: 24, bottom: 46, left: 58 };
  const plotW = svgWidth - pad.left - pad.right;
  const plotH = svgHeight - pad.top - pad.bottom;

  const toX = (std) => {
    const span = Math.max(chartBounds.maxX - chartBounds.minX, 1);
    return pad.left + ((Number(std) - chartBounds.minX) / span) * plotW;
  };

  const toY = (mean) => {
    const span = Math.max(chartBounds.maxY - chartBounds.minY, 1);
    return (
      pad.top +
      plotH -
      ((Number(mean) - chartBounds.minY) / span) * plotH
    );
  };

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(
    (t) => chartBounds.minX + t * (chartBounds.maxX - chartBounds.minX)
  );
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(
    (t) => chartBounds.minY + t * (chartBounds.maxY - chartBounds.minY)
  );

  const tabs = [
    { id: "all", label: `Tất cả (${allDailyClusters.length})`, color: "#07866c" },
    ...clusters.map((c) => ({
      id: String(c.ClusterId),
      label: `Cụm ${c.ClusterId}`,
      sub: c.ClusterName,
      color: c.ColorHex || "#07866c",
    })),
  ];

  return (
    <div style={{ display: "grid", gap: 20, fontSize: 14 }}>
      {/* Khối 1: Tiêu đề + lọc ngày + sơ đồ phân tán Scatter Plot */}
      <div className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "#07866c",
                marginBottom: 6,
              }}
            >
              PHÂN CỤM CƯỜNG ĐỘ CARBON THEO NGÀY · GB (REGION 0)
            </div>
            <h2 style={{ margin: 0, fontSize: 22, color: "#17241f" }}>
              Sơ đồ phân bố các ngày theo mức carbon và độ dao động
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 14,
                color: "#5b6862",
                lineHeight: 1.5,
              }}
            >
              Mỗi chấm là một ngày (48 mốc 30 phút). Bấm vào cụm hoặc chấm để
              lọc danh sách bên dưới.
            </p>
          </div>

          {data?.run && (
            <span
              className="status-badge status-succeeded"
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              <span className="status-dot" />
              Run #{data.run.ClusteringRunId} · k = {data.run.NumberOfClusters}
            </span>
          )}
        </div>

        {/* Bộ lọc khoảng ngày */}
        <form
          onSubmit={handleLocNgay}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <label style={{ fontSize: 13, color: "#4e5c56" }}>
            Từ ngày:{" "}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid #d9e2de",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ fontSize: 13, color: "#4e5c56" }}>
            Đến ngày:{" "}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid #d9e2de",
                fontSize: 13,
              }}
            />
          </label>

          <button
            type="submit"
            className="button button-primary"
            style={{ height: 36, padding: "0 15px", fontSize: 13 }}
          >
            Lọc ngày
          </button>

          <button
            type="button"
            className="button button-secondary"
            style={{ height: 36, padding: "0 14px", fontSize: 13 }}
            onClick={handleDatLai}
          >
            Đặt lại
          </button>
        </form>

        {/* 3 thẻ cụm màu pastel khớp đúng màu cụm */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 18,
          }}
        >
          {clusters.map((c) => {
            const cId = Number(c.ClusterId);
            const isSelected = activeTab === String(c.ClusterId);
            const { accent, style } = pastelCardStyle(cId, c.ColorHex, isSelected);

            return (
              <button
                key={c.ClusterRecordId}
                type="button"
                onClick={() => handleChonCum(c.ClusterId, true)}
                style={style}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: "#17241f",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: accent,
                      flexShrink: 0,
                    }}
                  />
                  Cụm {c.ClusterId}: {c.ClusterName}
                </span>
                <span style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.45 }}>
                  {moTaGocNhin(cId, c.ClusterName)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Thanh thông tin ngày khi rê chuột qua chấm */}
        <div
          style={{
            minHeight: 34,
            padding: "7px 12px",
            borderRadius: 8,
            background: "#f6f9f8",
            border: "1px solid #e6ece9",
            fontSize: 13,
            color: "#293731",
            marginTop: 14,
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {hoveredDay ? (
            <>
              <span>
                <strong>{hoveredDay.DateUTC}</strong> ·{" "}
                <strong>Cụm {hoveredDay.ClusterId}</strong> (
                {clusterMap.get(Number(hoveredDay.ClusterId))?.ClusterName || ""})
              </span>
              <span>
                Mean: <strong>{hoveredDay.MeanIntensity}</strong> · Std:{" "}
                <strong>{hoveredDay.StdIntensity}</strong>
              </span>
            </>
          ) : (
            <span style={{ color: "#5f6c66" }}>
              Rê chuột vào chấm để xem chi tiết ngày.
            </span>
          )}
        </div>

        {/* Scatter Plot SVG */}
        <div style={{ overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{
              width: "100%",
              maxWidth: 920,
              height: "auto",
              display: "block",
              margin: "0 auto",
            }}
            role="img"
            aria-label="Sơ đồ phân tán các ngày theo Mean và Std"
          >
            {yTicks.map((val, idx) => {
              const y = toY(val);
              return (
                <g key={`y-${idx}`}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={pad.left + plotW}
                    y2={y}
                    stroke="#edf1ef"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={pad.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#697670"
                  >
                    {Math.round(val)}
                  </text>
                </g>
              );
            })}

            {xTicks.map((val, idx) => {
              const x = toX(val);
              return (
                <g key={`x-${idx}`}>
                  <line
                    x1={x}
                    y1={pad.top}
                    x2={x}
                    y2={pad.top + plotH}
                    stroke="#edf1ef"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={x}
                    y={pad.top + plotH + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#697670"
                  >
                    {Math.round(val)}
                  </text>
                </g>
              );
            })}

            {/* Nhãn 2 trục */}
            <text
              x={pad.left + plotW / 2}
              y={svgHeight - 6}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="#293731"
            >
              Std Intensity (độ dao động)
            </text>
            <text
              x={16}
              y={pad.top + plotH / 2}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="#293731"
              transform={`rotate(-90 16 ${pad.top + plotH / 2})`}
            >
              Mean Intensity (mức carbon trung bình)
            </text>

            {/* Các chấm ngày */}
            {allDailyClusters.map((day) => {
              const cInfo = clusterMap.get(Number(day.ClusterId));
              const color = cInfo?.ColorHex || "#07866c";
              const cx = toX(day.StdIntensity);
              const cy = toY(day.MeanIntensity);
              const isDimmed =
                activeTab !== "all" && String(day.ClusterId) !== activeTab;
              const isHovered = hoveredDay?.DailyClusterId === day.DailyClusterId;

              return (
                <circle
                  key={day.DailyClusterId}
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 7 : 5}
                  fill={color}
                  fillOpacity={isDimmed ? 0.16 : 0.8}
                  stroke={isHovered ? "#17241f" : "#ffffff"}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => handleChonCum(day.ClusterId, true)}
                />
              );
            })}

            {/* Tâm cụm (dấu X) */}
            {clusters.map((c) => {
              const cx = toX(c.CentroidStdIntensity);
              const cy = toY(c.CentroidMeanIntensity);
              const color = c.ColorHex || "#07866c";
              return (
                <g
                  key={`centroid-${c.ClusterId}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleChonCum(c.ClusterId, true)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={10}
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth={2.5}
                  />
                  <line
                    x1={cx - 4}
                    y1={cy - 4}
                    x2={cx + 4}
                    y2={cy + 4}
                    stroke={color}
                    strokeWidth={2.2}
                  />
                  <line
                    x1={cx + 4}
                    y1={cy - 4}
                    x2={cx - 4}
                    y2={cy + 4}
                    stroke={color}
                    strokeWidth={2.2}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Khối 2: 4 tab (Tất cả, Cụm 0, Cụm 1, Cụm 2) + bảng gọn mặc định 15 dòng */}
      <div ref={tableAreaRef} className="card history-card">
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid #eef2f0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: "#17241f" }}>
              Danh sách ngày theo từng nhóm
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#68756f" }}>
              Hiển thị <strong>{visibleDailyClusters.length}</strong> /{" "}
              <strong>{filteredDailyClusters.length}</strong> ngày
            </p>
          </div>

          {/* 4 tab: Tất cả, Cụm 0, Cụm 1, Cụm 2 */}
          <div
            role="tablist"
            aria-label="Chọn nhóm ngày để xem bảng"
            style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleChonCum(tab.id, false)}
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 550,
                    background: isActive ? "#eaf6f2" : "#fff",
                    color: isActive ? "#076f5b" : "#4e5c56",
                    border: isActive
                      ? "1.5px solid #07866c"
                      : "1px solid #dfe6e3",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  {tab.id !== "all" && (
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: tab.color,
                      }}
                    />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ fontSize: 12 }}>NGÀY (UTC)</th>
                <th style={{ fontSize: 12 }}>CỤM</th>
                <th style={{ fontSize: 12 }}>MEAN INTENSITY</th>
                <th style={{ fontSize: 12 }}>STD INTENSITY</th>
                <th style={{ fontSize: 12 }}>MỐC HỢP LỆ</th>
              </tr>
            </thead>
            <tbody>
              {visibleDailyClusters.length ? (
                visibleDailyClusters.map((row) => {
                  const cInfo = clusterMap.get(Number(row.ClusterId));
                  return (
                    <tr key={row.DailyClusterId}>
                      <td style={{ fontSize: 13 }}>{row.DateUTC}</td>
                      <td style={{ fontSize: 13 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                            fontWeight: 600,
                            color: "#17241f",
                          }}
                        >
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: "50%",
                              background: cInfo?.ColorHex || "#07866c",
                            }}
                          />
                          Cụm {row.ClusterId}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{row.MeanIntensity}</td>
                      <td style={{ fontSize: 13 }}>{row.StdIntensity}</td>
                      <td style={{ fontSize: 13 }}>{row.ValidIntervalCount}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      fontSize: 13,
                      textAlign: "center",
                      padding: 24,
                      color: "#68756f",
                    }}
                  >
                    Không có ngày nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredDailyClusters.length > DEFAULT_VISIBLE_ROWS && (
          <div
            style={{
              padding: "12px 20px 16px",
              borderTop: "1px solid #eef2f0",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              className="button button-secondary"
              style={{ height: 36, padding: "0 16px", fontSize: 13 }}
              onClick={() => setShowAllRows((prev) => !prev)}
            >
              {showAllRows
                ? `Rút gọn`
                : `Hiển thị tất cả`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}