import os

from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./carbon.db")
engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def khoi_tao_database():
    if not DATABASE_URL.startswith("mssql"):
        return
    database_name = make_url(DATABASE_URL).database or "CarbonGreatBritain"
    safe_database_name = database_name.replace("]", "]]")
    safe_database_literal = database_name.replace("'", "''")
    master_engine = create_engine(make_url(DATABASE_URL).set(database="master"), pool_pre_ping=True)
    try:
        with master_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
            connection.execute(text(
                f"IF DB_ID(N'{safe_database_literal}') IS NULL "
                f"CREATE DATABASE [{safe_database_name}]"
            ))
    finally:
        master_engine.dispose()


def lay_phien_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
