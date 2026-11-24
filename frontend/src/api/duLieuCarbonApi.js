// frontend/src/api/duLieuCarbonApi.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export function trichXuatThongBaoLoi(err) {
  if (err?.response?.data?.detail) {
    const detail = err.response.data.detail;
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }
  if (err?.message) return err.message;
  return "Không thể kết nối tới máy chủ Backend (kiểm tra cổng 8000).";
}

// =========================================================================
// CHỨC NĂNG 1: NĂNG LƯỢNG & TƯƠNG QUAN (nang_luong_router.py)
// =========================================================================

export async function layCoCauNguonDienHienTai() {
  const res = await apiClient.get("/api/energy/generation-mix/current");
  return res.data;
}

export async function layMaTranTuongQuan(days = 30) {
  const res = await apiClient.get("/api/energy/correlation-heatmap", {
    params: { days },
  });
  return res.data;
}

// =========================================================================
// CHỨC NĂNG 2: KHU VỰC DNO & GỢI Ý SẠC XE ĐIỆN (khu_vuc_ev_router.py)
// =========================================================================

export async function layDanhSachKhuVuc() {
  const res = await apiClient.get("/api/regions");
  return res.data;
}

export async function layXepHangVungDno() {
  const res = await apiClient.get("/api/regions/ranking");
  return res.data;
}

export async function layTrangThaiKhuVuc(regionId) {
  const res = await apiClient.get(`/api/regions/${regionId}/status`);
  return res.data;
}

export async function layGoiYSacXeDien(durationHours = 2.0, batteryKwh = 60.0) {
  const res = await apiClient.get("/api/ev/recommendation", {
    params: {
      duration_hours: durationHours,
      battery_kwh: batteryKwh,
    },
  });
  return res.data;
}