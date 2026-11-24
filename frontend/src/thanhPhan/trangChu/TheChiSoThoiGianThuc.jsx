import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

const chuanHoaMuc = (m) => String(m || "").toLowerCase().replace("_", " ");
const gioUtc = (iso) => (iso ? new Date(iso).toISOString().slice(11, 16) : "--");
const so = (v) => (v === null || v === undefined ? "--" : v);

export function GiaoDienTheChiSo({ hienTai, homNay, dangTai, loi }) {
  const viTri = MUC.findIndex((m) => m.khoa === chuanHoaMuc(hienTai?.muc_do));
  const muc = viTri >= 0 ? MUC[viTri] : { ten: hienTai?.muc_do || "--", mau: "#77837e" };
  const laDuBao = hienTai?.nguon_du_lieu === "Dự báo";
  const chuoi = (homNay?.chuoi || []).map((d) => ({
    gio: gioUtc(d.thoi_gian),
    thuc_te: d.thuc_te,
    du_bao: d.du_bao,
  }));

  return (
    <section className="the-chi-so">
      <div className="the-chi-so-chinh">
        <div className="the-chi-so-dau">
          <div className="the-chi-so-tieu-de">
            <Activity size={20} />
            <span>Cường độ carbon hiện tại</span>
          </div>
          {laDuBao && <span className="the-chi-so-nhan-phu">Dự báo</span>}
        </div>

        {hienTai ? (
          <>
            <div className="the-chi-so-gia-tri" style={{ color: muc.mau }}>
              {so(hienTai.cuong_do)}
              <span> gCO₂/kWh</span>
            </div>
            <span className="the-chi-so-huy-hieu" style={{ background: muc.mau }}>{muc.ten}</span>

            <div className="thang-muc">
              {viTri >= 0 && (
                <span className="thang-muc-dau" style={{ left: `${((viTri + 0.5) / MUC.length) * 100}%` }}>
                  {so(hienTai.cuong_do)}
                </span>
              )}
              {MUC.map((m) => (
                <div key={m.khoa}>
                  <div className="thang-muc-doan" style={{ background: m.mau, opacity: m.khoa === muc.khoa ? 1 : 0.35 }} />
                  <div className="thang-muc-nhan">{m.ten}</div>
                </div>
              ))}
            </div>

            <p>
              Khung {gioUtc(hienTai.thoi_gian)} – {gioUtc(hienTai.den_thoi_diem)} (UTC) · Cập nhật{" "}
              {gioUtc(hienTai.cap_nhat_luc)} (UTC)
            </p>
          </>
        ) : (
          <p>{dangTai ? "Đang tải dữ liệu..." : loi ? "Không thể tải dữ liệu hiện tại." : "Chưa có dữ liệu carbon."}</p>
        )}
        {!dangTai && loi && <p className="bieu-do-trang-thai bieu-do-trang-thai-loi">{loi}</p>}
      </div>

      <div className="the-chi-so-thong-ke">
        <div><span>Trung bình hôm nay</span><strong>{so(homNay?.trung_binh)}</strong></div>
        <div><span>Cao nhất</span><strong>{so(homNay?.cao_nhat)}</strong></div>
        <div><span>Thấp nhất</span><strong>{so(homNay?.thap_nhat)}</strong></div>
        <div><span>Số bản ghi</span><strong>{homNay?.so_ban_ghi ?? 0}</strong></div>
      </div>

      <div className="the-chi-so-bieu-do">
        <h3>Diễn biến trong ngày (UTC)</h3>
        {chuoi.length === 0 ? (
          <p className="bieu-do-trang-thai">Chưa có dữ liệu trong ngày.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chuoi}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="gio" interval={5} tick={{ fontSize: 11 }} />
              <YAxis width={45} tick={{ fontSize: 11 }} />
              <Tooltip isAnimationActive={false} />
              <Area type="monotone" dataKey="thuc_te" name="Thực tế" stroke="#07866c" fill="#07866c" fillOpacity={0.15} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="du_bao" name="Dự báo" stroke="#77837e" strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
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