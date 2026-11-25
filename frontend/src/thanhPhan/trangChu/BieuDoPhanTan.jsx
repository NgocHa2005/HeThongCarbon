
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
  Legend
} from "recharts";
import {
  layPhanBo,
  thongDiepLoiApi
} from "../../api/axiosClient.js";

export default function BieuDoPhanTan() {
  const [kieu, setKieu] = useState("ngay");
  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [doMo, setDoMo] = useState(0);

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

  // Tạo đủ 24 mốc giờ, giờ thiếu dữ liệu giữ giá trị null.
  const duLieuBieuDo = useMemo(() => {
    return Array.from({ length: 24 }, (_, gio) => ({
      gio,
      trung_binh: trungBinhTheoGio.has(gio)
        ? trungBinhTheoGio.get(gio)
        : null
    }));
  }, [trungBinhTheoGio]);

  // Animation Fade In đồng thời cho tất cả điểm dữ liệu thực tế.
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
          <p>
            Đơn vị: gCO₂/kWh · So sánh dữ liệu thực tế
            với mức trung bình từng giờ
          </p>
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
              width={55}
              domain={["dataMin - 10", "dataMax + 10"]}
              tickFormatter={(value) => value}
              tickMargin={8}
            />

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
