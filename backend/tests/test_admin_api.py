import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from cauHinh.ketNoiDb import Base
import cauHinh.ketNoiDb as database
import dichVu.dichVuCanhBao as alerts
import dichVu.dichVuCaoDuLieu as collector
from dichVu.ingestion_cli import _ma_kich_hoat, _phan_tich_tham_so
import main
from moHinhDl import DuLieuKhuVuc, GenerationMix, LuotThuThap, SoLieuCarbon


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
        self.assertEqual(status.json()["monitoring"]["state"], "never_succeeded")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json(), {"items": []})

    def test_quality_endpoint_reports_missing_core_and_alert_tables(self):
        response = self.client.get("/api/v1/admin/quality")

        self.assertEqual(response.status_code, 200)
        quality = response.json()
        self.assertEqual(quality["quality_state"], "warning")
        self.assertIn("missing_national_data", [warning["code"] for warning in quality["warnings"]])
        self.assertFalse(quality["alerts_table_available"])
        self.assertEqual(quality["alert_rules"]["absolute_threshold_gco2_per_kwh"], 250)
        self.assertEqual(quality["alert_rules"]["change_percent"], 30)
        self.assertEqual(quality["alert_rules"]["window_hours"], 24)

    def test_quality_endpoint_reads_existing_alert_table_without_assuming_its_model(self):
        db = self.sessions()
        db.execute(
            text(
                'CREATE TABLE "SYS_CARBON_ALERTS" '
                '("AlertId" INTEGER PRIMARY KEY, "CreatedAt" TEXT, "Message" TEXT)'
            )
        )
        db.execute(
            text(
                'INSERT INTO "SYS_CARBON_ALERTS" ("AlertId", "CreatedAt", "Message") '
                "VALUES (1, '2026-11-19T12:00:00Z', 'High carbon intensity')"
            )
        )
        db.commit()
        db.close()

        quality = self.client.get("/api/v1/admin/quality").json()

        self.assertTrue(quality["alerts_table_available"])
        self.assertEqual(quality["alerts"][0]["Message"], "High carbon intensity")

    def test_monitoring_recognizes_success_and_stale_runs(self):
        db = self.sessions()
        started = datetime.now(timezone.utc) - timedelta(hours=2)
        db.add(
            LuotThuThap(
                nguoi_kich_hoat="github-schedule-collect",
                trang_thai="SUCCESS",
                bat_dau_luc=started,
                ket_thuc_luc=started + timedelta(seconds=5),
                so_ban_ghi_them=10,
                so_ban_ghi_cap_nhat=7,
            )
        )
        db.commit()
        db.close()

        status = self.client.get("/api/v1/admin/status").json()

        self.assertEqual(status["status"], "SUCCESS")
        self.assertEqual(status["monitoring"]["state"], "delayed")
        self.assertEqual(status["records_inserted"], 10)
        self.assertEqual(status["records_updated"], 7)

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

