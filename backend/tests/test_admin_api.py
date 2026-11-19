import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from cauHinh.ketNoiDb import Base
import cauHinh.ketNoiDb as database
import dichVu.dichVuCaoDuLieu as collector
import main
from dinhTuyen import tuyenQuanTri
from moHinhDl import DuLieuKhuVuc, GenerationMix, SoLieuCarbon


def _tao_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


class AdminApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = _tao_engine()
        Base.metadata.create_all(bind=self.engine)
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.patches = [
            patch.object(database, "engine", self.engine),
            patch.object(database, "SessionLocal", self.sessions),
            patch.object(main, "engine", self.engine),
            patch.object(main, "SessionLocal", self.sessions),
        ]
        for item in self.patches:
            item.start()
        self.client = TestClient(main.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        for item in reversed(self.patches):
            item.stop()
        self.engine.dispose()

    def test_status_and_history_are_available_without_a_job(self):
        status = self.client.get("/api/v1/admin/status")
        history = self.client.get("/api/v1/admin/history")

        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.json()["status"], "idle")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json(), {"items": []})

    def test_public_data_endpoints_handle_an_empty_database(self):
        self.assertEqual(self.client.get("/api/v1/carbon/latest").json(), {"data": None})
        self.assertEqual(self.client.get("/api/v1/carbon/history").json(), {"items": []})
        self.assertEqual(self.client.get("/api/v1/regions").json(), {"items": []})
        self.assertEqual(self.client.get("/api/v1/analysis/forecast").status_code, 404)

    def test_public_endpoints_separate_national_and_regional_readings(self):
        now = datetime.now(timezone.utc)
        db = self.sessions()
        national_reading = SoLieuCarbon(
            ma_vung=0,
            thoi_gian=now,
            den_thoi_gian=now + timedelta(minutes=30),
            cuong_do_du_bao=110,
            cuong_do_thuc_te=104,
            muc_do="low",
            gio=now.hour,
            thu_trong_tuan=now.weekday(),
            thang=now.month,
        )
        db.add_all(
            [
                DuLieuKhuVuc(ma_vung=0, ten_vung="GB", ten_day_du="Great Britain"),
                DuLieuKhuVuc(ma_vung=1, ten_vung="North", ten_day_du="North Region"),
                national_reading,
                SoLieuCarbon(
                    ma_vung=1,
                    thoi_gian=now,
                    den_thoi_gian=now + timedelta(minutes=30),
                    cuong_do_du_bao=90,
                    cuong_do_thuc_te=None,
                    muc_do="low",
                    gio=now.hour,
                    thu_trong_tuan=now.weekday(),
                    thang=now.month,
                ),
            ]
        )
        db.flush()
        db.add(
            GenerationMix(
                reading_id=national_reading.id,
                wind=30,
                solar=10,
                nuclear=20,
                hydro=0,
                gas=40,
                coal=0,
                biomass=0,
                imports=0,
                clean_total=60,
                fossil_total=40,
            )
        )
        db.commit()
        db.close()

        latest = self.client.get("/api/v1/carbon/latest").json()["data"]
        regions = self.client.get("/api/v1/regions").json()["items"]

        self.assertEqual(latest["cuong_do"], 104)
        self.assertEqual(latest["tai_tao"], 40)
        self.assertEqual([row["ma_vung"] for row in regions], [1])
        self.assertEqual(regions[0]["cuong_do"], 90)

    def test_collect_creates_a_completed_job_and_history_entry(self):
        async def fake_collect(db, update_stage=None):
            if update_stage:
                update_stage("database")
            return collector.KetQuaThuThap(inserted=4, updated=0)

        with patch.object(tuyenQuanTri, "thu_thap_du_lieu", fake_collect):
            response = self.client.post("/api/v1/admin/collect")

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "queued")
        status = self.client.get("/api/v1/admin/status").json()
        history = self.client.get("/api/v1/admin/history").json()["items"]
        self.assertEqual(status["status"], "succeeded")
        self.assertEqual(status["records_processed"], 4)
        self.assertEqual(len(history), 1)


class CarbonCollectorTests(unittest.TestCase):
    def test_collection_writes_orm_compatible_rows_and_upserts_duplicates(self):
        responses = {
            "/intensity": {
                "data": [
                    {
                        "from": "2026-11-13T00:00Z",
                        "to": "2026-11-13T00:30Z",
                        "intensity": {"actual": 104, "forecast": 110, "index": "low"},
                    }
                ]
            },
            "/generation": {
                "data": {
                    "generationmix": [
                        {"fuel": "wind", "perc": 30},
                        {"fuel": "solar", "perc": 10},
                        {"fuel": "gas", "perc": 40},
                        {"fuel": "nuclear", "perc": 20},
                    ]
                }
            },
            "/regional": {
                "data": [
                    {
                        "from": "2026-11-13T00:00Z",
                        "to": "2026-11-13T00:30Z",
                        "regions": [
                            {
                                "regionid": 1,
                                "shortname": "North",
                                "name": "North Region",
                                "intensity": {"forecast": 90, "index": "low"},
                            }
                        ]
                    }
                ]
            },
        }

        def responder(request):
            return httpx.Response(200, json=responses[request.url.path])

        engine = _tao_engine()
        Base.metadata.create_all(bind=engine)
        session = sessionmaker(bind=engine)()
        transport = httpx.MockTransport(responder)
        async_client = httpx.AsyncClient

        def client_factory(**kwargs):
            kwargs["transport"] = transport
            return async_client(**kwargs)

        try:
            with patch.object(collector, "CARBON_API_BASE_URL", "https://carbon.test"), patch.object(
                collector.httpx, "AsyncClient", client_factory
            ):
                first_result = asyncio.run(collector.thu_thap_du_lieu(session))
                second_result = asyncio.run(collector.thu_thap_du_lieu(session))

                national_rows = (
                    session.query(SoLieuCarbon)
                    .filter(SoLieuCarbon.ma_vung == 0)
                    .all()
                )
                regional_rows = (
                    session.query(SoLieuCarbon)
                    .filter(SoLieuCarbon.ma_vung == 1)
                    .all()
                )
                regions = session.query(DuLieuKhuVuc).order_by(DuLieuKhuVuc.ma_vung).all()
                generation_mix = session.query(GenerationMix).one()

                self.assertEqual((first_result.inserted, first_result.updated), (2, 0))
                self.assertEqual((second_result.inserted, second_result.updated), (0, 2))
                self.assertEqual(len(national_rows), 1)
                self.assertEqual(national_rows[0].cuong_do, 104)
                self.assertEqual(national_rows[0].generation_mix.clean_total, 60)
                self.assertEqual(len(regional_rows), 1)
                self.assertEqual(regional_rows[0].cuong_do, 90)
                self.assertEqual([(row.ma_vung, row.ten_vung) for row in regions], [(0, "GB"), (1, "North")])
                self.assertEqual(generation_mix.reading_id, national_rows[0].id)
        finally:
            session.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
