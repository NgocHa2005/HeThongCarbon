
import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import {
  layDashboardPhanTich,
  thongDiepLoiApi
} from "../../api/axiosClient.js";
import "./phanTich.css";

export default function TheChiSoThoiGianThuc() {
  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    let dangHoatDong = true;

    async function taiDuLieu() {
      try {
        const data = await layDashboardPhanTich();

        if (dangHoatDong) {
          setDuLieu(data);
          setLoi("");
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

    const interval = setInterval(taiDuLieu, 5 * 60 * 1000);

    return () => {
      dangHoatDong = false;
      clearInterval(interval);
    };
  }, []);

  const hienTai = duLieu?.hien_tai;
  const homNay = duLieu?.hom_nay;

  const mucDo = {
    low: "Thấp",
    moderate: "Trung bình",
    high: "Cao",
    very_high: "Rất cao"
  };

  const thoiGian = hienTai?.thoi_gian
    ? new Date(hienTai.thoi_gian).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh"
      })
    : "--";

  return (
    <section className="the-chi-so">
      <div className="the-chi-so-chinh">
        <div className="the-chi-so-tieu-de">
          <Activity size={20} />
          <span>Cường độ carbon hiện tại</span>
        </div>

        {hienTai ? (
          <>
            <div className="the-chi-so-gia-tri">
              {hienTai.cuong_do ?? "--"}
              <span> gCO₂/kWh</span>
            </div>

            <p>
              Mức độ: {mucDo[hienTai.muc_do] || hienTai.muc_do || "--"}
            </p>

            <p>
              Nguồn dữ liệu: {hienTai.nguon_du_lieu || "--"}
            </p>

            <p>Thời gian: {thoiGian}</p>
          </>
        ) : (
          <p>
            {dangTai
              ? "Đang tải dữ liệu..."
              : loi
                ? "Không thể tải dữ liệu hiện tại."
                : "Chưa có dữ liệu carbon."}
          </p>
        )}

        {dangTai && duLieu && (
          <p className="bieu-do-trang-thai">
            Đang cập nhật dữ liệu...
          </p>
        )}

        {!dangTai && loi && (
          <p className="bieu-do-trang-thai">
            {loi}
          </p>
        )}
      </div>

      <div className="the-chi-so-thong-ke">
        <div>
          <span>Trung bình hôm nay</span>
          <strong>{homNay?.trung_binh ?? "--"}</strong>
        </div>

        <div>
          <span>Cao nhất</span>
          <strong>{homNay?.cao_nhat ?? "--"}</strong>
        </div>

        <div>
          <span>Thấp nhất</span>
          <strong>{homNay?.thap_nhat ?? "--"}</strong>
        </div>

        <div>
          <span>Số bản ghi</span>
          <strong>{homNay?.so_ban_ghi ?? 0}</strong>
        </div>
      </div>
    </section>
  );
}
