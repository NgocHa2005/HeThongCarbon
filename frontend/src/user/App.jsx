// frontend/src/user/App.jsx
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpRight, Leaf, MapPin, RefreshCw, Zap } from "lucide-react";
import {
  layCarbonMoiNhat,
  layDuLieuKhuVuc,
  layLichSuCarbon,
  thongDiepLoiApi,
} from "../api/axiosClient.js";

import TrangDashboardCongKhai from "../trang/TrangDashboardCongKhai.jsx";

import "./user.css";
import PublicLayout from "./PublicLayout";

// 3 trang chức năng public
import TrangTongQuanLuoiDien from "../trang/TrangTongQuanLuoiDien";
import TrangDuBao_SacXeDien from "../trang/TrangDuBao_SacXeDien";
import TrangTraCuu_SoSanhKhuVucDNO from "../trang/TrangTraCuu_SoSanhKhuVucDNO";
import TrangThongKeLichSuThoiGian from "../trang/TrangThongKeLichSuThoiGian";
import TrangAI_Machinearning from "../trang/TrangAI_Machinearning";

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

  // State điều hướng các màn hình user
  const [tabHienTai, setTabHienTai] = useState("tong-quan");

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
    <PublicLayout tabHienTai={tabHienTai} onChonTab={setTabHienTai}>
      {tabHienTai === "tong-quan" && <TrangTongQuanLuoiDien />}
      {tabHienTai === "du-bao-ev" && <TrangDuBao_SacXeDien />}
      {tabHienTai === "khu-vuc-dno" && <TrangTraCuu_SoSanhKhuVucDNO />}
      {tabHienTai === "thong-ke-lich-su" && <TrangThongKeLichSuThoiGian />}
      {tabHienTai === "thuat-toan-ai" && <TrangAI_Machinearning />}
    </PublicLayout>
  );

  return <TrangDashboardCongKhai trangNguonDien={trangNguonDien} />;
}

export default UserApp;