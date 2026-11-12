# HeThongCarbonGreatBritain

## Chạy bằng Docker

1. Sao chép `.env.example` thành `.env` và đặt `MSSQL_SA_PASSWORD` thành mật khẩu SQL Server hợp lệ (tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt).
2. Chạy `docker compose -f dockerCompose.yml up --build`.
3. Mở giao diện tại `http://localhost:5173`, tài liệu API tại `http://localhost:8000/docs`.

## API chính

- `GET /api/v1/carbon/latest`: bản ghi gần nhất.
- `GET /api/v1/carbon/history`: chuỗi cường độ carbon.
- `GET /api/v1/regions`: dữ liệu theo vùng.
- `GET /api/v1/analysis/forecast`: dự báo cơ sở 24 giờ tiếp theo.
- `POST /api/v1/admin/collect`: thu thập dữ liệu Carbon Intensity API.

Nguồn dữ liệu: [Carbon Intensity API](https://carbonintensity.org.uk/). Mô hình ML lưu trong `backend/khoLuuMoHinh/` là tùy chọn; khi chưa có artifact, API dự báo dùng baseline theo các điểm gần nhất và ghi rõ phương pháp trong kết quả.
