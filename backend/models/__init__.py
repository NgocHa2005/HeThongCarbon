from models.dim_kmeans_cluster import DimKmeansCluster
from models.dim_region import DimRegion
from models.fact_carbon_reading import FactCarbonReading
from models.fact_daily_cluster import FactDailyCluster
from models.fact_generation_mix import FactGenerationMix
from models.fact_ml_prediction import FactMlPrediction
from models.sys_carbon_alert import SysCarbonAlert
from models.sys_clustering_run import SysClusteringRun
from models.sys_ingestion_run import SysIngestionRun
from models.agg_decomposition_resample import AggDecompositionResample


# Keep the previous model names available while services migrate to the
# canonical schema model names.
DuLieuKhuVuc = DimRegion
GenerationMix = FactGenerationMix
SoLieuCarbon = FactCarbonReading
LuotThuThap = SysIngestionRun

__all__ = [
    "DimKmeansCluster",
    "DimRegion",
    "DuLieuKhuVuc",
    "FactCarbonReading",
    "FactDailyCluster",
    "GenerationMix",
    "FactGenerationMix",
    "FactMlPrediction",
    "LuotThuThap",
    "SoLieuCarbon",
    "SysCarbonAlert",
    "SysClusteringRun",
    "SysIngestionRun",
    "AggDecompositionResample",
]
