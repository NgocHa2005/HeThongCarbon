from datetime import UTC, datetime, timedelta

import pandas as pd
from fastapi import HTTPException
from models.fact_carbon_reading import FactCarbonReading
from models.fact_generation_mix import FactGenerationMix
from schemas.nang_luong_schema import (
    CorrelationHeatmapResponse,
    FuelMixItem,
    GenerationMixResponse,
)
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload


class NangLuongService:
    def __init__(self, db: Session):
        self.db = db

    def get_current_generation_mix(self) -> GenerationMixResponse:
        # 1. Truy vấn bản ghi toàn quốc (RegionId = 0) mới nhất kèm bảng GenerationMix
        stmt = (
            select(FactCarbonReading)
            .options(joinedload(FactCarbonReading.generation_mix))
            .where(FactCarbonReading.RegionId == 0)
            .order_by(desc(FactCarbonReading.FromTime))
            .limit(1)
        )
        latest_reading = self.db.execute(stmt).scalar_one_or_none()

        if not latest_reading or not latest_reading.generation_mix:
            raise HTTPException(
                status_code=404,
                detail="Chưa có dữ liệu cơ cấu nguồn điện trên hệ thống.",
            )

        mix = latest_reading.generation_mix

        # 2. Ép kiểu Decimal sang float và tính phần bù nguồn khác (Other) để tổng đủ 100%
        wind = float(mix.WindPerc)
        solar = float(mix.SolarPerc)
        nuclear = float(mix.NuclearPerc)
        hydro = float(mix.HydroPerc)
        biomass = float(mix.BiomassPerc)
        gas = float(mix.GasPerc)
        coal = float(mix.CoalPerc)
        imports = float(mix.ImportsPerc)

        sum_8_fuels = wind + solar + nuclear + hydro + biomass + gas + coal + imports
        other = max(0.0, round(100.0 - sum_8_fuels, 2))

        fuels = [
            FuelMixItem(
                fuel_key="gas",
                fuel_name="Khí tự nhiên (Gas)",
                percentage=gas,
                category="fossil",
            ),
            FuelMixItem(
                fuel_key="wind",
                fuel_name="Điện Gió (Wind)",
                percentage=wind,
                category="clean",
            ),
            FuelMixItem(
                fuel_key="nuclear",
                fuel_name="Điện Hạt nhân (Nuclear)",
                percentage=nuclear,
                category="clean",
            ),
            FuelMixItem(
                fuel_key="imports",
                fuel_name="Nhập khẩu (Imports)",
                percentage=imports,
                category="imports",
            ),
            FuelMixItem(
                fuel_key="biomass",
                fuel_name="Sinh khối (Biomass)",
                percentage=biomass,
                category="clean",
            ),
            FuelMixItem(
                fuel_key="solar",
                fuel_name="Mặt trời (Solar)",
                percentage=solar,
                category="clean",
            ),
            FuelMixItem(
                fuel_key="hydro",
                fuel_name="Thủy điện (Hydro)",
                percentage=hydro,
                category="clean",
            ),
            FuelMixItem(
                fuel_key="coal",
                fuel_name="Than đá (Coal)",
                percentage=coal,
                category="fossil",
            ),
        ]
        if other > 0:
            fuels.append(
                FuelMixItem(
                    fuel_key="other",
                    fuel_name="Nguồn khác (Other)",
                    percentage=other,
                    category="fossil",
                )
            )

        # Sắp xếp giảm dần theo tỷ trọng 
        fuels.sort(key=lambda item: item.percentage, reverse=True)

        return GenerationMixResponse(
            from_time=latest_reading.FromTime,
            to_time=latest_reading.ToTime,
            intensity_actual=latest_reading.IntensityActual,
            intensity_forecast=latest_reading.IntensityForecast,
            clean_total_perc=float(mix.CleanTotalPerc),
            fossil_total_perc=float(mix.FossilTotalPerc),
            imports_perc=imports,
            fuels=fuels,
        )
    # ma trận tương quan
    def get_correlation_heatmap(self, days: int = 30) -> CorrelationHeatmapResponse:
        # 1. Tính mốc thời gian bắt đầu truy vấn (UTC)
        cutoff_time = datetime.now(UTC) - timedelta(days=days)

        # 2. JOIN bảng Carbon và GenerationMix, ưu tiên lấy IntensityActual nếu có
        carbon_col = func.coalesce(
            FactCarbonReading.IntensityActual, FactCarbonReading.IntensityForecast
        ).label("Carbon")

        stmt = (
            select(
                carbon_col,
                FactGenerationMix.WindPerc.label("Wind"),
                FactGenerationMix.SolarPerc.label("Solar"),
                FactGenerationMix.NuclearPerc.label("Nuclear"),
                FactGenerationMix.HydroPerc.label("Hydro"),
                FactGenerationMix.GasPerc.label("Gas"),
                FactGenerationMix.CoalPerc.label("Coal"),
                FactGenerationMix.BiomassPerc.label("Biomass"),
                FactGenerationMix.ImportsPerc.label("Imports"),
            )
            .join(
                FactGenerationMix,
                FactCarbonReading.ReadingId == FactGenerationMix.ReadingId,
            )
            .where(
                FactCarbonReading.RegionId == 0,
                FactCarbonReading.FromTime >= cutoff_time,
            )
        )

        rows = self.db.execute(stmt).all()
        if len(rows) < 5:
            raise HTTPException(
                status_code=400,
                detail=f"Không đủ mẫu dữ liệu trong {days} ngày qua để tính tương quan (cần ít nhất 5 mẫu).",
            )

        # 3. Đưa vào Pandas DataFrame và ép toàn bộ sang float (tránh lỗi kiểu Decimal)
        columns = [
            "Carbon",
            "Wind",
            "Solar",
            "Nuclear",
            "Hydro",
            "Gas",
            "Coal",
            "Biomass",
            "Imports",
        ]
        df = pd.DataFrame(rows, columns=columns).astype(float)

        # 4. Tính ma trận tương quan Pearson; fillna(0.0) để xử lý cột bằng 0 suốt kỳ (như Coal)
        corr_matrix = df.corr(method="pearson").fillna(0.0).round(2)

        # 5. Chuyển đổi sang mảng tọa độ [x, y, value] cho biểu đồ Heatmap Frontend
        labels_vi = [
            "Carbon",
            "Gió",
            "Mặt trời",
            "Hạt nhân",
            "Thủy điện",
            "Khí đốt",
            "Than đá",
            "Sinh khối",
            "Nhập khẩu",
        ]
        matrix_data: list[list[float | int]] = []
        for y_idx in range(len(columns)):
            for x_idx in range(len(columns)):
                val = float(corr_matrix.iloc[y_idx, x_idx])
                matrix_data.append([x_idx, y_idx, val])

        # 6. Rút trích tự động nguồn kéo giảm và kéo tăng Carbon mạnh nhất
        carbon_series = corr_matrix["Carbon"].drop("Carbon")
        min_fuel_key = str(carbon_series.idxmin())
        max_fuel_key = str(carbon_series.idxmax())
        min_val = float(carbon_series[min_fuel_key])
        max_val = float(carbon_series[max_fuel_key])

        fuel_vi_map = dict(zip(columns, labels_vi))
        neg_name = fuel_vi_map[min_fuel_key]
        pos_name = fuel_vi_map[max_fuel_key]

        insight = (
            f"Trong {days} ngày qua ({len(rows)} chu kỳ đo), {neg_name} là yếu tố kéo giảm "
            f"phát thải mạnh nhất (r = {min_val}), trong khi {pos_name} là tác nhân chính "
            f"đẩy cường độ carbon tăng cao (r = +{max_val})."
        )

        return CorrelationHeatmapResponse(
            days_analyzed=days,
            total_samples=len(rows),
            labels=labels_vi,
            matrix_data=matrix_data,
            strongest_negative_driver=f"{neg_name} ({min_val})",
            strongest_positive_driver=f"{pos_name} (+{max_val})",
            insight_summary=insight,
        )
