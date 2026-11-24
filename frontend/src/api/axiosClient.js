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

export async function layChatLuongDuLieu() {
  const { data } = await client.get("/api/v1/admin/quality");
  return data;
}

export async function layLichSuThuThap() {
  const { data } = await client.get("/api/v1/admin/history");
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

export async function layTongQuanPhanCum(params = {}) {
  const { data } = await client.get("/phan-tich/phan-cum/tong-quan", {
    params,
  });
  return data;
}

export async function layDuBaoNgayMai(params = {}) {
  const { data } = await client.get("/phan-tich/du-bao/ngay-mai", {
    params,
  });
  return data;
}


export async function layBienDong(kieu = "ngay") {
  const { data } = await client.get("/api/v1/analysis/fluctuation", {
    params: { kieu },
  });
  return data;
}

export async function layPhanBo(kieu = "ngay") {
  const { data } = await client.get("/api/v1/analysis/scatter", {
    params: { kieu },
  });
  return data;
}

export async function layTanSuat(kieu = "ngay") {
  const { data } = await client.get("/api/v1/analysis/histogram", {
    params: { kieu },
  });
  return data;
}

export async function layDashboardPhanTich() {
  const { data } = await client.get("/api/v1/analysis/dashboard");
  return data;
}
