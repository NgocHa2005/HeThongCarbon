
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  layTanSuat,
  thongDiepLoiApi
} from "../../api/axiosClient.js";
import ThanhTruotPhamVi from "./ThanhTruotPhamVi.jsx"

export default function BieuDoTanSuat() {
  const [kieu, setKieu] = useState("ngay");
  const [duLieu, setDuLieu] = useState(null);
  const [duLieuHoatAnh, setDuLieuHoatAnh] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");

  const [phamVi, setPhamVi] = useState([0, 0]);

  useEffect(() => {
    let dangHoatDong = true;

    async function taiDuLieu() {
      setDangTai(true);
      setDuLieu(null);
      setDuLieuHoatAnh([]);
      setLoi("");

      try {
        const data = await layTanSuat(kieu);

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

 const duLieuBieuDo = useMemo(() => {
  const cac = duLieu?.cac_khoang || [];
  if (cac.length === 0) return [];
  const theoMoc = new Map(cac.map((k) => [parseInt(k.khoang, 10), k]));
  const mocDau = Math.min(...theoMoc.keys());
  const mocCuoi = Math.max(...theoMoc.keys());
  const ketQua = [];
  for (let m = mocDau; m <= mocCuoi; m += 20) {
    ketQua.push(theoMoc.get(m) ?? { khoang: `${m}-${m + 20}`, so_luong: 0 });
  }
  return ketQua;
}, [duLieu]);

  useEffect(() => {
    setPhamVi([0, Math.max(0, duLieuBieuDo.length - 1)]);
  }, [kieu, duLieuBieuDo.length]);

  // Tạo hiệu ứng nâng đồng loạt các cột từ đáy biểu đồ.
  useEffect(() => {
    if (dangTai || loi || duLieuBieuDo.length === 0) {
      setDuLieuHoatAnh([]);
      return;
    }

    const duLieuBanDau = duLieuBieuDo.map((item) => ({
      ...item,
      so_luong: 0
    }));

    setDuLieuHoatAnh(duLieuBanDau);

    const khungHinh = requestAnimationFrame(() => {
      setDuLieuHoatAnh(duLieuBieuDo);
    });

    return () => cancelAnimationFrame(khungHinh);
  }, [dangTai, loi, duLieu]);

  function phongTo() {
    const [batDau, ketThuc] = phamVi;
    const soKhoang = ketThuc - batDau + 1;

    if (soKhoang <= 2) return;

    const giam = Math.max(1, Math.round(soKhoang * 0.2));
    const moi = Math.max(2, soKhoang - giam);

    const tam = (batDau + ketThuc) / 2;
    const nua = Math.floor((moi - 1) / 2);

    let dau = Math.round(tam - nua);
    let cuoi = dau + moi - 1;

    if (dau < 0) {
      cuoi -= dau;
      dau = 0;
    }

    if (cuoi >= duLieuBieuDo.length) {
      dau -= cuoi - duLieuBieuDo.length + 1;
      cuoi = duLieuBieuDo.length - 1;
    }

    setPhamVi([Math.max(0, dau), cuoi]);
  }

  function thuNho() {
    const [batDau, ketThuc] = phamVi;
    const tongKhoang = duLieuBieuDo.length;
    const soKhoang = ketThuc - batDau + 1;

    if (soKhoang >= tongKhoang) return;

    const moi = Math.min(tongKhoang, Math.ceil(soKhoang * 1.25));
    const tam = (batDau + ketThuc) / 2;

    let dau = Math.round(tam - (moi - 1) / 2);
    let cuoi = dau + moi - 1;

    if (dau < 0) {
      cuoi -= dau;
      dau = 0;
    }

    if (cuoi >= tongKhoang) {
      dau -= cuoi - tongKhoang + 1;
      cuoi = tongKhoang - 1;
    }

    setPhamVi([Math.max(0, dau), cuoi]);
  }

  function datLaiZoom() {
    setPhamVi([0, Math.max(0, duLieuBieuDo.length - 1)]);
  }

  const duLieuHienThi = duLieuBieuDo.slice(
    phamVi[0],
    phamVi[1] + 1
  );

  const daZoom =
    phamVi[0] !== 0 ||
    phamVi[1] !== duLieuBieuDo.length - 1;

  const duLieuHienThiBieuDo = dangTai || loi
    ? []
    : duLieuHoatAnh.slice(
        phamVi[0],
        phamVi[1] + 1
      );

  const khongCoDuLieu =
    !dangTai &&
    !loi &&
    duLieuBieuDo.length === 0;

  return (
    <section className="bieu-do-tan-suat">
      <div className="bieu-do-tieu-de">
        <div>
          <h2>Phân bố tần suất cường độ carbon</h2>
          <p>Số lượng bản ghi trong từng khoảng cường độ</p>
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

      {!dangTai && !loi && duLieuBieuDo.length > 0 && (
        <>
          <p className="bieu-do-thong-tin">
            Tổng số bản ghi: <strong>{duLieu.tong_so}</strong>
          </p>

          <div className="bieu-do-dieu-khien">
            <button
              type="button"
              onClick={phongTo}
              disabled={duLieuHienThi.length <= 2}
              title="Phóng to"
            >
              +
            </button>

            <button
              type="button"
              onClick={thuNho}
              disabled={!daZoom}
              title="Thu nhỏ"
            >
              −
            </button>

            {daZoom && (
              <button
                type="button"
                onClick={datLaiZoom}
              >
                Đặt lại
              </button>
            )}

            <span>
              {duLieuHienThi.length}/{duLieuBieuDo.length} khoảng dữ liệu
            </span>
          </div>
        </>
      )}

      <div className="bieu-do-khung">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={duLieuHienThiBieuDo}
            margin={{
              top: 15,
              right: 20,
              bottom: 5,
              left: 15
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="khoang" tick={{ fontSize: 10 }} interval={0}
              angle={-40} textAnchor="end" height={56} tickMargin={6} />

            <YAxis
              allowDecimals={false}
              width={45}
              tick={{ fontSize: 11 }}
              tickMargin={8}
              label={{
                value: "Số bản ghi",
                angle: -90,
                position: "insideLeft",
                style: {
                  fontSize: 12,
                  textAnchor: "middle"
                }
              }}
            />

            <Tooltip
              formatter={(value) => [value, "Số bản ghi"]}
            />

            <Bar
              dataKey="so_luong"
              name="Số bản ghi"
              fill="#07866c"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
        {!dangTai && !loi && daZoom && (
          <ThanhTruotPhamVi tong={duLieuBieuDo.length} phamVi={phamVi} onDoi={setPhamVi} />
        )}
        {!dangTai && !loi && duLieuBieuDo.length > 0 && (
          <p className="truc-x-tieu-de">Cường độ (gCO₂/kWh)</p>
        )}
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
          Chưa có dữ liệu thực tế trong khoảng thời gian này.
        </p>
      )}
    </section>
  );
}
