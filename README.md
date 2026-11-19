## Chạy dự án với Supabase

- Docker Desktop đã cài đặt và đang chạy.
- Docker Compose v2 (`docker compose`).
- Một project Supabase có các bảng ứng dụng.

### 1. Cấu hình kết nối

Trong thư mục gốc dự án, mở file `.env`. Nếu chưa có file này, tạo từ mẫu:

```powershell
Copy-Item .env.example .env
```

Không chạy lệnh sao chép nếu `.env` đã có cấu hình bạn muốn giữ. Đặt `DATABASE_URL` bằng URI **Session Pooler** lấy từ Supabase → **Connect** → **Connection string** → **URI**. Với thông tin kết nối của project hiện tại, dòng có dạng:

```text
DATABASE_URL=postgresql://postgres.lyqhwrpbrwhmllftckmb:<MAT_KHAU_DA_URL_ENCODE>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require
```

Thay placeholder mật khẩu bằng mật khẩu database đã URL-encode. Giữ nguyên các biến khác trong `.env`; không đưa mật khẩu hoặc API key vào Git hay chat.

### 2. Build và khởi động

Chạy tại thư mục gốc dự án:

```powershell
docker compose -f dockerCompose.yml up --build -d
docker compose -f dockerCompose.yml ps
```

Compose khởi động frontend và backend; backend kết nối Supabase qua `DATABASE_URL`, không chạy SQL Server. Theo dõi log backend:

```powershell
docker compose -f dockerCompose.yml logs -f backend
```

### 3. Thu thập dữ liệu lần đầu

Backend không tự thu thập ngay khi khởi động. Gọi endpoint sau trong PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/admin/collect
Invoke-RestMethod -Uri http://localhost:8000/api/v1/admin/status
```

Lần thu thập đầu sẽ lưu dữ liệu toàn quốc với `RegionId = 0` (`GB`) và đồng bộ các vùng được `/regional` trả về (IDs 1–17). Backend dùng các bảng `DIM_REGIONS`, `FACT_CARBON_READINGS`, `FACT_GENERATION_MIX` và `SYS_INGESTION_RUNS`. SQLAlchemy tạo bảng cần thiết nếu chưa tồn tại, nhưng không sửa cấu trúc bảng đã có hoặc chuyển dữ liệu cũ.

### Địa chỉ ứng dụng

- Giao diện người dùng: `http://localhost:5173`
- Khu vực quản trị: `http://localhost:5173/admin`
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

Trang `/admin` hiện chỉ là giao diện quản trị, chưa có đăng nhập hoặc phân quyền.

### Dừng ứng dụng

```powershell
docker compose -f dockerCompose.yml down
```

Lệnh này chỉ dừng container, không xóa dữ liệu Supabase.

## API chính

- `GET /api/v1/carbon/latest`: bản ghi gần nhất.
- `GET /api/v1/carbon/history`: chuỗi cường độ carbon.
- `GET /api/v1/regions`: dữ liệu theo vùng.
- `GET /api/v1/analysis/forecast`: dự báo cơ sở 24 giờ tiếp theo.
- `GET /api/v1/admin/status`: trạng thái lần thu thập gần nhất.
- `GET /api/v1/admin/history`: lịch sử thu thập.
- `POST /api/v1/admin/collect`: thu thập dữ liệu Carbon Intensity API.
- `GET /health`: kiểm tra backend.

Nguồn dữ liệu: [Carbon Intensity API](https://carbonintensity.org.uk/). API dự báo hiện dùng baseline trung bình tối đa 48 bản ghi gần nhất và ghi rõ phương pháp trong kết quả; mô hình ML lưu trong `backend/khoLuuMoHinh/` là tùy chọn.

## Tải source về máy

Git tự tạo thư mục `HeThongCarbon`; không cần tạo thư mục trước:

```powershell
git clone https://github.com/NgocHa2005/HeThongCarbon.git HeThongCarbon
Set-Location HeThongCarbon
```
