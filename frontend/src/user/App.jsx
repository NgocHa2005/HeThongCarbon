import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpRight, Leaf, RefreshCw, Zap } from "lucide-react";
import {
  layCarbonMoiNhat,
  layDuLieuKhuVuc,
  layLichSuCarbon,
  thongDiepLoiApi,
} from "../api/axiosClient.js";
import BieuDoPhanCumKMeans from "../thanhPhan/khaiPha/BieuDoPhanCumKMeans.jsx";
import "./user.css";

function dinhDangSo(value, digits = 0) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
  }).format(value);
}

function dinhDangThoiGian(value) {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có dữ liệu";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function UserApp() {
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [regions, setRegions] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [carbon, past, regionData] = await Promise.all([
        layCarbonMoiNhat(),
        layLichSuCarbon(),
        layDuLieuKhuVuc(),
      ]);
      setSnapshot(carbon?.data ?? null);
      setHistory(Array.isArray(past?.items) ? past.items : []);
      setRegions(Array.isArray(regionData?.items) ? regionData.items : []);
      setError("");
    } catch (requestError) {
      setError(thongDiepLoiApi(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const bars = history.slice(-12);
  const maxIntensity = Math.max(...bars.map((item) => item.cuong_do || 0), 1);
  const fuelMetrics = [
    ["Năng lượng tái tạo", snapshot?.tai_tao, "%", "green"],
    ["Gió", snapshot?.gio, "%", "green"],
    ["Mặt trời", snapshot?.mat_troi, "%", "yellow"],
    ["Khí", snapshot?.khi, "%", "blue"],
    ["Hạt nhân", snapshot?.hat_nhan, "%", "purple"],
  ];

  return (
    <main className="public-page">
      <header className="public-header">
        <a className="public-brand" href="/" aria-label="CarbonScope trang chủ">
          <span className="public-brand-mark"><Leaf size={19} /></span>
          <span>Carbon<span>Scope</span></span>
        </a>
        <div className="public-header-actions">
          <span className="live-label"><span /> DỮ LIỆU CẬP NHẬT</span>
          <button className="refresh-button" onClick={refresh} aria-label="Làm mới dữ liệu">
            <RefreshCw size={16} /> Làm mới
          </button>
          <a className="admin-link" href="/admin">Quản trị <ArrowUpRight size={15} /></a>
        </div>
      </header>

      <section className="public-hero">
        <div>
          <p className="public-eyebrow">CARBON INTENSITY · GREAT BRITAIN</p>
          <h1>Theo dõi cường độ carbon</h1>
          <p className="public-intro">Dữ liệu phát thải điện năng và cơ cấu nguồn điện mới nhất.</p>
        </div>
        <div className="updated-at"><Activity size={15} /> Cập nhật: {dinhDangThoiGian(snapshot?.thoi_gian)}</div>
      </section>

      {error && (
        <div className="public-error" role="alert">
          <strong>Không thể tải dữ liệu mới nhất.</strong> {error}
          <span>Hãy kiểm tra backend hoặc chạy thu thập dữ liệu tại trang quản trị.</span>
        </div>
      )}

      <section className="public-overview">
        <article className="intensity-card">
          <div className="metric-label"><Zap size={17} /> CƯỜNG ĐỘ CARBON</div>
          <div className="intensity-value">{isLoading ? "…" : dinhDangSo(snapshot?.cuong_do)}</div>
          <div className="intensity-unit">gCO₂/kWh</div>
          <div className="intensity-status">
            <span className="intensity-dot" />
            {snapshot?.muc_do || (snapshot ? "Chưa phân loại" : "Chưa có dữ liệu")}
          </div>
        </article>
        <div className="fuel-grid">
          {fuelMetrics.map(([label, value, unit, color]) => (
            <article className="fuel-card" key={label}>
              <span className={`fuel-dot ${color}`} />
              <span className="fuel-label">{label}</span>
              <strong>{value == null ? "—" : `${dinhDangSo(value, 1)}${unit}`}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="public-panels">
        <article className="public-panel history-panel">
          <div className="panel-heading">
            <div><span className="panel-icon"><Activity size={17} /></span><div><h2>Lịch sử cường độ</h2><p>Các khoảng thời gian gần nhất</p></div></div>
            <span className="panel-unit">gCO₂/kWh</span>
          </div>
          {bars.length ? (
            <div className="intensity-chart" aria-label="Biểu đồ lịch sử cường độ carbon">
              {bars.map((item, index) => (
                <div className="chart-column" key={`${item.thoi_gian}-${index}`} title={`${dinhDangThoiGian(item.thoi_gian)} · ${dinhDangSo(item.cuong_do)} gCO₂/kWh`}>
                  <span>{dinhDangSo(item.cuong_do)}</span>
                  <div className="chart-bar" style={{ height: `${Math.max((item.cuong_do / maxIntensity) * 100, 4)}%` }} />
                  <small>{new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.thoi_gian))}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="public-empty">{isLoading ? "Đang tải dữ liệu…" : "Chưa có lịch sử. Hãy bắt đầu thu thập tại trang quản trị."}</div>
          )}
        </article>

        <article className="public-panel region-panel">
          <div className="panel-heading">
            <div><span className="panel-icon region-icon"><Leaf size={17} /></span><div><h2>Cường độ theo vùng</h2><p>Dữ liệu vùng mới nhất</p></div></div>
            <span className="region-count">{regions.length} vùng</span>
          </div>
          <div className="region-list">
            {regions.length ? regions.map((region) => (
              <div className="region-row" key={region.ma_vung}>
                <span className="region-name"><span>{String(region.ma_vung).padStart(2, "0")}</span>{region.ten_vung}</span>
                <strong>{dinhDangSo(region.cuong_do)} <small>gCO₂/kWh</small></strong>
              </div>
            )) : <div className="public-empty">{isLoading ? "Đang tải dữ liệu…" : "Chưa có dữ liệu vùng."}</div>}
          </div>
        </article>
      </section>

      <section style={{ marginTop: 22 }}>
        <BieuDoPhanCumKMeans />
      </section>

      <footer className="public-footer">
        <span><Leaf size={14} /> Nguồn dữ liệu: Carbon Intensity API, Great Britain</span>
        <span><Zap size={14} /> <span className="footer-live-dot" /> Cập nhật tự động mỗi 30 giây</span>
      </footer>
    </main>
  );
}

export default UserApp;
