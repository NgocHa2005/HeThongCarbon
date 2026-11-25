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
  { khoa: "observed", ten: "Observed – dữ liệu gốc (trung vị theo kỳ)", mau: "#293731" },
  { khoa: "trend", ten: "Trend – xu hướng dài hạn", mau: "#07866c" },
  { khoa: "seasonal", ten: "Seasonal – tính mùa vụ", mau: "#b7791f" },
  { khoa: "resid", ten: "Residual – phần dư", mau: "#77837e" }
];
const LE_BIEU_DO = { top: 6, right: 20, bottom: 4, left: 15 };
const CHIEU_CAO = 150;

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
          <p>
            Đơn vị: gCO₂/kWh · STL, mô hình cộng · Observed = Trend + Seasonal +
            Residual
          </p>
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
              <span>Điểm bất thường (&gt;2σ)</span>
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
        </>
      )}
    </section>
  );
}