class CarbonCollectorTests(unittest.TestCase):
    def test_ingestion_trigger_names_fit_database_column_limit(self):
        column_limit = LuotThuThap.__table__.c.TriggeredBy.type.length

        for source in ("schedule", "dispatch"):
            for mode in ("collect", "backfill"):
                with self.subTest(source=source, mode=mode):
                    self.assertLessEqual(
                        len(_ma_kich_hoat(source, mode)),
                        column_limit,
                    )

    def test_backfill_cli_treats_end_date_as_inclusive(self):
        arguments = _phan_tich_tham_so(
            [
                "--mode",
                "backfill",
                "--start-date",
                "2026-01-01",
                "--end-date",
                "2026-01-01",
            ]
        )

        self.assertEqual(arguments.end_exclusive - arguments.start_date, timedelta(days=1))

    def test_alert_is_created_once_for_a_30_percent_jump_from_the_prior_day(self):
        engine = _tao_engine()
        Base.metadata.create_all(bind=engine)
        session = sessionmaker(bind=engine)()
        session.execute(
            text(
                'CREATE TABLE "SYS_CARBON_ALERTS" ('
                '"AlertId" INTEGER PRIMARY KEY AUTOINCREMENT, '
                '"ReadingId" INTEGER NOT NULL, '
                '"AlertTime" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, '
                '"ThresholdLimit" INTEGER NOT NULL, '
                '"ExceededValue" INTEGER NOT NULL, '
                '"Severity" VARCHAR(15) NOT NULL, '
                '"CauseFuel" VARCHAR(50), '
                '"IsDismissed" BOOLEAN NOT NULL DEFAULT 0)'
            )
        )
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        session.add(DuLieuKhuVuc(ma_vung=0, ten_vung="GB", ten_day_du="Great Britain"))
        for index in range(48):
            from_time = start + timedelta(minutes=30 * index)
            session.add(
                SoLieuCarbon(
                    ma_vung=0,
                    thoi_gian=from_time,
                    den_thoi_gian=from_time + timedelta(minutes=30),
                    cuong_do_du_bao=100,
                    cuong_do_thuc_te=100,
                    muc_do="low",
                    gio=from_time.hour,
                    thu_trong_tuan=from_time.weekday(),
                    thang=from_time.month,
                )
            )
        session.flush()
        alert_time = start + timedelta(days=1)
        current = SoLieuCarbon(
            ma_vung=0,
            thoi_gian=alert_time,
            den_thoi_gian=alert_time + timedelta(minutes=30),
            cuong_do_du_bao=140,
            cuong_do_thuc_te=140,
            muc_do="moderate",
            gio=alert_time.hour,
            thu_trong_tuan=alert_time.weekday(),
            thang=alert_time.month,
        )
        session.add(current)
        session.flush()
        high_time = alert_time + timedelta(minutes=30)
        high_reading = SoLieuCarbon(
            ma_vung=0,
            thoi_gian=high_time,
            den_thoi_gian=high_time + timedelta(minutes=30),
            cuong_do_du_bao=300,
            cuong_do_thuc_te=300,
            muc_do="high",
            gio=high_time.hour,
            thu_trong_tuan=high_time.weekday(),
            thang=high_time.month,
        )
        session.add(high_reading)
        session.flush()
        self.assertNotEqual(current.id, high_reading.id)
        current_id = current.id
        high_reading_id = high_reading.id

        try:
            with patch.object(alerts, "CARBON_ALERT_THRESHOLD", 250), patch.object(
                alerts, "CARBON_ALERT_CHANGE_PERCENT", 30
            ), patch.object(alerts, "CARBON_ALERT_WINDOW_HOURS", 24):
                alerts.kiem_tra_canh_bao_cuong_do(session, current)
                alerts.kiem_tra_canh_bao_cuong_do(session, current)
                self.assertEqual(
                    session.execute(
                        text('SELECT "AlertId", "ReadingId" FROM "SYS_CARBON_ALERTS"')
                    ).all(),
                    [(1, current_id)],
                )
                alerts.kiem_tra_canh_bao_cuong_do(session, high_reading)
                alerts.kiem_tra_canh_bao_cuong_do(session, high_reading)
            session.commit()
            stored = session.execute(
                text(
                    'SELECT "ReadingId", "ThresholdLimit", "ExceededValue", "Severity" '
                    'FROM "SYS_CARBON_ALERTS" ORDER BY "AlertId"'
                )
            ).all()
            self.assertEqual(
                stored,
                [
                    (current_id, 130, 140, "MEDIUM"),
                    (high_reading_id, 250, 300, "HIGH"),
                ],
            )
        finally:
            session.close()
            engine.dispose()

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
                                "regionid": region_id,
                                "shortname": f"Region {region_id}",
                                "name": f"Region {region_id}",
                                "intensity": {"forecast": 90, "index": "low"},
                            }
                            for region_id in range(1, 18)
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

                self.assertEqual((first_result.inserted, first_result.updated), (18, 0))
                self.assertEqual((second_result.inserted, second_result.updated), (0, 18))
                self.assertEqual(len(national_rows), 1)
                self.assertEqual(national_rows[0].cuong_do, 104)
                self.assertEqual(national_rows[0].generation_mix.clean_total, 60)
                self.assertEqual(len(regional_rows), 1)
                self.assertEqual(regional_rows[0].cuong_do, 90)
                self.assertEqual([row.ma_vung for row in regions], list(range(18)))
                self.assertEqual(generation_mix.reading_id, national_rows[0].id)
        finally:
            session.close()
            engine.dispose()

    def test_historical_collection_uses_supported_routes_and_upserts_by_period(self):
        requests = []

        def responder(request):
            path = unquote(request.url.path).strip("/").split("/")
            requests.append(request.url.path)
            if path[0] == "regional":
                from_time, to_time = path[2], path[3]
                return httpx.Response(
                    200,
                    json={
                        "data": [
                            {
                                "from": from_time,
                                "to": to_time,
                                "regions": [
                                    *[
                                        {
                                            "regionid": region_id,
                                            "shortname": f"Region {region_id}",
                                            "name": f"Region {region_id}",
                                            "intensity": {"forecast": 90, "index": "low"},
                                        }
                                        for region_id in range(1, 18)
                                    ],
                                    {
                                        "regionid": 18,
                                        "shortname": "GB",
                                        "name": "Great Britain",
                                        "intensity": {"forecast": 90, "index": "low"},
                                    },
                                ],
                            }
                        ]
                    },
                )

            from_time, to_time = path[1], path[2]
            if path[0] == "generation":
                return httpx.Response(
                    200,
                    json={
                        "data": [
                            {
                                "from": from_time,
                                "generationmix": [
                                    {"fuel": "wind", "perc": 30},
                                    {"fuel": "gas", "perc": 40},
                                    {"fuel": "nuclear", "perc": 30},
                                ],
                            }
                        ]
                    },
                )
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "from": from_time,
                            "to": to_time,
                            "intensity": {"actual": 104, "forecast": 110, "index": "low"},
                        }
                    ]
                },
            )

        engine = _tao_engine()
        Base.metadata.create_all(bind=engine)
        session = sessionmaker(bind=engine)()
        transport = httpx.MockTransport(responder)
        async_client = httpx.AsyncClient

        def client_factory(**kwargs):
            kwargs["transport"] = transport
            return async_client(**kwargs)

        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        end = start + timedelta(days=15)
        try:
            with patch.object(collector, "CARBON_API_BASE_URL", "https://carbon.test"), patch.object(
                collector.httpx, "AsyncClient", client_factory
            ):
                first = asyncio.run(collector.thu_thap_khoang_thoi_gian(session, start, end))
                second = asyncio.run(collector.thu_thap_khoang_thoi_gian(session, start, end))

            self.assertEqual((first.inserted, first.updated), (36, 0))
            self.assertEqual((second.inserted, second.updated), (0, 36))
            self.assertEqual(session.query(SoLieuCarbon).count(), 36)
            self.assertEqual(
                session.query(SoLieuCarbon).filter(SoLieuCarbon.ma_vung == 18).count(),
                0,
            )
            self.assertEqual(
                session.query(GenerationMix).count(),
                2,
            )
            self.assertEqual(
                len([path for path in requests if path.startswith("/regional/intensity/")]),
                4,
            )
        finally:
            session.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
