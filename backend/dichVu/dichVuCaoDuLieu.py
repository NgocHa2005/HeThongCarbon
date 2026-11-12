import os
import asyncio
from datetime import datetime, timezone
import httpx
import pandas as pd
from sqlalchemy import create_engine
import pyodbc

#Khai báo các URL
#Link lấy dữ liệu của tui nha các bấy bì: https://api.carbonintensity.org.uk/?utm_source=chatgpt.com
urlCuongDoQuocGia = "https://api.carbonintensity.org.uk/intensity"
urlNguonPhat = "https://api.carbonintensity.org.uk/generation"
urlKhuVucDno = "https://api.carbonintensity.org.uk/regional"

#Chuỗi kết nối database, đổi lại theo tên và password của mọi người nha, nếu không đổi thì sẽ không kết nối được đâu kha kha
chuoiKetNoiDb = os.getenv("DATABASE_URL")

def taoKetNoiDb():
    if not chuoiKetNoiDb:
        print("[LOI DB] Chua cau hinh bien moi truong DATABASE_URL.")
        return None
    try:
        engine = create_engine(chuoiKetNoiDb, pool_pre_ping=True)
        return engine
    except Exception as e:
        print(f"Lỗi khi tạo kết nối cơ sở dữ liệu: {e}")
        return None
    
