import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { layDashboardPhanTich, thongDiepLoiApi } from "../../api/axiosClient.js";
import "./phanTich.css";

const CHU_KY_LAM_MOI = 5 * 60 * 1000;

const MUC = [
  { khoa: "very low", ten: "Rất thấp", mau: "#0b6b57" },
  { khoa: "low", ten: "Thấp", mau: "#38b27d" },
  { khoa: "moderate", ten: "Trung bình", mau: "#e3b43f" },
  { khoa: "high", ten: "Cao", mau: "#ef8a3b" },
  { khoa: "very high", ten: "Rất cao", mau: "#d64545" },
];
const MAU_CHINH = "#07866c";
const MAU_TRUNG_TINH = "#77837e";

const chuanHoaMuc = (m) => String(m || "").toLowerCase().replace("_", " ");
const gioUtc = (iso) => (iso ? new Date(iso).toISOString().slice(11, 16) : "--");
const so = (v) => (v === null || v === undefined ? "--" : v);

export function GiaoDienTheChiSo({ hienTai, homNay, dangTai, loi }) {
  const viTri = MUC.findIndex((m) => m.khoa === chuanHoaMuc(hienTai?.muc_do));
  const muc = viTri >= 0 ? MUC[viTri] : { ten: hienTai?.muc_do || "--", mau: MAU_TRUNG_TINH };
  const laDuBao = hienTai?.nguon_du_lieu === "Dự báo";
  const chuoi = (homNay?.chuoi || []).map((d) => ({
    gio: gioUtc(d.thoi_gian),
    thuc_te: d.thuc_te,
    du_bao: d.du_bao,
    gia_tri: d.thuc_te ?? d.du_bao,
  }));
  
  const coGiaTri = chuoi.filter((d) => d.gia_tri !== null && d.gia_tri !== undefined);
  const diemThap = coGiaTri.find((d) => d.gia_tri === homNay?.thap_nhat);
  const diemCao = coGiaTri.find((d) => d.gia_tri === homNay?.cao_nhat);
  const gioHienTai = gioUtc(hienTai?.thoi_gian);
  const diemHienTai = chuoi.find((d) => d.gio === gioHienTai);

  return (
    <section className="tq-luoi">
      <article className="tq-the tq-the-chinh">
        <div className="tq-dau">
          <span className="tq-nhan">
            <Activity size={14} /> Cường độ carbon tức thời
          </span>
          {hienTai && viTri >= 0 && (
            <span className="tq-huy-hieu" style={{ background: muc.mau }}>
              {muc.ten} · Cấp {viTri + 1}/5
            </span>
          )}
          {laDuBao && <span className="the-chi-so-nhan-phu">Dự báo</span>}
        </div>

        {hienTai ? (
          <>
            <div className="tq-so" style={{ color: muc.mau }}>
              {so(hienTai.cuong_do)}
              <span> gCO₂/kWh</span>
            </div>

            <div className="tq-thang">
              {MUC.map((m) => (
                <div key={m.khoa} className="tq-thang-doan">
                  <div
                    className="tq-thang-thanh"
                    style={{ background: m.mau, opacity: m.khoa === muc.khoa ? 1 : 0.35 }}
                  />
                  {m.khoa === muc.khoa && <span className="tq-thang-dau" style={{ background: m.mau }} />}
                  <span className="tq-thang-nhan">{m.ten}</span>
                </div>
              ))}
            </div>

            <p className="tq-ghi-chu">
              Khung {gioHienTai} – {gioUtc(hienTai.den_thoi_diem)} UTC · Cập nhật{" "}
              {gioUtc(hienTai.cap_nhat_luc)} UTC
            </p>
          </>
        ) : (
          <p className="bieu-do-trang-thai">
            {dangTai ? "Đang tải dữ liệu..." : loi ? "Không thể tải dữ liệu hiện tại." : "Chưa có dữ liệu carbon."}
          </p>
        )}
        {!dangTai && loi && <p className="bieu-do-trang-thai bieu-do-trang-thai-loi">{loi}</p>}
      </article>

      <article className="tq-the">
        <div className="tq-dau">
          <span className="tq-nhan">Thống kê hôm nay (UTC)</span>
          <span className="tq-chip">{homNay?.so_ban_ghi ?? 0} bản ghi</span>
        </div>
        {chuoi.length > 0 && (
          <div className="tq-mini">
            <ResponsiveContainer width="100%" height={64}>
              <BarChart data={chuoi} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <Tooltip
                  isAnimationActive={false}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 20 }}
                  cursor={{ fill: "rgba(7,134,108,0.12)" }}
                  labelFormatter={(_, mau) => (mau?.[0]?.payload?.gio ? `${mau[0].payload.gio} UTC` : "")}
                  formatter={(gt) => [`${so(gt)} gCO₂/kWh`, "Cường độ"]}
                />
                <Bar dataKey="gia_tri" fill={MAU_CHINH} fillOpacity={0.55} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <dl className="tq-ds">
          <div>
            <dt><i style={{ background: MUC[1].mau }} /> Thấp nhất{diemThap ? ` (${diemThap.gio})` : ""}</dt>
            <dd>{so(homNay?.thap_nhat)} <small>g</small></dd>
          </div>
          <div>
            <dt><i style={{ background: MUC[4].mau }} /> Cao nhất{diemCao ? ` (${diemCao.gio})` : ""}</dt>
            <dd>{so(homNay?.cao_nhat)} <small>g</small></dd>
          </div>
          <div>
            <dt><i style={{ background: MUC[2].mau }} /> Trung bình</dt>
            <dd>{so(homNay?.trung_binh)} <small>g</small></dd>
          </div>
        </dl>
      </article>

      <article className="tq-the tq-the-rong">
        <div className="tq-dau">
          <div>
            <h3 className="tq-tieu-de">Diễn biến cường độ carbon trong ngày</h3>
            <p className="tq-phu">Giờ UTC · gCO₂/kWh</p>
          </div>
          <div className="tq-chu-giai">
            <span><i style={{ background: MAU_CHINH }} /> Thực tế</span>
            <span><i className="tq-gach" /> Dự báo</span>
          </div>
        </div>
        {chuoi.length === 0 ? (
          <p className="bieu-do-trang-thai">Chưa có dữ liệu trong ngày.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chuoi}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9eeec" />
              <XAxis dataKey="gio" interval={5} tick={{ fontSize: 11, fill: MAU_TRUNG_TINH }} />
              <YAxis width={45} tick={{ fontSize: 11, fill: MAU_TRUNG_TINH }} />
              <Tooltip isAnimationActive={false} />
              <Area type="monotone" dataKey="thuc_te" name="Thực tế" stroke={MAU_CHINH} fill={MAU_CHINH} fillOpacity={0.12} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="du_bao" name="Dự báo" stroke={MAU_TRUNG_TINH} strokeDasharray="5 4" dot={false} />
              {diemHienTai && diemHienTai.gia_tri !== null && diemHienTai.gia_tri !== undefined && (
                <ReferenceDot x={diemHienTai.gio} y={diemHienTai.gia_tri} r={5} fill={muc.mau} stroke="#fff" strokeWidth={2} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </article>
    </section>
  );
}

export default function TheChiSoThoiGianThuc() {
  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    let dangHoatDong = true;
    async function taiDuLieu() {
      try {
        const data = await layDashboardPhanTich();
        if (dangHoatDong) { setDuLieu(data); setLoi(""); }
      } catch (error) {
        if (dangHoatDong) setLoi(thongDiepLoiApi(error));
      } finally {
        if (dangHoatDong) setDangTai(false);
      }
    }
    taiDuLieu();
    const hen = setInterval(taiDuLieu, CHU_KY_LAM_MOI);
    return () => { dangHoatDong = false; clearInterval(hen); };
  }, []);

  return <GiaoDienTheChiSo hienTai={duLieu?.hien_tai} homNay={duLieu?.hom_nay} dangTai={dangTai} loi={loi} />;
}