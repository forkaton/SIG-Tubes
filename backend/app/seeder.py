"""
Auto-seed PostGIS dari berkas GeoJSON di backend/data/.

Saat seeding rute, koordinat waypoint dari rute.geojson dikirim ke OSRM
(https://router.project-osrm.org) untuk **snap-to-road** — geometri yang
disimpan ke database mengikuti jalan raya valid, bukan garis lurus.

Jika OSRM tidak tersedia / gagal, fallback ke geometri waypoint mentah
agar seeding tetap berjalan.

Idempoten: hanya seed tabel yang masih kosong.
"""
from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import SessionLocal

logger = logging.getLogger("seeder")

DATA_DIR   = Path(__file__).resolve().parent.parent / "data"
RUTE_FILE  = DATA_DIR / "rute.geojson"
HALTE_FILE = DATA_DIR / "halte.geojson"

OSRM_BASE  = "https://router.project-osrm.org/route/v1/driving"


# ---------------------------------------------------------------------------
def _load_geojson(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        logger.warning("Berkas GeoJSON tidak ditemukan: %s", path)
        return []
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    return data.get("features", [])


def osrm_snap_to_road(coordinates: list[list[float]], timeout: int = 25) -> dict | None:
    """
    Kirim list koordinat [[lng,lat], ...] sebagai waypoint ke OSRM public API.
    Mengembalikan GeoJSON LineString yang sudah snap-to-road, atau None bila gagal.
    """
    if len(coordinates) < 2:
        return None
    coord_str = ";".join(f"{lng},{lat}" for lng, lat in coordinates)
    url = f"{OSRM_BASE}/{coord_str}?overview=full&geometries=geojson"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "WebGIS-TMP-Pekanbaru/2.1"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if not data.get("routes"):
            logger.warning("OSRM: tidak ada rute untuk %d waypoint", len(coordinates))
            return None
        return data["routes"][0]["geometry"]
    except urllib.error.URLError as e:
        logger.warning("OSRM URLError: %s", e)
    except Exception as e:
        logger.warning("OSRM exception: %s", e)
    return None


# ---------------------------------------------------------------------------
def _seed_rute(db: Session) -> int:
    """Insert seluruh rute dari rute.geojson — pakai OSRM snap-to-road bila bisa."""
    count = db.execute(text("SELECT COUNT(*) FROM rute_trayek")).scalar()
    if count and count > 0:
        logger.info("rute_trayek sudah berisi %s baris — skip seeding rute.", count)
        return 0

    features = _load_geojson(RUTE_FILE)
    if not features:
        return 0

    inserted = 0
    for idx, feat in enumerate(features, start=1):
        props    = feat.get("properties", {})
        raw_geom = feat.get("geometry")
        if not raw_geom or raw_geom.get("type") != "LineString":
            continue

        kode = props.get("kode_trayek", "?")
        logger.info("[%d/%d] Snap-to-road %s via OSRM (%d waypoint)...",
                    idx, len(features), kode, len(raw_geom["coordinates"]))

        snapped = osrm_snap_to_road(raw_geom["coordinates"])
        if snapped:
            logger.info("       OK · %d titik geometri terhasil",
                        len(snapped["coordinates"]))
        else:
            logger.warning("       OSRM gagal — fallback ke geometri waypoint mentah")

        final_geom = snapped or raw_geom

        db.execute(text("""
            INSERT INTO rute_trayek
                (kode_trayek, nama_trayek, titik_awal, titik_akhir,
                 warna_peta, geometri_jalur)
            VALUES
                (:kode, :nama, :awal, :akhir, :warna,
                 ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))
            ON CONFLICT (kode_trayek) DO NOTHING
        """), {
            "kode":  kode,
            "nama":  props["nama_trayek"],
            "awal":  props["titik_awal"],
            "akhir": props["titik_akhir"],
            "warna": props.get("warna_peta", "#3388ff"),
            "geom":  json.dumps(final_geom),
        })
        inserted += 1
        time.sleep(0.6)  # jeda kecil supaya tidak memukul OSRM public API

    db.execute(text("""
        UPDATE rute_trayek
        SET    panjang_km = ROUND((ST_Length(geometri_jalur::geography)/1000.0)::numeric, 2)
        WHERE  panjang_km IS NULL
    """))
    db.commit()
    logger.info("Seeder rute: %s baris dimasukkan.", inserted)
    return inserted


def _seed_halte(db: Session) -> int:
    count = db.execute(text("SELECT COUNT(*) FROM halte_infrastruktur")).scalar()
    if count and count > 0:
        logger.info("halte_infrastruktur sudah berisi %s baris — skip seeding halte.", count)
        return 0

    features = _load_geojson(HALTE_FILE)
    if not features:
        return 0

    inserted = 0
    for feat in features:
        props = feat.get("properties", {})
        geom  = feat.get("geometry")
        if not geom or geom.get("type") != "Point":
            continue

        kode = props.get("kode_trayek")
        id_rute = None
        if kode:
            id_rute = db.execute(text(
                "SELECT id_rute FROM rute_trayek WHERE kode_trayek = :k"
            ), {"k": kode}).scalar()

        db.execute(text("""
            INSERT INTO halte_infrastruktur
                (id_rute_pelintas, nama_halte, nama_jalan, kondisi_fisik,
                 keterangan, koordinat_titik)
            VALUES
                (:id_rute, :nama, :jalan, :kondisi, :keterangan,
                 ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))
        """), {
            "id_rute":    id_rute,
            "nama":       props["nama_halte"],
            "jalan":      props.get("nama_jalan"),
            "kondisi":    props.get("kondisi_fisik", "Baik"),
            "keterangan": props.get("keterangan"),
            "geom":       json.dumps(geom),
        })
        inserted += 1

    db.commit()
    logger.info("Seeder halte: %s baris dimasukkan.", inserted)
    return inserted


def run_seeders() -> dict[str, int]:
    db: Session = SessionLocal()
    try:
        n_rute  = _seed_rute(db)
        n_halte = _seed_halte(db)
        return {"rute": n_rute, "halte": n_halte}
    except Exception as exc:
        db.rollback()
        logger.exception("Seeder gagal: %s", exc)
        return {"error": str(exc)}
    finally:
        db.close()


def reseed_all() -> dict[str, int]:
    """
    Hapus seluruh data rute & halte lalu seed ulang dengan OSRM snap-to-road.
    Dipanggil via CLI: `python -m app.reseed` atau script `reseed.py`.
    """
    db: Session = SessionLocal()
    try:
        logger.info("RESEED: TRUNCATE rute_trayek CASCADE (juga membersihkan halte)...")
        db.execute(text("TRUNCATE halte_infrastruktur, rute_trayek RESTART IDENTITY CASCADE"))
        db.commit()
    finally:
        db.close()
    logger.info("RESEED: menjalankan run_seeders() dengan OSRM...")
    return run_seeders()


if __name__ == "__main__":
    # CLI mode: python -m app.seeder
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    print("Reseed:", reseed_all())
