"""
Sistem Informasi Rute Angkutan Umum Pekanbaru (Trans Metro Pekanbaru)
Backend REST API — FastAPI synchronous + PostGIS (raw SQL via SQLAlchemy text()).

Mode lokal: seeder dipanggil otomatis saat startup bila tabel kosong.
Mode serverless (Vercel): seeder TIDAK dipanggil saat startup (cold start tidak
boleh berat). Gunakan endpoint POST /api/v1/admin/seed sekali untuk inisialisasi.

Kelompok 1 SIG ITERA 2026.
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import halte, rute, trip
from .seeder import reseed_all, run_seeders

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")

IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    if IS_SERVERLESS:
        logger.info("Lingkungan serverless terdeteksi — skip auto-seeder.")
    else:
        logger.info("Menjalankan auto-seeder GeoJSON...")
        try:
            result = run_seeders()
            logger.info("Auto-seeder selesai: %s", result)
        except Exception as e:
            logger.warning("Auto-seeder gagal (bisa diabaikan jika DB kosong): %s", e)
    yield
    logger.info("Shutdown FastAPI.")


app = FastAPI(
    title="WebGIS Trans Metro Pekanbaru API",
    description=(
        "REST API spasial untuk Sistem Informasi Rute Angkutan Umum Pekanbaru. "
        "CRUD halte + rute, query spasial ST_DWithin/ST_Distance pada PostGIS."
    ),
    version="2.1.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Halte", "description": "CRUD halte + pencarian radius (ST_DWithin)"},
        {"name": "Rute",  "description": "CRUD rute trayek (LineString) + GeoJSON"},
        {"name": "Admin", "description": "Manual seeder untuk deployment serverless"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(halte.router)
app.include_router(rute.router)
app.include_router(trip.router)


@app.get("/", tags=["Meta"])
def root():
    return {"app": "WebGIS Trans Metro Pekanbaru", "version": "2.1.0", "docs": "/docs"}


@app.get("/health", tags=["Meta"])
@app.get("/api/v1/health", tags=["Meta"])
def health():
    return {"status": "ok", "serverless": IS_SERVERLESS}


@app.post("/api/v1/admin/seed", tags=["Admin"])
def admin_seed(x_admin_token: str = Header(default="")):
    """One-time seeder untuk deployment serverless. Lindungi dengan
    env var ADMIN_TOKEN (header `X-Admin-Token` harus cocok)."""
    expected = os.environ.get("ADMIN_TOKEN", "")
    if not expected:
        raise HTTPException(503, "ADMIN_TOKEN belum diset di environment variable.")
    if x_admin_token != expected:
        raise HTTPException(401, "Token admin tidak valid.")
    return run_seeders()


@app.post("/api/v1/admin/reseed", tags=["Admin"])
def admin_reseed(x_admin_token: str = Header(default="")):
    """TRUNCATE + reseed dari GeoJSON. Hanya untuk reset state."""
    expected = os.environ.get("ADMIN_TOKEN", "")
    if not expected:
        raise HTTPException(503, "ADMIN_TOKEN belum diset di environment variable.")
    if x_admin_token != expected:
        raise HTTPException(401, "Token admin tidak valid.")
    return reseed_all()