#Các hàm để lấy dữ liệu từ database
async def caoDuLieuCuongDo(client):
    try:
        response = await client.get(urlCuongDoQuocGia, timeout=10.0)
        response.raise_for_status()
        duLieuJson = response.json().get("data", [])[0]
        
        giaoTu = duLieuJson.get("from")
        giaoDen = duLieuJson.get("to")
        thongSoCuongDo = duLieuJson.get("intensity", {})
        
        forecast = thongSoCuongDo.get("forecast")
        actual = thongSoCuongDo.get("actual")
        mucDo = thongSoCuongDo.get("index")
        if actual is None:
            actual = forecast
            print(f"[LAM SACH] Khung {giaoTu}: actual bị trống, đã tự động điền bằng forecast ({forecast}).")

        return {
            "thoiGianTu": giaoTu,
            "thoiGianDen": giaoDen,
            "cuongDoForecast": forecast,
            "cuongDoActual": actual,
            "mucDoIndex": mucDo,
            "thoiGianCao": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        print(f"Lỗi khi lấy dữ liệu cường độ: {e}")

async def caoDuLieuNguonPhat(client: httpx.AsyncClient):
    """
    2. Cào cơ cấu nguồn phát điện (Fuel Mix: Gió, Khí, Mặt trời, Hạt nhân...)
    """
    try:
        response = await client.get(urlNguonPhat, timeout=10.0)
        response.raise_for_status()
        duLieuGoc = response.json().get("data", {})
        
        giaoTu = duLieuGoc.get("from")
        giaoDen = duLieuGoc.get("to")
        danhSachNhienLieu = duLieuGoc.get("generationmix", [])
        
        ketQuaMix = {"thoiGianTu": giaoTu, "thoiGianDen": giaoDen}
        for item in danhSachNhienLieu:
            tenNhienLieu = item.get("fuel")  # ví dụ: wind, gas, solar...
            tyLePhanTram = item.get("perc")  # tỷ lệ %
            ketQuaMix[tenNhienLieu] = tyLePhanTram
            
        return ketQuaMix
    except Exception as loi:
        print(f"[LOI CAO NGUON PHAT] {loi}")
        return None

async def caoDuLieuKhuVuc(client: httpx.AsyncClient):
    """
    3. Cào dữ liệu theo 14 vùng phân phối (Regional DNO Regions)
    """
    try:
        response = await client.get(urlKhuVucDno, timeout=10.0)
        response.raise_for_status()
        duLieuVung = response.json().get("data", [])[0].get("regions", [])
        
        danhSachVungDaLamSach = []
        for vung in duLieuVung:
            danhSachVungDaLamSach.append({
                "regionId": vung.get("regionid"),
                "shortName": vung.get("shortname"),
                "fullName": vung.get("name"),
                "intensityForecast": vung.get("intensity", {}).get("forecast"),
                "intensityIndex": vung.get("intensity", {}).get("index"),
            })
        return danhSachVungDaLamSach
    except Exception as loi:
        print(f"[LOI CAO KHU VUC] {loi}")
        return []

def luuVaoSqlserver(duLieuCarbon, duLieuNguonPhat):
    """Lưu trữ dữ liệu thô đã làm sạch vào cơ sở dữ liệu SQL Server"""
    engine = taoKetNoiDb()
    if not engine:
        return
    
    try:
        if duLieuCarbon:
            dfCarbon = pd.DataFrame([duLieuCarbon])
            dfCarbon.to_sql("soLieuCarbon", con=engine, if_exists="append", index=False)
            
        if duLieuNguonPhat:
            dfFuel = pd.DataFrame([duLieuNguonPhat])
            dfFuel.to_sql("coCauNguonPhat", con=engine, if_exists="append", index=False)
            
        print(f"[THANH CONG] Đã lưu dữ liệu mốc {duLieuCarbon.get('thoiGianTu')} vào SQL Server.")
    except Exception as loi:
        print(f"[LOI LUU SQL] Không thể ghi dữ liệu: {loi}")

async def chayTienTrinhCaoTuDong():
    """
    Tiến trình chạy nền bất đồng bộ (Async Worker), định kỳ 30 phút cào dữ liệu một lần
    """
    print("[HE THONG] Khởi động Worker cào dữ liệu tự động từ National Grid ESO...")
    async with httpx.AsyncClient() as client:
        while True:
            print(f"\n--- Bắt đầu cào đợt mới lúc: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
            duLieuCarbon = await caoDuLieuCuongDo(client)
            duLieuNguon = await caoDuLieuNguonPhat(client)
            await caoDuLieuKhuVuc(client)
            
            if duLieuCarbon:
                luuVaoSqlserver(duLieuCarbon, duLieuNguon)
            await asyncio.sleep(1800)

async def caoDuLieuLichSuTheoKhoang(ngayBatDauStr, ngayKetThucStr):
    """
    Hàm cào dữ liệu lịch sử theo chiến lược chia nhỏ từng đợt tối đa 14 ngày
    để tuân thủ giới hạn của National Grid ESO API.
    Thực hiện cho đồ án của Ngọc Hà.
    """
    ngayBatDau = datetime.strptime(ngayBatDauStr, "%Y-%m-%d")
    ngayKetThuc = datetime.strptime(ngayKetThucStr, "%Y-%m-%d")
    
    deltaKhoang = timedelta(days=13) # Cắt mỗi đợt 13-14 ngày để an toàn tuyệt đối
    hienTai = ngayBatDau

    print(f"[HE THONG] Bắt đầu cào dữ liệu lịch sử từ {ngayBatDauStr} đến {ngayKetThucStr}...")

    async with httpx.AsyncClient(timeout=30.0) as client:
        while hienTai < ngayKetThuc:
            mocKetThucDoan = hienTai + deltaKhoang
            if mocKetThucDoan > ngayKetThuc:
                mocKetThucDoan = ngayKetThuc
            strFrom = hienTai.strftime("%Y-%m-%dT00:00Z")
            strTo = mocKetThucDoan.strftime("%Y-%m-%dT23:59Z")
            
            urlApi = f"https://api.carbonintensity.org.uk/intensity/{strFrom}/{strTo}"
            
            try:
                print(f"Đang cào dữ liệu từ ngày {hienTai.strftime('%Y-%m-%d')} đến {mocKetThucDoan.strftime('%Y-%m-%d')}...")
                response = await client.get(urlApi)
                
                if response.status_code == 200:
                    dataJson = response.json().get("data", [])
                    if dataJson:
                        danhSachBanGhi = []
                        for item in dataJson:
                            danhSachBanGhi.append({
                                "thoiGianBatDau": item.get("from"),
                                "thoiGianKetThuc": item.get("to"),
                                "cuongDoThucTe": item.get("intensity", {}).get("actual"),
                                "cuongDoDuBao": item.get("intensity", {}).get("forecast"),
                                "mucDoChiSo": item.get("intensity", {}).get("index"),
                                "thoiGianCao": datetime.now(timezone.utc).isoformat()
                            })
                        
                        df = pd.DataFrame(danhSachBanGhi)
                        df.to_sql("BangDuLieuCuongDoLichSu", con=engine, if_exists="append", index=False)
                        print(f"--> Đã lưu thành công {len(df)} bản ghi vào SQL Server.")
                    else:
                        print("--> Không có dữ liệu trả về trong khoảng thời gian này.")
                else:
                    print(f"--> Lỗi API trả về mã code: {response.status_code}")

            except Exception as e:
                print(f"--> Lỗi ngoại lệ khi gọi API: {e}")
            await asyncio.sleep(1.0)
            hienTai = mocKetThucDoan + timedelta(days=1)

    print("[HE THONG] Đã hoàn thành toàn bộ tiến trình cào dữ liệu lịch sử cho nhóm!")

if __name__ == "__main__":
    asyncio.run(chayTienTrinhCaoTuDong())