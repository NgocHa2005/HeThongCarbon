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

### 2. Cấu hình GitHub Actions

Workflow `.github/workflows/carbon-data-collection.yml` chạy thu thập dữ liệu mới nhất vào phút 00 và 30 mỗi giờ. Để runner kết nối Supabase mà không lưu mật khẩu trong Git:

1. Mở GitHub repository → **Settings → Secrets and variables → Actions**.
2. Tạo repository secret tên `DATABASE_URL`, giá trị là URI PostgreSQL Supabase đã URL-encode mật khẩu và bật `sslmode=require`.
3. Tùy chọn, tạo Actions variables `CARBON_ALERT_THRESHOLD=250`, `CARBON_ALERT_CHANGE_PERCENT=30` và `CARBON_ALERT_WINDOW_HOURS=24`.
4. Vào **Actions**, bật workflow nếu GitHub yêu cầu. Workflow phải có trên branch mặc định (`main`).

Không đưa URI vào file workflow, commit, log hoặc nội dung chat. GitHub Actions chạy scraper trực tiếp; backend web không còn lập lịch hoặc gọi Carbon API.

### 3. Khởi động giao diện admin và API

Chạy tại thư mục gốc dự án:

```powershell
docker compose -f dockerCompose.yml up --build -d
docker compose -f dockerCompose.yml ps
```

Docker chỉ khởi động API và giao diện; lịch thu thập vẫn do GitHub Actions chạy kể cả khi Docker tắt.

### 3.1. Các worker thuật toán độc lập

Ba worker có entry point riêng, chạy từ thư mục `backend` trong các terminal riêng:

```powershell
python -m workers.analysis --check
python -m workers.clustering --check
python -m workers.prediction --check
```

`--check` chỉ xác nhận khung entry point; không chạy thuật toán hay ghi kết quả. Thuật toán của ba worker chưa được triển khai, nên chạy lệnh không có `--check` sẽ thoát với mã lỗi thay vì báo thành công giả. Khi nhóm phụ trách bổ sung thuật toán, phần xử lý và hợp đồng dữ liệu sẽ được tích hợp vào đúng worker tương ứng.

### 4. Chạy thủ công hoặc bù dữ liệu

Trong trang GitHub Actions, mở **Carbon data collection → Run workflow**:

- `collect`: lấy dữ liệu mới nhất ngay.
- `backfill`: nhập `start_date` và `end_date` theo `YYYY-MM-DD` (UTC); cả hai ngày đều được tính.

Workflow chia backfill thành các request tối đa 13 ngày để nằm an toàn dưới giới hạn 14 ngày của Carbon Intensity API, và giới hạn mỗi lần chạy tối đa 730 ngày. Backfill lưu các mốc mà API có dữ liệu, tiếp tục qua mốc thiếu ở từng nguồn và ghi cảnh báo vào log Actions cùng `SYS_INGESTION_RUNS.ErrorMessage`; lỗi request/API vẫn làm phiên thất bại. Các bản ghi được upsert theo vùng và thời điểm, nên chạy lại cùng khoảng không tạo bản ghi trùng.

Trang `/admin` có liên kết mở workflow để chạy thủ công hoặc backfill. Lịch tự động không có nút dừng trong backend; có thể tắt workflow trong tab **Actions** hoặc sửa cron trong file workflow.

### 5. Theo dõi trạng thái và chất lượng

Các phiên từ cron và workflow dispatch đều ghi vào `SYS_INGESTION_RUNS`, bao gồm nguồn kích hoạt, thời gian chạy, `SUCCESS`/`FAILED`, số bản ghi thêm/cập nhật và thông báo lỗi. Màn admin kiểm tra lần thành công gần nhất và cảnh báo khi quá 45 phút chưa có lần thành công.

Endpoint `GET /api/v1/admin/quality` kiểm tra vùng `0–17`, dữ liệu vùng gần đây, cơ cấu nguồn điện, tổng phần trăm và sự hiện diện của các bảng downstream. Trang admin đọc tối đa 100 cảnh báo mới nhất từ `SYS_CARBON_ALERTS`. Khi chạy thu thập mới nhất, GitHub Actions ghi một cảnh báo cho bản ghi quốc gia nếu cường độ vượt `250 gCO₂/kWh` hoặc tăng hơn `30%` so với trung bình của 24 giờ trước đó (48 khoảng 30 phút). Cảnh báo tuyệt đối có mức `HIGH`; cảnh báo biến động có mức `MEDIUM`. Backfill lịch sử không phát sinh cảnh báo hồi tố.

Lần thu thập ghi dữ liệu toàn quốc với `RegionId = 0` (`GB`) và dữ liệu vùng được `/regional` trả về. Backend dùng `DIM_REGIONS`, `FACT_CARBON_READINGS`, `FACT_GENERATION_MIX` và `SYS_INGESTION_RUNS`.

### Địa chỉ ứng dụng

- Giao diện người dùng: `http://localhost:5173`
- Khu vực quản trị: `http://localhost:5173/admin`
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

Trang `/admin` chưa có đăng nhập hoặc phân quyền; giới hạn quyền truy cập repository và GitHub Actions.

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
- `GET /api/v1/admin/status`: trạng thái phiên mới nhất và tình trạng lịch thu thập.
- `GET /api/v1/admin/history`: lịch sử thu thập.
- `GET /api/v1/admin/quality`: kiểm tra dữ liệu, bảng cảnh báo và bảng downstream.
- `GET /health`: kiểm tra backend.

Nguồn dữ liệu: [Carbon Intensity API](https://carbonintensity.org.uk/). API dự báo hiện dùng baseline trung bình tối đa 48 bản ghi gần nhất và ghi rõ phương pháp trong kết quả; mô hình ML lưu trong `backend/khoLuuMoHinh/` là tùy chọn.

## Tải source về máy

Git tự tạo thư mục `HeThongCarbon`; không cần tạo thư mục trước:

```powershell
git clone https://github.com/NgocHa2005/HeThongCarbon.git HeThongCarbon
Set-Location HeThongCarbon


.venv\Scripts\Activate.ps1
python -m workers.prediction.tomorrow_forecaster
uvicorn main:app --reload
npm run dev

$env:VITE_API_URL="http://localhost:8001"; npm run dev

```
