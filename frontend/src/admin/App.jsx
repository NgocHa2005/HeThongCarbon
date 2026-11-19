import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cloud,
  Database,
  Download,
  ExternalLink,
  FileClock,
  Gauge,
  Leaf,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { taiTepExcel } from "../api/taiTepExcel.js";
import {
  layChatLuongDuLieu,
  layLichSuThuThap,
  layTrangThaiThuThap,
  thongDiepLoiApi,
} from "../api/axiosClient.js";

const INTERVAL_POLLING = 15000;
const GITHUB_ACTIONS_URL =
  import.meta.env.VITE_GITHUB_ACTIONS_URL ||
  "https://github.com/NgocHa2005/HeThongCarbon/actions/workflows/carbon-data-collection.yml";

function docTrangThai(payload) {
  const job = payload?.data ?? payload?.job ?? payload ?? {};
  const rawStatus =
    job.status ?? job.state ?? job.trangThai ?? job.job_status ?? "";
  const normalized = String(rawStatus).toLowerCase();

  if (["completed", "complete", "success", "succeeded", "done", "hoàn thành"].includes(normalized)) {
    return { job, status: "succeeded" };
  }
  if (["running", "processing", "in_progress", "in progress", "đang chạy", "đang xử lý"].includes(normalized)) {
    return { job, status: "running" };
  }
  if (["queued", "pending", "waiting", "đang chờ"].includes(normalized)) {
    return { job, status: "queued" };
  }
  if (["failed", "error", "failure", "thất bại", "lỗi"].includes(normalized)) {
    return { job, status: "failed" };
  }
  return { job, status: "unknown" };
}

function dinhDangThoiGian(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function hienThiGiaTri(value) {
  if (value === undefined || value === null || value === "") return "—";
  return typeof value === "number" ? new Intl.NumberFormat("vi-VN").format(value) : String(value);
}

function moTaCanhBao(notice) {
  const message = notice.message ?? notice.Message ?? notice.AlertMessage ?? notice.description;
  if (message) return message;
  const exceeded = notice.ExceededValue ?? notice.exceeded_value;
  const threshold = notice.ThresholdLimit ?? notice.threshold_limit;
  if (exceeded !== undefined && threshold !== undefined) {
    const dismissal = notice.IsDismissed ?? notice.is_dismissed;
    const state = dismissal === undefined ? "" : dismissal ? " · Đã xử lý" : " · Chưa xử lý";
    return `Cường độ ${exceeded} gCO₂/kWh vượt ngưỡng ${threshold} gCO₂/kWh (${notice.Severity ?? notice.severity ?? "cảnh báo"})${state}.`;
  }
  return JSON.stringify(notice);
}

function layTrangHienTai() {
  const route = window.location.hash.slice(1);
  return ["overview", "history", "configuration"].includes(route)
    ? route
    : "overview";
}

function docDanhSachLichSu(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.items ?? payload?.history ?? payload?.jobs ?? payload?.data ?? [];
  return Array.isArray(rows) ? rows : [];
}

function ThanhBen({ page }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="Admin tổng quan">
        <span className="brand-mark"><Leaf size={19} strokeWidth={2.2} /></span>
        <span className="brand-copy">
          <strong>Admin</strong>
        </span>
      </a>

      <div className="nav-label">QUẢN LÝ HỆ THỐNG</div>
      <nav className="side-nav" aria-label="Điều hướng quản trị">
        <a className={`nav-item ${page === "overview" ? "active" : ""}`} href="#overview" aria-current={page === "overview" ? "page" : undefined}><Gauge size={17} /><span>Tổng quan</span>{page === "overview" && <span className="active-dot" />}</a>
        <a className={`nav-item ${page === "history" ? "active" : ""}`} href="#history" aria-current={page === "history" ? "page" : undefined}><FileClock size={17} /><span>Lịch sử thu thập dữ liệu</span>{page === "history" && <span className="active-dot" />}</a>
        <a className={`nav-item ${page === "configuration" ? "active" : ""}`} href="#configuration" aria-current={page === "configuration" ? "page" : undefined}><SlidersHorizontal size={17} /><span>Cài đặt</span>{page === "configuration" && <span className="active-dot" />}</a>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-help"><CircleHelp size={17} /><span>Trung tâm trợ giúp</span><ArrowRight size={14} /></div>
        <div className="profile">
          <div className="avatar">AD</div>
          <div className="profile-copy"><strong>Quản trị viên</strong><small>Administrator</small></div>
          <ChevronDown size={15} />
        </div>
      </div>
    </aside>
  );
}

