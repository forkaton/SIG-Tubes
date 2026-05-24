"""
Sistem Informasi Rute Angkutan Umum Pekanbaru (Trans Metro Pekanbaru)
Backend REST API — FastAPI synchronous + PostGIS (raw SQL via SQLAlchemy text()).

Saat startup, seeder otomatis memuat data awal dari
backend/data/rute.geojson dan backend/data/halte.geojson
ke PostGIS jika tabel masih kosong.

Kelompok 1 SIG ITERA 2026.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import halte, rute
from .seeder import run_seeders

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Menjalankan auto-seeder GeoJSON...")
    result = run_seeders()
    logger.info("Auto-seeder selesai: %s", result)
    yield
    logger.info("Shutdown FastAPI.")


app = FastAPI(
    title="WebGIS Trans Metro Pekanbaru API",
    description=(
        "REST API spasial untuk Sistem Informasi Rute Angkutan Umum Pekanbaru. "
        "CRUD halte + rute, query spasial ST_DWithin/ST_Distance pada PostGIS, "
        "auto-seed dari berkas GeoJSON saat startup."
    ),
    version="2.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Halte", "description": "CRUD halte + pencarian radius (ST_DWithin)"},
        {"name": "Rute",  "description": "CRUD rute trayek (LineString) + GeoJSON"},
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


@app.get("/", tags=["Meta"])
def root():
    return {"app": "WebGIS Trans Metro Pekanbaru", "version": "2.0.0", "docs": "/docs"}


@app.get("/health", tags=["Meta"])
def health():
    return {"status": "ok"}
