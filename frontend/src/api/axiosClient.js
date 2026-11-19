import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 15000,
  headers: { Accept: "application/json" },
});

export async function layTrangThaiThuThap() {
  const { data } = await client.get("/api/v1/admin/status");
  return data;
}

export async function layLichSuThuThap() {
  const { data } = await client.get("/api/v1/admin/history");
  return data;
}

export async function kichHoatThuThap() {
  const { data } = await client.post("/api/v1/admin/collect");
  return data;
}

export async function dungThuThapDinhKy() {
  const { data } = await client.post("/api/v1/admin/collect/stop");
  return data;
}

export async function layCarbonMoiNhat() {
  const { data } = await client.get("/api/v1/carbon/latest");
  return data;
}

export async function layLichSuCarbon() {
  const { data } = await client.get("/api/v1/carbon/history");
  return data;
}

export async function layDuLieuKhuVuc() {
  const { data } = await client.get("/api/v1/regions");
  return data;
}

export function thongDiepLoiApi(error) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "Không thể kết nối tới máy chủ."
  );
}