function StatusBadge({ status }) {
  const labels = {
    loading: "Đang kiểm tra",
    unknown: "Chưa có dữ liệu",
    idle: "Sẵn sàng",
    queued: "Đang chờ",
    running: "Đang xử lý",
    succeeded: "Hoàn thành",
    failed: "Thất bại",
  };
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {labels[status] || labels.unknown}
    </span>
  );
}

function BuocTienTrinh({ icon: Icon, title, description, state, detail }) {
  const iconState = state === "done" ? <Check size={15} /> :
    state === "active" ? <LoaderCircle size={15} className="spin" /> :
      state === "failed" ? <XCircle size={15} /> : <Icon size={16} />;
  return (
    <div className={`pipeline-step step-${state}`}>
      <div className="step-icon">{iconState}</div>
      <div className="step-copy">
        <div className="step-heading"><strong>{title}</strong>{detail && <span>{detail}</span>}</div>
        <small>{description}</small>
      </div>
    </div>
  );
}

function layBuoc(payload, status) {
  const stage = String(payload?.stage ?? payload?.current_stage ?? payload?.step ?? "").toLowerCase();
  if (status === "succeeded") return ["done", "done", "done"];
  if (status === "failed") {
    if (stage.includes("db") || stage.includes("database") || stage.includes("lưu")) return ["done", "done", "failed"];
    if (stage.includes("clean") || stage.includes("process") || stage.includes("làm sạch")) return ["done", "failed", "waiting"];
    return ["failed", "waiting", "waiting"];
  }
  if (status === "running" || status === "queued") {
    if (stage.includes("clean") || stage.includes("process") || stage.includes("làm sạch")) return ["done", "active", "waiting"];
    if (stage.includes("db") || stage.includes("database") || stage.includes("lưu")) return ["done", "done", "active"];
    return ["active", "waiting", "waiting"];
  }
  return ["waiting", "waiting", "waiting"];
}

