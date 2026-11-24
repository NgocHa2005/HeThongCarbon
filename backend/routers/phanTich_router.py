from __future__ import annotations

import datetime

from config.database import lay_phien_db
from fastapi import APIRouter, Depends, HTTPException, Query
from schemas.aiMl_schema import (
    ClusteringOverviewResponse,
    ClusteringRunSchema,
    DailyClusterSchema,
    KmeansClusterSchema,
)
from services.phanCum_service import (
    get_active_clustering_run,
    get_clustering_overview,
    get_clusters_by_run,
    get_daily_clusters,
)
from sqlalchemy.orm import Session

router = APIRouter(prefix="/phan-tich", tags=["Phân tích & Phân cụm"])


@router.get("/phan-cum/tong-quan", response_model=ClusteringOverviewResponse)
def doc_tong_quan_phan_cum(
    start_date: datetime.date | None = Query(default=None),
    end_date: datetime.date | None = Query(default=None),
    cluster_id: int | None = Query(default=None),
    db: Session = Depends(lay_phien_db),
):
    data = get_clustering_overview(
        db=db,
        start_date=start_date,
        end_date=end_date,
        cluster_id=cluster_id,
    )
    if data is None:
        raise HTTPException(
            status_code=404,
            detail="Chưa có lần chạy phân cụm nào đang hoạt động.",
        )
    return data


@router.get("/phan-cum/cum", response_model=list[KmeansClusterSchema])
def doc_danh_sach_cum(db: Session = Depends(lay_phien_db)):
    active_run = get_active_clustering_run(db)
    if active_run is None:
        raise HTTPException(
            status_code=404,
            detail="Chưa có lần chạy phân cụm nào đang hoạt động.",
        )
    return get_clusters_by_run(db, active_run.ClusteringRunId)


@router.get("/phan-cum/ngay", response_model=list[DailyClusterSchema])
def doc_danh_sach_ngay_phan_cum(
    start_date: datetime.date | None = Query(default=None),
    end_date: datetime.date | None = Query(default=None),
    cluster_id: int | None = Query(default=None),
    db: Session = Depends(lay_phien_db),
):
    active_run = get_active_clustering_run(db)
    if active_run is None:
        raise HTTPException(
            status_code=404,
            detail="Chưa có lần chạy phân cụm nào đang hoạt động.",
        )
    return get_daily_clusters(
        db=db,
        clustering_run_id=active_run.ClusteringRunId,
        start_date=start_date,
        end_date=end_date,
        cluster_id=cluster_id,
    )


@router.get("/phan-cum/lan-chay-hien-tai", response_model=ClusteringRunSchema)
def doc_lan_chay_hien_tai(db: Session = Depends(lay_phien_db)):
    active_run = get_active_clustering_run(db)
    if active_code := (active_run is None):
        raise HTTPException(
            status_code=404,
            detail="Chưa có lần chạy phân cụm nào đang hoạt động.",
        )
    return active_run
