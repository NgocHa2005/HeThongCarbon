import datetime

from fastapi import HTTPException
from models.dim_region import DimRegion
from models.fact_carbon_reading import FactCarbonReading
from models.fact_ml_prediction import FactMlPrediction
from schemas.khu_vuc_ev_schema import (
    EvRecommendationResponse,
    RegionItem,
    RegionRankingItem,
    RegionRankingResponse,
    RegionStatusResponse,
    TimeSlotDetail,
)
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session


class KhuVucEvService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_regions(self) -> list[RegionItem]:
        """Lấy danh sách 17 khu vực địa phương (bỏ qua RegionId = 0 là toàn quốc)."""
        stmt = (
            select(DimRegion)
            .where(DimRegion.RegionId > 0)
            .order_by(DimRegion.RegionId.asc())
        )
        regions = self.db.execute(stmt).scalars().all()
        return [
            RegionItem(
                region_id=r.RegionId,
                short_name=r.ShortName,
                full_name=r.FullName,
            )
            for r in regions
        ]

    def _get_latest_national_baseline(
        self,
    ) -> tuple[datetime.datetime, datetime.datetime, int]:
        """Hàm nội bộ: Tìm khung 30 phút mới nhất và chỉ số chuẩn của toàn quốc (RegionId = 0)."""
        stmt = (
            select(FactCarbonReading)
            .where(FactCarbonReading.RegionId == 0)
            .order_by(desc(FactCarbonReading.FromTime))
            .limit(1)
        )
        national_row = self.db.execute(stmt).scalar_one_or_none()
        if not national_row:
            raise HTTPException(
                status_code=404,
                detail="Chưa có dữ liệu cường độ carbon toàn quốc trên hệ thống.",
            )

        # Toàn quốc ưu tiên lấy số đo thực tế; nếu chưa có thì dùng số dự báo
        national_val = (
            national_row.IntensityActual
            if national_row.IntensityActual is not None
            else national_row.IntensityForecast
        )
        return national_row.FromTime, national_row.ToTime, national_val

    def get_dno_rankings(self) -> RegionRankingResponse:
        """Xếp hạng 14 vùng phân phối điện (RegionId 1..14) từ sạch nhất đến ô nhiễm nhất."""
        from_time, to_time, national_val = self._get_latest_national_baseline()

        stmt = (
            select(FactCarbonReading, DimRegion)
            .join(DimRegion, FactCarbonReading.RegionId == DimRegion.RegionId)
            .where(
                FactCarbonReading.FromTime == from_time,
                FactCarbonReading.RegionId.between(1, 14),
            )
            .order_by(FactCarbonReading.IntensityForecast.asc())
        )
        rows = self.db.execute(stmt).all()
        if not rows:
            raise HTTPException(
                status_code=404,
                detail="Chưa có dữ liệu chi tiết các vùng DNO ở khung giờ hiện tại.",
            )

        rankings: list[RegionRankingItem] = []
        for idx, (reading, region) in enumerate(rows, start=1):
            reg_val = reading.IntensityForecast
            diff_perc = (
                round(((reg_val - national_val) / national_val) * 100, 1)
                if national_val > 0
                else 0.0
            )
            rankings.append(
                RegionRankingItem(
                    rank=idx,
                    region_id=region.RegionId,
                    short_name=region.ShortName,
                    full_name=region.FullName,
                    intensity=reg_val,
                    intensity_index=reading.IntensityIndex,
                    diff_from_national_perc=diff_perc,
                )
            )

        return RegionRankingResponse(
            from_time=from_time,
            to_time=to_time,
            national_intensity=national_val,
            rankings=rankings,
        )

    def get_region_status(self, region_id: int) -> RegionStatusResponse:
        """Tra cứu chỉ số của 1 khu vực cụ thể và đối chiếu với mức trung bình toàn quốc."""
        from_time, to_time, national_val = self._get_latest_national_baseline()

        stmt = (
            select(FactCarbonReading, DimRegion)
            .join(DimRegion, FactCarbonReading.RegionId == DimRegion.RegionId)
            .where(
                FactCarbonReading.FromTime == from_time,
                FactCarbonReading.RegionId == region_id,
            )
        )
        result = self.db.execute(stmt).first()
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Không tìm thấy dữ liệu hiện tại cho khu vực có ID = {region_id}.",
            )

        reading, region = result
        reg_val = reading.IntensityForecast
        diff_value = reg_val - national_val
        diff_percent = (
            round((diff_value / national_val) * 100, 1) if national_val > 0 else 0.0
        )

        if diff_value < 0:
            status_msg = f"Sạch hơn mức trung bình cả nước {abs(diff_percent)}% (-{abs(diff_value)} gCO2/kWh)"
        elif diff_value > 0:
            status_msg = f"Cao hơn mức trung bình cả nước {diff_percent}% (+{diff_value} gCO2/kWh)"
        else:
            status_msg = "Bằng đúng mức trung bình cả nước"

        return RegionStatusResponse(
            region_id=region.RegionId,
            short_name=region.ShortName,
            full_name=region.FullName,
            from_time=from_time,
            to_time=to_time,
            regional_intensity=reg_val,
            intensity_index=reading.IntensityIndex,
            national_intensity=national_val,
            diff_value=diff_value,
            diff_percent=diff_percent,
            status_message=status_msg,
        )

    def get_ev_recommendation(
        self, duration_hours: float = 2.0, battery_kwh: float = 60.0
    ) -> EvRecommendationResponse:
        """Thuật toán Cửa sổ trượt (Sliding Window) tìm khung giờ sạc xe điện xanh nhất."""
        # 1. Xác định ngày dự báo (ưu tiên ngày mai UTC; nếu chưa có thì lấy ngày dự báo mới nhất trong DB)
        tomorrow_utc = datetime.datetime.now(datetime.UTC).date() + datetime.timedelta(
            days=1
        )
        target_date = tomorrow_utc

        check_stmt = select(func.count(FactMlPrediction.PredId)).where(
            FactMlPrediction.TargetDate == tomorrow_utc
        )
        if (self.db.execute(check_stmt).scalar() or 0) == 0:
            latest_pred_date = self.db.execute(
                select(func.max(FactMlPrediction.TargetDate))
            ).scalar()
            if not latest_pred_date:
                raise HTTPException(
                    status_code=404,
                    detail="Bảng FACT_ML_PREDICTIONS hiện chưa có dữ liệu dự báo.",
                )
            target_date = latest_pred_date

        # 2. Lấy toàn bộ các khung 30 phút của ngày mục tiêu, sắp xếp tăng dần theo thời gian
        stmt = (
            select(FactMlPrediction)
            .where(FactMlPrediction.TargetDate == target_date)
            .order_by(FactMlPrediction.TargetFromTime.asc())
        )
        predictions = self.db.execute(stmt).scalars().all()

        # 3. Quy đổi số giờ sạc thành số khung 30 phút liên tiếp (ví dụ: 2.0 giờ -> k = 4 khung)
        window_size = max(1, int(round(duration_hours * 2)))
        if len(predictions) < window_size:
            raise HTTPException(
                status_code=400,
                detail=f"Dữ liệu dự báo ngày {target_date} chỉ có {len(predictions)} khung, không đủ cho gói sạc {duration_hours} giờ.",
            )

        # 4. Chạy Cửa sổ trượt qua mảng predictions để tìm cực tiểu (xanh nhất) và cực đại (cao điểm)
        min_avg = float("inf") # Dương vô cùng
        max_avg = float("-inf") # Âm vô cùng
        best_window: list[FactMlPrediction] = []
        worst_window: list[FactMlPrediction] = []

        #chảy vòng lặp để tính khung h tối ưu nhất 
        for i in range(len(predictions) - window_size + 1):
            current_window = predictions[i : i + window_size]
            avg_intensity = (
                sum(slot.PredictedIntensity for slot in current_window) / window_size
            )

            if avg_intensity < min_avg:
                min_avg = avg_intensity
                best_window = current_window

            if avg_intensity > max_avg:
                max_avg = avg_intensity
                worst_window = current_window

        # 5. Tính toán lượng CO2 tiết kiệm được (kg) khi sạc ở khung vàng thay vì giờ cao điểm
        optimal_avg = round(min_avg, 1)
        peak_avg = round(max_avg, 1)
        co2_saved_kg = round(((max_avg - min_avg) * battery_kwh) / 1000.0, 2)
        # Tính xem giảm được bao nhiêu % phát thải so với lúc cao điểm 
        saving_percent = (
            round(((max_avg - min_avg) / max_avg) * 100.0, 1) if max_avg > 0 else 0.0
        )

        start_str = best_window[0].TargetFromTime.strftime("%H:%M")
        end_str = best_window[-1].TargetToTime.strftime("%H:%M")
        advice = (
            f"Nên cắm sạc trong khung {start_str} - {end_str} UTC "
            f"(cường độ trung bình {optimal_avg} gCO2/kWh) để giảm {saving_percent}% phát thải, "
            f"tiết kiệm {co2_saved_kg} kg CO2 cho pin {battery_kwh} kWh."
        )

        slot_details = [
            TimeSlotDetail(
                from_time=s.TargetFromTime,
                to_time=s.TargetToTime,
                predicted_intensity=s.PredictedIntensity,
                predicted_class=s.PredictedClass,
            )
            for s in predictions
        ]

        return EvRecommendationResponse(
            region_scope="Toàn quốc (Great Britain)",
            target_date=target_date,
            duration_hours=duration_hours,
            battery_kwh=battery_kwh,
            optimal_start_time=best_window[0].TargetFromTime,
            optimal_end_time=best_window[-1].TargetToTime,
            optimal_avg_intensity=optimal_avg,
            peak_start_time=worst_window[0].TargetFromTime,
            peak_end_time=worst_window[-1].TargetToTime,
            peak_avg_intensity=peak_avg,
            co2_saved_kg=co2_saved_kg,
            saving_percent=saving_percent,
            advice_summary=advice,
            slots=slot_details,
        )