function App() {
  const [page, setPage] = useState(layTrangHienTai);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [jobStatus, setJobStatus] = useState("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiErrorKind, setApiErrorKind] = useState("");
  const [lastChecked, setLastChecked] = useState(null);
  const [quality, setQuality] = useState(null);
  const [qualityError, setQualityError] = useState("");

  useEffect(() => {
    const syncPage = () => setPage(layTrangHienTai());
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  const refreshStatus = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const payload = await layTrangThaiThuThap();
      const result = docTrangThai(payload);
      setJob(result.job);
      setJobStatus(result.status);
      setApiError("");
      setApiErrorKind("");
      setLastChecked(new Date());
    } catch (error) {
      setApiError(thongDiepLoiApi(error));
      setApiErrorKind("status");
      setJobStatus((current) =>
        ["loading", "running", "queued"].includes(current) ? "unknown" : current,
      );
      setLastChecked(new Date());
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, []);

  const refreshQuality = useCallback(async () => {
    try {
      setQuality(await layChatLuongDuLieu());
      setQualityError("");
    } catch (error) {
      setQualityError(thongDiepLoiApi(error));
    }
  }, []);

  useEffect(() => {
    if (page === "history" || page === "configuration") return undefined;
    refreshStatus(true);
    refreshQuality();
    const timer = window.setInterval(() => {
      refreshStatus(true);
      refreshQuality();
    }, INTERVAL_POLLING);
    return () => window.clearInterval(timer);
  }, [page, refreshQuality, refreshStatus]);

  const refreshHistory = useCallback(async (quiet = false) => {
    if (!quiet) setIsHistoryLoading(true);
    try {
      const payload = await layLichSuThuThap();
      setHistory(docDanhSachLichSu(payload));
      setHistoryError("");
    } catch (error) {
      setHistoryError(thongDiepLoiApi(error));
    } finally {
      if (!quiet) setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (page !== "history") return undefined;
    refreshHistory(true);
    const timer = window.setInterval(() => refreshHistory(true), INTERVAL_POLLING);
    return () => window.clearInterval(timer);
  }, [page, refreshHistory]);

  const stages = useMemo(() => layBuoc(job, jobStatus), [job, jobStatus]);
  const timestamp = job?.started_at ?? job?.startedAt ?? job?.created_at ?? job?.createdAt ?? job?.updated_at;
  const records = job?.records_processed ?? job?.recordsProcessed ?? job?.records_count ?? job?.recordsCount ?? job?.record_count;
  const duration = job?.duration_seconds ?? job?.durationSeconds ?? job?.duration;
  const errorMessage = job?.error ?? job?.message ?? job?.detail;
  const displayedError = jobStatus === "failed" && errorMessage ? errorMessage : apiError;
  const monitoring = job?.monitoring;
  const qualityNotices = [
    ...(quality?.warnings || []),
    ...(quality?.alerts || []),
  ];

  const exportHistory = async () => {
    setIsExporting(true);
    setExportError("");
    try {
      const headers = ["Mã tiến trình", "Thời gian bắt đầu", "Nguồn chạy", "Trạng thái", "Bản ghi thêm", "Bản ghi cập nhật", "Thời lượng (giây)", "Thông báo"];
      const rows = history.map((entry) => [
        entry?.job_id ?? entry?.jobId ?? entry?.id ?? "",
        entry?.started_at ?? entry?.startedAt ?? entry?.created_at ?? entry?.createdAt ?? "",
        entry?.triggered_by ?? "",
        entry?.status ?? entry?.state ?? entry?.trangThai ?? "",
        entry?.records_inserted ?? 0,
        entry?.records_updated ?? 0,
        entry?.duration_seconds ?? entry?.durationSeconds ?? entry?.duration ?? "",
        entry?.error ?? entry?.message ?? "",
      ]);
      taiTepExcel(headers, rows, `lich-su-thu-thap-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      setExportError(thongDiepLoiApi(error));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app-shell">
      <ThanhBen page={page} />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Quản trị hệ thống</span><span className="crumb-separator">/</span><strong>{page === "history" ? "Lịch sử thu thập dữ liệu" : page === "configuration" ? "Cài đặt" : "Tổng quan"}</strong></div>
        </header>

        <div className="page-content">
          {page === "history" ? (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow"><span className="eyebrow-line" /> ADMINISTRATION</div>
                  <h1>Lịch sử thu thập dữ liệu</h1>
                  <p>Xem lại các lần thu thập và xử lý dữ liệu đã thực hiện.</p>
                </div>
                <div className="heading-actions">
                  <button className="button button-secondary" onClick={() => refreshHistory()} disabled={isHistoryLoading}>
                    <RefreshCw size={15} className={isHistoryLoading ? "spin" : ""} /> Làm mới
                  </button>
                  <button className="button button-primary" onClick={exportHistory} disabled={history.length === 0 || isExporting}>
                    {isExporting ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />} {isExporting ? "Đang xuất..." : "Xuất Excel"}
                  </button>
                </div>
              </section>

              {exportError && <div className="error-banner" role="alert"><AlertCircle size={18} /><div><strong>Không thể xuất file Excel</strong><span>{exportError}</span></div></div>}
              {historyError && (
                <div className="error-banner" role="alert">
                  <AlertCircle size={18} />
                  <div><strong>Không thể tải lịch sử tiến trình</strong><span>{historyError}</span><small>Kiểm tra backend đã triển khai <code>GET /api/v1/admin/history</code>.</small></div>
                </div>
              )}

              <section className="card history-card history-page-card">
                <div className="history-heading">
                  <div className="history-title">
                    <div className="icon-tile soft"><FileClock size={18} /></div>
                    <div><h2>Các lần thu thập</h2><p>{history.length ? `${history.length} tiến trình` : "Chưa có dữ liệu lịch sử"}</p></div>
                  </div>
                  <span className="history-auto-refresh"><RefreshCw size={12} /> Tự cập nhật mỗi 15 giây</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>TIẾN TRÌNH</th><th>THỜI GIAN</th><th>NGUỒN CHẠY</th><th>THÊM MỚI</th><th>CẬP NHẬT</th><th>THỜI LƯỢNG</th><th>TRẠNG THÁI</th></tr></thead>
                    <tbody>
                      {history.length ? history.map((entry, index) => {
                        const status = docTrangThai(entry).status;
                        const startedAt = entry?.started_at ?? entry?.startedAt ?? entry?.created_at ?? entry?.createdAt;
                        const recordsInserted = entry?.records_inserted ?? 0;
                        const recordsUpdated = entry?.records_updated ?? 0;
                        const elapsed = entry?.duration_seconds ?? entry?.durationSeconds ?? entry?.duration;
                        return (
                          <tr key={entry?.job_id ?? entry?.jobId ?? entry?.id ?? `${startedAt}-${index}`}>
                            <td><span className="table-job-id">{entry?.job_id ?? entry?.jobId ?? entry?.id ?? "—"}</span></td>
                            <td>{dinhDangThoiGian(startedAt)}</td>
                            <td>{entry?.triggered_by ?? "—"}</td>
                            <td>{hienThiGiaTri(recordsInserted)}</td>
                            <td>{hienThiGiaTri(recordsUpdated)}</td>
                            <td>{elapsed === undefined ? "—" : `${hienThiGiaTri(elapsed)} giây`}</td>
                            <td><StatusBadge status={status} /></td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan="7"><div className="empty-state"><span className="empty-icon"><FileClock size={18} /></span><strong>{isHistoryLoading ? "Đang tải lịch sử..." : historyError ? "Chưa thể hiển thị lịch sử" : "Chưa có lịch sử thu thập"}</strong><small>{historyError ? "Hãy kiểm tra kết nối và endpoint lịch sử của backend." : "Lịch sử sẽ xuất hiện tại đây sau khi backend trả về các tiến trình."}</small></div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="history-footer"><span><Database size={13} /> Lịch sử được tải từ backend</span><span>{history.length} bản ghi</span></div>
              </section>
              <footer className="page-footer"><span>Admin <span className="footer-dot">·</span> Lịch sử thu thập dữ liệu</span><span><ArrowDownToLine size={13} /> Excel .xlsx</span></footer>
            </>
          ) : page === "configuration" ? (
            <>
              <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> ADMINISTRATION</div><h1>Cài đặt</h1><p>Thiết lập hệ thống quản trị dữ liệu.</p></div></section>
              <section className="card configuration-placeholder"><SlidersHorizontal size={22} /><strong>Chức năng cấu hình sẽ sớm được bổ sung.</strong></section>
            </>
          ) : (
          <>
          <section className="page-heading" id="overview">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> ADMINISTRATION</div>
              <h1>{page === "overview" ? "Tổng quan quản trị" : "Thu thập dữ liệu"}</h1>
              <p>Kích hoạt đồng bộ Carbon Intensity API và theo dõi các bước xử lý dữ liệu.</p>
            </div>
            <div className="heading-actions">
              <div className="api-indicator">
                <span className={`api-pulse ${apiError ? "offline" : ""}`} />
                <span><strong>{apiError ? "API chưa phản hồi" : jobStatus === "loading" ? "Đang kết nối API" : "Theo dõi API"}</strong><small>Carbon Intensity · Great Britain</small></span>
              </div>
              <button className="button button-secondary" onClick={() => refreshStatus()} disabled={isRefreshing}>
                <RefreshCw size={15} className={isRefreshing ? "spin" : ""} /> Làm mới
              </button>
            </div>
          </section>

          <section className="notice-banner">
            <span className="notice-icon"><ShieldCheck size={18} /></span>
            <span>
              <strong>
                {monitoring?.state === "healthy"
                  ? "Lịch thu thập đang hoạt động"
                  : monitoring?.state === "running"
                    ? "GitHub Actions đang thu thập dữ liệu"
                    : "Cần kiểm tra lịch thu thập"}
              </strong>
              <small>{monitoring?.message || `GitHub Actions tự chạy mỗi 30 phút. Lần thành công gần nhất: ${dinhDangThoiGian(monitoring?.last_success_at)}.`}</small>
            </span>
            <a className="notice-endpoint" href={GITHUB_ACTIONS_URL} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> GitHub Actions
            </a>
          </section>

          {displayedError && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <div><strong>{jobStatus === "failed" && !apiError ? "Tiến trình không thành công" : apiErrorKind === "trigger" ? "Không thể kích hoạt thu thập" : "Không thể đọc trạng thái API"}</strong><span>{displayedError}</span>
                {apiErrorKind === "status" && <small>Trạng thái được kiểm tra tại <code>GET /api/v1/admin/status</code>. Hãy xác nhận backend đã cung cấp endpoint này.</small>}
              </div>
              <button className="icon-button error-close" aria-label="Đóng thông báo" onClick={() => { setApiError(""); setApiErrorKind(""); }}><XCircle size={16} /></button>
            </div>
          )}

          <section className="primary-grid" id="ingestion">
            <article className="card trigger-card">
              <div className="card-topline">
                <div className="icon-tile green"><Cloud size={19} /></div>
                <span className="card-kicker">GITHUB ACTIONS</span>
                <span className="secure-label"><ShieldCheck size={13} /> ADMIN</span>
              </div>
              <h2>Chạy thủ công hoặc bù dữ liệu</h2>
              <p className="card-description">Mở workflow để chạy ngay hoặc chọn khoảng ngày cần bù. Lịch tự động được GitHub Actions quản lý.</p>
              <div className="source-row">
                <div className="source-logo"><Activity size={16} /></div>
                <div><strong>Carbon Intensity API</strong><small>api.carbonintensity.org.uk</small></div>
                <span className="source-live"><span /> NGUỒN HOẠT ĐỘNG</span>
              </div>
              <a className="button button-primary trigger-button" href={GITHUB_ACTIONS_URL} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Mở workflow thu thập <ArrowRight size={16} className="button-arrow" />
              </a>
              <div className="trigger-footnote"><Clock3 size={13} /> Lịch cron tự chạy; chạy thủ công/backfill trong tab Actions.</div>
            </article>

            <article className="card status-card">
              <div className="card-heading">
                <div><div className="card-kicker">TRẠNG THÁI TIẾN TRÌNH</div><h2>Tiến trình gần nhất</h2></div>
                <StatusBadge status={jobStatus} />
              </div>
              <div className="job-meta">
                <div className="meta-item"><span>Thời điểm bắt đầu</span><strong>{dinhDangThoiGian(timestamp)}</strong></div>
                <div className="meta-item"><span>Mã tiến trình</span><strong className="job-id">{job?.job_id ?? job?.jobId ?? job?.id ?? "—"}</strong></div>
              </div>
              <div className="pipeline">
                <BuocTienTrinh icon={Cloud} title="Thu thập dữ liệu" description="Kết nối và lấy dữ liệu nguồn" state={stages[0]} />
                <div className={`pipeline-connector ${stages[0] === "done" ? "connector-done" : ""}`} />
                <BuocTienTrinh icon={Activity} title="Làm sạch & xử lý" description="Kiểm tra và chuẩn hóa bản ghi" state={stages[1]} />
                <div className={`pipeline-connector ${stages[1] === "done" ? "connector-done" : ""}`} />
                <BuocTienTrinh icon={Database} title="Nạp cơ sở dữ liệu" description="Lưu dữ liệu đã xử lý" state={stages[2]} />
              </div>
              <div className="status-footer">
                <span><RefreshCw size={12} /> Kiểm tra mỗi 15 giây</span>
                <span>Lần kiểm tra: {lastChecked ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(lastChecked) : "—"}</span>
              </div>
            </article>
          </section>

          <section className="metrics-grid" aria-label="Kết quả tiến trình">
            <article className="metric-card">
              <div className="metric-icon blue"><Database size={17} /></div>
              <div className="metric-copy"><span>BẢN GHI ĐÃ XỬ LÝ</span><strong>{hienThiGiaTri(records)}</strong><small>{records === undefined ? "Chưa có dữ liệu từ API" : "Trong tiến trình gần nhất"}</small></div>
            </article>
            <article className="metric-card">
              <div className="metric-icon violet"><Clock3 size={17} /></div>
              <div className="metric-copy"><span>THỜI GIAN XỬ LÝ</span><strong>{duration === undefined ? "—" : `${hienThiGiaTri(duration)} giây`}</strong><small>{duration === undefined ? "Chưa có dữ liệu từ API" : "Thời lượng tiến trình gần nhất"}</small></div>
            </article>
            <article className="metric-card">
              <div className={`metric-icon ${jobStatus === "failed" ? "red" : "green"}`}>{jobStatus === "failed" ? <XCircle size={17} /> : <CheckCircle2 size={17} />}</div>
              <div className="metric-copy"><span>KẾT QUẢ GẦN NHẤT</span><strong className={`result-text result-${jobStatus}`}>{jobStatus === "loading" ? "Đang kiểm tra" : jobStatus === "unknown" ? "Chưa xác định" : jobStatus === "succeeded" ? "Thành công" : jobStatus === "failed" ? "Thất bại" : "Đang chạy"}</strong><small>{timestamp ? dinhDangThoiGian(timestamp) : "Đang chờ dữ liệu từ API"}</small></div>
            </article>
          </section>

          <section className="card quality-card" aria-label="Giám sát chất lượng dữ liệu">
            <div className="card-heading">
              <div><div className="card-kicker">INGESTION MONITORING</div><h2>Chất lượng dữ liệu & cảnh báo</h2></div>
              <StatusBadge status={qualityError ? "failed" : quality?.quality_state === "healthy" ? "succeeded" : quality ? "failed" : "loading"} />
            </div>
            {qualityError ? (
              <p role="alert">{qualityError}</p>
            ) : quality ? (
              <>
                <p>
                  Vùng đã cấu hình: {quality.known_region_count}/18 ·
                  Dữ liệu quốc gia mới nhất: {dinhDangThoiGian(quality.latest_national_reading_at)} ·
                  Cơ cấu nguồn điện: {quality.latest_generation_mix_present ? "đủ" : "thiếu"}
                </p>
                {qualityNotices.length ? (
                  <ul className="quality-notices">
                    {qualityNotices.map((notice, index) => (
                      <li key={notice.code ?? notice.AlertId ?? notice.alert_id ?? index}>
                        {moTaCanhBao(notice)}
                      </li>
                    ))}
                  </ul>
                ) : <p>Không phát hiện cảnh báo chất lượng dữ liệu.</p>}
                <small>
                  Ngưỡng cảnh báo: &gt;{quality.alert_rules?.absolute_threshold_gco2_per_kwh} gCO₂/kWh hoặc tăng &gt;{quality.alert_rules?.change_percent}% so với trung bình {quality.alert_rules?.window_hours} giờ trước.
                </small>
                <small>
                  Bảng downstream: {Object.entries(quality.downstream_tables || {})
                    .map(([name, exists]) => `${name} ${exists ? "có" : "chưa có"}`)
                    .join(" · ")}
                </small>
              </>
            ) : <p>Đang kiểm tra chất lượng dữ liệu...</p>}
          </section>

          <footer className="page-footer"><span>Admin <span className="footer-dot">·</span> Tổng quan</span><span><ArrowDownToLine size={13} /> Trạng thái cập nhật tự động</span></footer>
          </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
