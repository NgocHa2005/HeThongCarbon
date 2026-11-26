import React, { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { layPhanRa, thongDiepLoiApi } from "../../api/axiosClient.js";

const BON_BIEU_DO = [
  { khoa: "observed", ten: "Dữ liệu gốc (Observed): cường độ trung vị của từng kỳ", mau: "#293731" },
  { khoa: "trend", ten: "Xu hướng dài hạn (Trend): cường độ đang tăng hay giảm qua các kỳ", mau: "#07866c" },
  { khoa: "seasonal", ten: "Chu kỳ theo mùa (Seasonal): mức tăng giảm lặp lại mỗi năm", mau: "#b7791f" },
  { khoa: "resid", ten: "Phần bất thường (Residual): phần còn lại sau khi trừ xu hướng và mùa vụ", mau: "#77837e" }
];
const LE_BIEU_DO = { top: 6, right: 20, bottom: 4, left: 15 };
const CHIEU_CAO = 150;

function taoNhanXet(diem, tk) {
  const cau = [];
  const doi = tk?.thay_doi_trend_phan_tram;
  if (doi !== null && doi !== undefined) {
    const huong = doi > 0 ? "tăng" : doi < 0 ? "giảm" : "không đổi";
    cau.push(
      `Từ ${diem[0].nhan} đến ${diem[diem.length - 1].nhan}, xu hướng dài hạn ${huong}${doi !== 0 ? ` ${Math.abs(doi)}%` : ""}.`
    );
  }
  if (tk?.chenh_dong_he !== null && tk?.chenh_dong_he !== undefined) {
    cau.push(`Mùa vụ làm cường độ chênh khoảng ${tk.chenh_dong_he} gCO₂/kWh giữa mùa cao và mùa thấp.`);
  }
  if (tk?.so_bat_thuong !== null && tk?.so_bat_thuong !== undefined) {
    cau.push(
      tk.so_bat_thuong === 0
        ? "Không có kỳ nào bất thường."
        : `Có ${tk.so_bat_thuong} kỳ bất thường (lệch hơn 2 độ lệch chuẩn so với quy luật).`
    );
  }
  return cau.join(" ");
}

function giaTri(v, hauTo = "") {
  return v === null || v === undefined ? "--" : `${v}${hauTo}`;
}

export default function BieuDoPhanRa() {
  const [kieu, setKieu] = useState("thang");
  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    let dangHoatDong = true;
    setDangTai(true);
    setDuLieu(null);
    setLoi("");

    layPhanRa(kieu)
      .then((data) => {
        if (dangHoatDong) setDuLieu(data);
      })
      .catch((error) => {
        // 404 = bảng phân rã trống: hiện thông báo gọn, không làm sập trang
        if (dangHoatDong) setLoi(thongDiepLoiApi(error));
      })
      .finally(() => {
        if (dangHoatDong) setDangTai(false);
      });

    return () => {
      dangHoatDong = false;
    };
  }, [kieu]);

  const diem = duLieu?.diem || [];
  const tk = duLieu?.thong_ke;
  const coDuLieu = !dangTai && !loi && diem.length > 0;

  return (
    <section className="bieu-do-phan-ra">
      <div className="bieu-do-tieu-de">
        <div>
          <h2>Phân rã xu hướng và mùa vụ</h2>
          <p>Tách cường độ carbon (gCO₂/kWh) thành 3 phần: dữ liệu gốc = xu hướng + mùa vụ + bất thường</p>
        </div>

        <select value={kieu} onChange={(e) => setKieu(e.target.value)}>
          <option value="thang">Theo tháng</option>
          <option value="tuan">Theo tuần</option>
        </select>
      </div>

      {dangTai && <p className="bieu-do-trang-thai">Đang tải dữ liệu...</p>}

      {!dangTai && loi && (
        <p className="bieu-do-trang-thai bieu-do-trang-thai-loi">
          Chưa hiển thị được phân rã: {loi}
        </p>
      )}

      {coDuLieu && (
        <>
          <div className="phan-ra-thong-ke">
            <div>
              <span>Thay đổi Trend toàn kỳ</span>
              <strong>{giaTri(tk?.thay_doi_trend_phan_tram, "%")}</strong>
            </div>
            <div>
              <span>Chênh lệch mùa cao – thấp</span>
              <strong>{giaTri(tk?.chenh_dong_he, " gCO₂/kWh")}</strong>
            </div>
            <div>
              <span>Số kỳ bất thường (lệch &gt; 2σ)</span>
              <strong>{giaTri(tk?.so_bat_thuong)}</strong>
            </div>
          </div>

          {BON_BIEU_DO.map(({ khoa, ten, mau }, i) => (
            <div key={khoa} className="phan-ra-bieu-do">
              <p className="phan-ra-ten">{ten}</p>
              <ResponsiveContainer width="100%" height={CHIEU_CAO}>
                <LineChart data={diem} syncId="phan-ra" margin={LE_BIEU_DO}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="nhan"
                    hide={i !== BON_BIEU_DO.length - 1}
                    tick={{ fontSize: 11 }}
                    tickMargin={8}
                    minTickGap={40}
                  />
                  <YAxis
                    width={50}
                    tick={{ fontSize: 11 }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip isAnimationActive={false} />
                  {(khoa === "seasonal" || khoa === "resid") && (
                    <ReferenceLine y={0} stroke="#919c96" />
                  )}
                  <Line
                    type="monotone"
                    dataKey={khoa}
                    stroke={mau}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={700}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}

          <div className="pt-nhan-xet">
            <strong>Nhận xét:</strong> {taoNhanXet(diem, tk)}
          </div>
          
        </>
      )}
    </section>
  );
}