
import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from "recharts";
import { layBienDong, thongDiepLoiApi } from "../../api/axiosClient.js";
import ThanhTruotPhamVi from "./ThanhTruotPhamVi.jsx";
import ThanhChuGiaiMuc from "./ThanhChuGiaiMuc.jsx";
import { MUC, useThangMuc, mucCuaGiaTri } from "./thangMuc.js";

const TEN_KHOANG = { ngay: "24 giờ qua", tuan: "7 ngày qua", thang: "30 ngày qua" };

export default function BieuDoChuoiThoiGian() {
    const [kieu, setKieu] = useState("ngay");
    const [duLieu, setDuLieu] = useState(null);
    const [dangTai, setDangTai] = useState(true);
    const [loi, setLoi] = useState("");

    const [phamVi, setPhamVi] = useState([0, 0]);
    const [tienTrinh, setTienTrinh] = useState(0);
    const cacMuc = useThangMuc();

    useEffect(() => {
        let dangHoatDong = true;

        async function taiDuLieu() {
            setDangTai(true);
            setDuLieu(null);
            setLoi("");

            try {
                const data = await layBienDong(kieu);

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
        return (duLieu?.du_lieu || []).map((item) => ({
            thoi_gian: item.thoi_gian || item.ngay,
            gia_tri: item.cuong_do ?? item.trung_binh
        }));
    }, [duLieu]);

    const nhanXet = useMemo(() => {
        const ds = duLieuBieuDo.filter((d) => d.gia_tri !== null && d.gia_tri !== undefined);
        if (ds.length === 0 || !cacMuc.length) return null;

        const tb = ds.reduce((t, d) => t + d.gia_tri, 0) / ds.length;
        const cao = ds.reduce((a, b) => (b.gia_tri > a.gia_tri ? b : a));
        const thap = ds.reduce((a, b) => (b.gia_tri < a.gia_tri ? b : a));

        return { tb: Math.round(tb), muc: mucCuaGiaTri(tb, cacMuc), cao, thap };
    }, [duLieuBieuDo, cacMuc]);

    useEffect(() => {
        setPhamVi([0, Math.max(0, duLieuBieuDo.length - 1)]);
    }, [kieu, duLieuBieuDo.length]);

    const duLieuHienThi = useMemo(() => {
        return duLieuBieuDo.slice(
            phamVi[0],
            phamVi[1] + 1
        );
    }, [duLieuBieuDo, phamVi]);

    // Tạo animation nâng đường biểu đồ từ dưới lên
    useEffect(() => {
        if (dangTai || loi || duLieuBieuDo.length === 0) {
            setTienTrinh(0);
            return;
        }

        let khungHinh;
        let thoiDiemBatDau = null;

        const thoiLuong = 900;

        setTienTrinh(0);

        function chayAnimation(thoiGian) {
            if (thoiDiemBatDau === null) {
                thoiDiemBatDau = thoiGian;
            }

            const thoiGianDaChay = thoiGian - thoiDiemBatDau;
            const tienTrinhMoi = Math.min(
                thoiGianDaChay / thoiLuong,
                1
            );

            setTienTrinh(tienTrinhMoi);

            if (tienTrinhMoi < 1) {
                khungHinh = requestAnimationFrame(chayAnimation);
            }
        }

        khungHinh = requestAnimationFrame(chayAnimation);

        return () => {
            cancelAnimationFrame(khungHinh);
        };
    }, [duLieuBieuDo, dangTai, loi]);

    // Tăng đồng thời giá trị của tất cả điểm dữ liệu từ 0 lên thực tế
    const duLieuAnimation = useMemo(() => {
        return duLieuHienThi.map((item) => ({
            ...item,
            gia_tri: item.gia_tri * tienTrinh
        }));
    }, [duLieuHienThi, tienTrinh]);

    const giaTriLonNhat = Math.max(
        1,
        ...duLieuHienThi.map((item) => item.gia_tri || 0)
    );

    function dinhDangThoiGian(value) {
        const ngay = new Date(value);

        if (kieu === "ngay") {
            return ngay.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Ho_Chi_Minh"
            });
        }

        return ngay.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            timeZone: "UTC"
        });
    }

    function phongTo() {
        const [batDau, ketThuc] = phamVi;
        const soDiem = ketThuc - batDau + 1;

        if (soDiem <= 2) return;

        const giam = Math.max(1, Math.round(soDiem * 0.2));
        const moi = Math.max(2, soDiem - giam);

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
        const tongDiem = duLieuBieuDo.length;
        const soDiem = ketThuc - batDau + 1;

        if (soDiem >= tongDiem) return;

        const moi = Math.min(tongDiem, Math.ceil(soDiem * 1.25));
        const tam = (batDau + ketThuc) / 2;

        let dau = Math.round(tam - (moi - 1) / 2);
        let cuoi = dau + moi - 1;

        if (dau < 0) {
            cuoi -= dau;
            dau = 0;
        }

        if (cuoi >= tongDiem) {
            dau -= cuoi - tongDiem + 1;
            cuoi = tongDiem - 1;
        }

        setPhamVi([Math.max(0, dau), cuoi]);
    }

    function datLaiZoom() {
        setPhamVi([0, Math.max(0, duLieuBieuDo.length - 1)]);
    }

    const daZoom =
        phamVi[0] !== 0 ||
        phamVi[1] !== duLieuBieuDo.length - 1;

    return (
        <section className="bieu-do-thoi-gian">
            <div className="bieu-do-tieu-de">
                <div>
                    <h2>Biến động cường độ carbon</h2>
                    <p>Đường là cường độ carbon (gCO₂/kWh); nền màu cho biết mức từ thấp đến cao</p>
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
                    {duLieu?.xu_huong && (
                        <p className="xu-huong">
                            Xu hướng: <strong>{duLieu.xu_huong.ket_luan}</strong>
                            {" "}({duLieu.xu_huong.phan_tram}%)
                        </p>
                    )}

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
                            {duLieuHienThi.length}/{duLieuBieuDo.length} điểm dữ liệu
                        </span>
                    </div>
                </>
            )}

            <div className="bieu-do-khung">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dangTai || loi ? [] : duLieuAnimation}>
                        <CartesianGrid strokeDasharray="3 3" />

                        <XAxis
                            dataKey="thoi_gian"
                            tickFormatter={dinhDangThoiGian}
                            minTickGap={25}
                        />

                        <YAxis
                            domain={[0, Math.ceil(giaTriLonNhat * 1.1)]}
                            width={56}
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
                            labelFormatter={(value) =>
                                new Date(value).toLocaleString("vi-VN", {
                                    timeZone: "Asia/Ho_Chi_Minh"
                                })
                            }
                            formatter={(value) => [
                                `${value.toFixed(2)} gCO₂/kWh`,
                                "Cường độ carbon"
                            ]}
                        />

                        <Line
                            type="monotone"
                            dataKey="gia_tri"
                            stroke="#07866c"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 5 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {!dangTai && !loi && daZoom && (
                <ThanhTruotPhamVi tong={duLieuBieuDo.length} phamVi={phamVi} onDoi={setPhamVi} />
            )}

            {!dangTai && !loi && nhanXet && (
                <>
                    <div style={{ marginTop: 10 }}>
                        <ThanhChuGiaiMuc />
                    </div>
                    <div className="pt-nhan-xet">
                        <strong>Nhận xét:</strong> trong {TEN_KHOANG[kieu]}, cường độ carbon trung bình là{" "}
                        <strong>{nhanXet.tb} gCO₂/kWh</strong>
                        {nhanXet.muc && <>, thuộc mức <strong>{nhanXet.muc.ten}</strong></>}. Cao nhất{" "}
                        {Math.round(nhanXet.cao.gia_tri)} gCO₂/kWh ({dinhDangThoiGian(nhanXet.cao.thoi_gian)}), thấp nhất{" "}
                        {Math.round(nhanXet.thap.gia_tri)} gCO₂/kWh ({dinhDangThoiGian(nhanXet.thap.thoi_gian)}).
                    </div>
                </>
            )}

            {dangTai && (
                <p className="bieu-do-trang-thai">Đang tải dữ liệu...</p>
            )}

            {!dangTai && loi && (
                <p className="bieu-do-trang-thai">{loi}</p>
            )}

            {!dangTai && !loi && duLieuBieuDo.length === 0 && (
                <p className="bieu-do-trang-thai">
                    Chưa có dữ liệu thực tế trong khoảng thời gian này.
                </p>
            )}
        </section>
    );
}
