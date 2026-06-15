"""
Database engine.

Local: pakai default pooling SQLAlchemy.
Serverless (Vercel): pakai NullPool — tiap invocation membuka koneksi baru ke
Supabase Pooler (mode Transaction, port 6543). Pooling diserahkan ke pgBouncer
sehingga tidak ada koneksi nyangkut antar cold-start.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from .config import settings

IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

if IS_SERVERLESS:
    # Supabase pooler: pgBouncer transaction mode — gunakan NullPool.
    # psycopg2-binary tidak perlu prepare_threshold (itu khusus psycopg3).
    engine = create_engine(
        settings.database_url,
        poolclass=NullPool,
        future=True,
    )
else:
    engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
