
import React, { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea
} from "recharts";
import {
  layPhanBo,
  thongDiepLoiApi
} from "../../api/axiosClient.js";

import ThanhChuGiaiMuc from "./ThanhChuGiaiMuc.jsx";
import { MUC, useThangMuc, mucCuaGiaTri } from "./thangMuc.js";

const TEN_KHOANG = { ngay: "24 giờ qua", tuan: "7 ngày qua", thang: "30 ngày qua" };

export default function BieuDoPhanTan() {
  const [kieu, setKieu] = useState("ngay");
  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [doMo, setDoMo] = useState(0);
  const cacMuc = useThangMuc();

  useEffect(() => {
    let dangHoatDong = true;

    async function taiDuLieu() {
      setDangTai(true);
      setDuLieu(null);
      setLoi("");

      try {
        const data = await layPhanBo(kieu);

        if (dangHoatDong) {
          setDuLieu(data);
        }
      } catch (error) {
        if (dangHoatDong) {
          setLoi(thongDiepLoiApi(error));
        }
      } finally {
        if (dangHoatDong) {
          setDangTai(false);
        }
      }
    }

    taiDuLieu();

    return () => {
      dangHoatDong = false;
    };
  }, [kieu]);

  const duLieuGoc = useMemo(() => {
    return (dangTai || loi ? [] : duLieu?.du_lieu || []).map((item) => ({
      gio: Number(item.gio),
      cuong_do: Number(item.cuong_do)
    }));
  }, [dangTai, loi, duLieu]);

  const trungBinhTheoGio = useMemo(() => {
    return new Map(
      (dangTai || loi
        ? []
        : duLieu?.trung_binh_theo_gio || []
      ).map((item) => [
        Number(item.gio),
        Number(item.trung_binh)
      ])
    );
  }, [dangTai, loi, duLieu]);

  const duLieuBieuDo = useMemo(() => {
    return Array.from({ length: 24 }, (_, gio) => ({
      gio,
      trung_binh: trungBinhTheoGio.has(gio)
        ? trungBinhTheoGio.get(gio)
        : null
    }));
  }, [trungBinhTheoGio]);

  const nhanXet = useMemo(() => {
    const ds = duLieuBieuDo.filter((d) => d.trung_binh !== null);
    if (ds.length === 0 || !cacMuc.length) return null;

    const thap = ds.reduce((a, b) => (b.trung_binh < a.trung_binh ? b : a));
    const cao = ds.reduce((a, b) => (b.trung_binh > a.trung_binh ? b : a));

    return {
      thap,
      cao,
      chenh: Math.round(cao.trung_binh - thap.trung_binh),
      mucThap: mucCuaGiaTri(thap.trung_binh, cacMuc),
      mucCao: mucCuaGiaTri(cao.trung_binh, cacMuc),
    };
  }, [duLieuBieuDo, cacMuc]);

  useEffect(() => {
    if (dangTai || loi || duLieuGoc.length === 0) {
      setDoMo(0);
      return;
    }

    let khungHinh;
    let thoiDiemBatDau = null;

    const thoiLuong = 350;

    setDoMo(0);

    function chayAnimation(thoiGian) {
      if (thoiDiemBatDau === null) {
        thoiDiemBatDau = thoiGian;
      }

      const tienTrinh = Math.min(
        (thoiGian - thoiDiemBatDau) / thoiLuong,
        1
      );

      setDoMo(tienTrinh);

      if (tienTrinh < 1) {
        khungHinh = requestAnimationFrame(chayAnimation);
      }
    }

    khungHinh = requestAnimationFrame(chayAnimation);

    return () => {
      cancelAnimationFrame(khungHinh);
    };
  }, [duLieuGoc, dangTai, loi]);

  const khongCoDuLieu =
    !dangTai &&
    !loi &&
    duLieuGoc.length === 0 &&
    trungBinhTheoGio.size === 0;

  return (
    <section className="bieu-do-phan-bo">
      <div className="bieu-do-tieu-de">
        <div>
          <h2>Phân bố cường độ carbon theo giờ</h2>
          <p>Mỗi chấm là một khung 30 phút; đường vàng là trung bình theo giờ (gCO₂/kWh)</p>
        </div>

        <select
          value={kieu}
          onChange={(e) => setKieu(e.target.value)}
        >
          <option value="ngay">24 giờ</option>
          <option value="tuan">7 ngày</option>
          <option value="thang">30 ngày</option>
        </select>
      </div>

      <div className="bieu-do-khung">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={duLieuBieuDo}
            margin={{
              top: 20,
              right: 20,
              bottom: 15,
              left: 15
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              type="number"
              dataKey="gio"
              domain={[0, 23]}
              ticks={[0, 4, 8, 12, 16, 20]}
              tickFormatter={(value) => `${value}h`}
              tickMargin={10}
              allowDataOverflow
            />

            <YAxis
              width={60}
              domain={["dataMin - 10", "dataMax + 10"]}
              tickFormatter={(value) => value}
              tickMargin={8}
              label={{ value: "gCO₂/kWh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
            />

            {/* Nền màu theo mức cường độ */}
            {cacMuc.map((m, i) => {
              if (m.tu === null) return null;
              const tiep = cacMuc.slice(i + 1).find((x) => x.tu !== null)?.tu;
              return (
                <ReferenceArea
                  key={m.khoa}
                  y1={m.tu}
                  y2={tiep ?? 10000}
                  ifOverflow="hidden"
                  fill={MUC.find((x) => x.khoa === m.khoa)?.mau}
                  fillOpacity={0.12}
                  strokeOpacity={0}
                />
              );
            })}

            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toFixed(2)} gCO₂/kWh`,
                name
              ]}
              labelFormatter={(value) => `${value}h`}
            />

            <Legend verticalAlign="bottom" />

            <Scatter
              name="Dữ liệu thực tế"
              data={duLieuGoc}
              dataKey="cuong_do"
              fill="#07866c"
              fillOpacity={0.7 * doMo}
              shape="circle"
              isAnimationActive={false}
            />

            <Line
              name="Trung bình theo giờ"
              type="monotone"
              dataKey="trung_binh"
              stroke="#d49a42"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {!dangTai && !loi && nhanXet && (
        <>
          <div style={{ marginTop: 10 }}>
            <ThanhChuGiaiMuc />
          </div>
          <div className="pt-nhan-xet">
            <strong>Nhận xét:</strong> trong {TEN_KHOANG[kieu]}, cường độ trung bình thấp nhất lúc{" "}
            <strong>{nhanXet.thap.gio}h</strong> ({Math.round(nhanXet.thap.trung_binh)} gCO₂/kWh
            {nhanXet.mucThap && <>, mức {nhanXet.mucThap.ten}</>}) và cao nhất lúc{" "}
            <strong>{nhanXet.cao.gio}h</strong> ({Math.round(nhanXet.cao.trung_binh)} gCO₂/kWh
            {nhanXet.mucCao && <>, mức {nhanXet.mucCao.ten}</>}); chênh lệch giữa hai khung giờ là{" "}
            {nhanXet.chenh} gCO₂/kWh.
          </div>
        </>
      )}
      
      {dangTai && (
        <p className="bieu-do-trang-thai">
          Đang tải dữ liệu...
        </p>
      )}

      {!dangTai && loi && (
        <p className="bieu-do-trang-thai">
          {loi}
        </p>
      )}

      {khongCoDuLieu && (
        <p className="bieu-do-trang-thai">
          Chưa có dữ liệu trong khoảng thời gian này.
        </p>
      )}
    </section>
  );
}
