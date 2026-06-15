"""Trip Planner A->B: cari halte naik/turun terdekat, tentukan koridor,
hitung estimasi jarak & waktu tempuh. Raw SQL + PostGIS (ST_Distance,
ST_LineMerge, ST_LineLocatePoint, ST_LineSubstring)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..seeder import osrm_snap_to_road

router = APIRouter(prefix="/api/v1/trip", tags=["Trip"])

# Asumsi kecepatan untuk estimasi waktu
KECEPATAN_JALAN_KMH = 5.0    # jalan kaki
KECEPATAN_BUS_KMH   = 20.0   # rata-rata BRT dalam kota


def _nearest_halte(db: Session, lat: float, lng: float) -> dict | None:
    sql = """
        SELECT h.id_halte, h.nama_halte, h.id_rute_pelintas,
               ST_Y(h.koordinat_titik) AS lat, ST_X(h.koordinat_titik) AS lng,
               r.kode_trayek, r.nama_trayek, r.warna_peta,
               ST_Distance(h.koordinat_titik::geography,
                           ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography) AS jarak_m
        FROM   halte_infrastruktur h
        LEFT JOIN rute_trayek r ON h.id_rute_pelintas = r.id_rute
        ORDER BY h.koordinat_titik <-> ST_SetSRID(ST_MakePoint(:lng,:lat),4326)
        LIMIT 1
    """
    row = db.execute(text(sql), {"lat": lat, "lng": lng}).fetchone()
    if not row:
        return None
    return {
        "id_halte": row.id_halte, "nama_halte": row.nama_halte,
        "id_rute_pelintas": row.id_rute_pelintas,
        "lat": float(row.lat), "lng": float(row.lng),
        "kode_trayek": row.kode_trayek, "nama_trayek": row.nama_trayek,
        "warna_peta": row.warna_peta,
        "jarak_jalan_m": round(float(row.jarak_m), 1),
    }


def _ride_along_corridor(db: Session, id_rute: int, id_a: int, id_b: int) -> dict:
    """Hitung jarak naik bus sepanjang geometri koridor antara 2 halte,
    plus geometri segmennya untuk di-highlight di peta. Fallback ke garis
    lurus geodesic bila geometri tidak bisa di-merge jadi LineString."""
    sql = """
        WITH ln AS (SELECT ST_LineMerge(geometri_jalur) AS g
                    FROM rute_trayek WHERE id_rute = :id_rute),
        pts AS (SELECT (SELECT koordinat_titik FROM halte_infrastruktur WHERE id_halte=:ida) AS pa,
                       (SELECT koordinat_titik FROM halte_infrastruktur WHERE id_halte=:idb) AS pb),
        proj AS (SELECT g,
                        ST_LineLocatePoint(g, pa) AS fa,
                        ST_LineLocatePoint(g, pb) AS fb
                 FROM ln, pts
                 WHERE GeometryType(g) = 'LINESTRING')
        SELECT ST_AsGeoJSON(ST_LineSubstring(g, LEAST(fa,fb), GREATEST(fa,fb)))::json AS geojson,
               ST_Length(ST_LineSubstring(g, LEAST(fa,fb), GREATEST(fa,fb))::geography) AS m
        FROM proj
    """
    try:
        row = db.execute(text(sql), {"id_rute": id_rute, "ida": id_a, "idb": id_b}).fetchone()
        if row and row.m is not None:
            return {"naik_bus_m": round(float(row.m), 1), "ride_geojson": row.geojson}
    except Exception:
        db.rollback()
        
    # Fallback: gunakan OSRM untuk routing via jalan raya
    row = db.execute(text("""
        SELECT ST_Y(a.koordinat_titik) as lat_a, ST_X(a.koordinat_titik) as lng_a,
               ST_Y(b.koordinat_titik) as lat_b, ST_X(b.koordinat_titik) as lng_b,
               ST_Distance(a.koordinat_titik::geography, b.koordinat_titik::geography) AS m
        FROM halte_infrastruktur a, halte_infrastruktur b
        WHERE a.id_halte=:ida AND b.id_halte=:idb
    """), {"ida": id_a, "idb": id_b}).fetchone()
    
    if row:
        route_geom = osrm_snap_to_road([[row.lng_a, row.lat_a], [row.lng_b, row.lat_b]])
        if route_geom:
            return {"naik_bus_m": round(float(row.m), 1), "ride_geojson": route_geom}
            
        # Fallback terakhir jika OSRM gagal
        fallback_row = db.execute(text("""
            SELECT ST_AsGeoJSON(ST_MakeLine(a.koordinat_titik, b.koordinat_titik))::json AS geojson
            FROM halte_infrastruktur a, halte_infrastruktur b
            WHERE a.id_halte=:ida AND b.id_halte=:idb
        """), {"ida": id_a, "idb": id_b}).fetchone()
        return {"naik_bus_m": round(float(row.m), 1), "ride_geojson": fallback_row.geojson if fallback_row else None}
        
    return {"naik_bus_m": 0, "ride_geojson": None}


@router.get("", summary="Rencana perjalanan A->B (estimasi jarak & waktu)")
def plan_trip(
    db: Session = Depends(get_db),
    from_lat: float = Query(..., ge=-90, le=90),
    from_lng: float = Query(..., ge=-180, le=180),
    to_lat:   float = Query(..., ge=-90, le=90),
    to_lng:   float = Query(..., ge=-180, le=180),
):
    naik  = _nearest_halte(db, from_lat, from_lng)
    turun = _nearest_halte(db, to_lat, to_lng)
    if not naik or not turun:
        raise HTTPException(404, "Tidak ada halte di database.")
    if naik["id_halte"] == turun["id_halte"]:
        raise HTTPException(400, "Titik asal & tujuan terlalu dekat (halte sama).")

    satu_koridor = (
        naik["id_rute_pelintas"] is not None
        and naik["id_rute_pelintas"] == turun["id_rute_pelintas"]
    )

    if satu_koridor:
        ride = _ride_along_corridor(db, naik["id_rute_pelintas"],
                                    naik["id_halte"], turun["id_halte"])
        catatan = f"Langsung naik {naik['kode_trayek']} dari {naik['nama_halte']} ke {turun['nama_halte']}."
    else:
        # Beda koridor -> estimasi menggunakan OSRM routing
        row = db.execute(text("""
            SELECT ST_Y(a.koordinat_titik) as lat_a, ST_X(a.koordinat_titik) as lng_a,
                   ST_Y(b.koordinat_titik) as lat_b, ST_X(b.koordinat_titik) as lng_b,
                   ST_Distance(a.koordinat_titik::geography, b.koordinat_titik::geography) AS m
            FROM halte_infrastruktur a, halte_infrastruktur b
            WHERE a.id_halte=:ida AND b.id_halte=:idb
        """), {"ida": naik["id_halte"], "idb": turun["id_halte"]}).fetchone()
        
        route_geom = None
        if row:
            route_geom = osrm_snap_to_road([[row.lng_a, row.lat_a], [row.lng_b, row.lat_b]])
            
        if route_geom:
            ride = {"naik_bus_m": round(float(row.m), 1), "ride_geojson": route_geom}
        else:
            # Fallback garis lurus
            fb = db.execute(text("""
                SELECT ST_AsGeoJSON(ST_MakeLine(a.koordinat_titik, b.koordinat_titik))::json AS geojson
                FROM halte_infrastruktur a, halte_infrastruktur b
                WHERE a.id_halte=:ida AND b.id_halte=:idb
            """), {"ida": naik["id_halte"], "idb": turun["id_halte"]}).fetchone()
            ride = {"naik_bus_m": round(float(row.m), 1), "ride_geojson": fb.geojson if fb else None}
            
        catatan = (f"Perlu transit: naik {naik['kode_trayek']} dari {naik['nama_halte']}, "
                   f"lalu pindah ke {turun['kode_trayek']} menuju {turun['nama_halte']}.")

    total_m = naik["jarak_jalan_m"] + ride["naik_bus_m"] + turun["jarak_jalan_m"]
    jalan_m = naik["jarak_jalan_m"] + turun["jarak_jalan_m"]
    menit = (jalan_m / (KECEPATAN_JALAN_KMH * 1000 / 60)
             + ride["naik_bus_m"] / (KECEPATAN_BUS_KMH * 1000 / 60))

    return {
        "asal":   {"lat": from_lat, "lng": from_lng},
        "tujuan": {"lat": to_lat,   "lng": to_lng},
        "halte_naik":  naik,
        "halte_turun": turun,
        "satu_koridor": satu_koridor,
        "jalan_kaki_m": round(jalan_m, 1),
        "naik_bus_m":   ride["naik_bus_m"],
        "total_jarak_m": round(total_m, 1),
        "estimasi_menit": round(menit, 1),
        "ride_geojson": ride["ride_geojson"],
        "catatan": catatan,
    }
