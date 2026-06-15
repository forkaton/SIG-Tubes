"""Endpoints CRUD + query spasial untuk entitas Halte. Raw SQL via SQLAlchemy text()."""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    HalteCreate, HalteUpdate, HalteOut, HalteRadiusOut, FeatureCollection,
)
from ..auth import verify_token

router = APIRouter(prefix="/api/v1/halte", tags=["Halte"])


def _row_to_halte(row) -> dict:
    return {
        "id_halte":         row.id_halte,
        "id_rute_pelintas": row.id_rute_pelintas,
        "nama_halte":       row.nama_halte,
        "nama_jalan":       row.nama_jalan,
        "kondisi_fisik":    row.kondisi_fisik,
        "keterangan":       row.keterangan,
        "latitude":         float(row.lat),
        "longitude":        float(row.lng),
        "kode_trayek":      row.kode_trayek,
        "nama_trayek":      row.nama_trayek,
        "warna_peta":       row.warna_peta,
    }


@router.get("", response_model=List[HalteOut], summary="Daftar seluruh halte")
def list_halte(
    db: Session = Depends(get_db),
    kondisi: Optional[str] = Query(None, description="Filter: Baik / Rusak / Terbengkalai"),
    id_rute: Optional[int] = Query(None, description="Filter berdasarkan id rute"),
):
    sql = """
        SELECT  h.id_halte, h.id_rute_pelintas, h.nama_halte, h.nama_jalan,
                h.kondisi_fisik, h.keterangan,
                ST_Y(h.koordinat_titik) AS lat,
                ST_X(h.koordinat_titik) AS lng,
                r.kode_trayek, r.nama_trayek, r.warna_peta
        FROM    halte_infrastruktur h
        LEFT JOIN rute_trayek r ON h.id_rute_pelintas = r.id_rute
        WHERE   (CAST(:kondisi AS text)    IS NULL OR h.kondisi_fisik::text = CAST(:kondisi AS text))
          AND   (CAST(:id_rute AS integer) IS NULL OR h.id_rute_pelintas    = CAST(:id_rute AS integer))
        ORDER BY h.id_halte
    """
    rows = db.execute(text(sql), {"kondisi": kondisi, "id_rute": id_rute}).fetchall()
    return [_row_to_halte(r) for r in rows]


@router.get(
    "/radius",
    response_model=List[HalteRadiusOut],
    summary="Halte dalam radius (ST_DWithin)",
)
def halte_radius(
    db: Session = Depends(get_db),
    lat:    float = Query(..., ge=-90,  le=90,  description="Latitude lokasi pengguna"),
    lng:    float = Query(..., ge=-180, le=180, description="Longitude lokasi pengguna"),
    radius: int   = Query(500,  ge=10, le=20000, description="Radius (meter)"),
    limit:  int   = Query(20,   ge=1,  le=100,   description="Maksimum hasil"),
):
    sql = """
        SELECT  h.id_halte, h.id_rute_pelintas, h.nama_halte, h.nama_jalan,
                h.kondisi_fisik, h.keterangan,
                ST_Y(h.koordinat_titik) AS lat,
                ST_X(h.koordinat_titik) AS lng,
                r.kode_trayek, r.nama_trayek, r.warna_peta,
                ST_Distance(
                    h.koordinat_titik::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                ) AS jarak_meter
        FROM    halte_infrastruktur h
        LEFT JOIN rute_trayek r ON h.id_rute_pelintas = r.id_rute
        WHERE   ST_DWithin(
                    h.koordinat_titik::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    :radius
                )
        ORDER BY jarak_meter ASC
        LIMIT   :limit
    """
    rows = db.execute(text(sql), {"lat": lat, "lng": lng, "radius": radius, "limit": limit}).fetchall()
    return [{**_row_to_halte(r), "jarak_meter": round(float(r.jarak_meter), 2)} for r in rows]


@router.get("/geojson", response_model=FeatureCollection, summary="Halte format GeoJSON")
def halte_geojson(
    db: Session = Depends(get_db),
    kondisi: Optional[str] = Query(None),
    id_rute: Optional[int] = Query(None),
):
    sql = """
        SELECT  json_build_object(
                    'type',     'FeatureCollection',
                    'features', COALESCE(json_agg(feat), '[]'::json)
                ) AS fc
        FROM (
            SELECT  json_build_object(
                        'type',       'Feature',
                        'id',         h.id_halte,
                        'geometry',   ST_AsGeoJSON(h.koordinat_titik)::json,
                        'properties', json_build_object(
                            'id_halte',         h.id_halte,
                            'id_rute_pelintas', h.id_rute_pelintas,
                            'nama_halte',       h.nama_halte,
                            'nama_jalan',       h.nama_jalan,
                            'kondisi_fisik',    h.kondisi_fisik,
                            'keterangan',       h.keterangan,
                            'kode_trayek',      r.kode_trayek,
                            'nama_trayek',      r.nama_trayek,
                            'warna_peta',       r.warna_peta
                        )
                    ) AS feat
            FROM    halte_infrastruktur h
            LEFT JOIN rute_trayek r ON h.id_rute_pelintas = r.id_rute
            WHERE   (CAST(:kondisi AS text)    IS NULL OR h.kondisi_fisik::text = CAST(:kondisi AS text))
              AND   (CAST(:id_rute AS integer) IS NULL OR h.id_rute_pelintas    = CAST(:id_rute AS integer))
        ) sub
    """
    return db.execute(text(sql), {"kondisi": kondisi, "id_rute": id_rute}).scalar()


@router.get("/{id_halte}", response_model=HalteOut)
def get_halte(id_halte: int, db: Session = Depends(get_db)):
    sql = """
        SELECT  h.id_halte, h.id_rute_pelintas, h.nama_halte, h.nama_jalan,
                h.kondisi_fisik, h.keterangan,
                ST_Y(h.koordinat_titik) AS lat,
                ST_X(h.koordinat_titik) AS lng,
                r.kode_trayek, r.nama_trayek, r.warna_peta
        FROM    halte_infrastruktur h
        LEFT JOIN rute_trayek r ON h.id_rute_pelintas = r.id_rute
        WHERE   h.id_halte = :id
    """
    row = db.execute(text(sql), {"id": id_halte}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Halte tidak ditemukan")
    return _row_to_halte(row)


@router.post("", response_model=HalteOut, status_code=201, summary="Tambah halte baru", dependencies=[Depends(verify_token)])
def create_halte(payload: HalteCreate, db: Session = Depends(get_db)):
    sql_insert = """
        INSERT INTO halte_infrastruktur
            (id_rute_pelintas, nama_halte, nama_jalan, kondisi_fisik, keterangan, koordinat_titik)
        VALUES
            (:id_rute, :nama, :jalan, :kondisi, :keterangan,
             ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
        RETURNING id_halte
    """
    try:
        new_id = db.execute(text(sql_insert), {
            "id_rute":    payload.id_rute_pelintas,
            "nama":       payload.nama_halte,
            "jalan":      payload.nama_jalan,
            "kondisi":    payload.kondisi_fisik,
            "keterangan": payload.keterangan,
            "lng":        payload.longitude,
            "lat":        payload.latitude,
        }).scalar()
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Gagal insert halte: {exc}") from exc
    return get_halte(new_id, db)


@router.put("/{id_halte}", response_model=HalteOut, summary="Perbarui halte", dependencies=[Depends(verify_token)])
def update_halte(id_halte: int, payload: HalteUpdate, db: Session = Depends(get_db)):
    exists = db.execute(
        text("SELECT 1 FROM halte_infrastruktur WHERE id_halte = :id"),
        {"id": id_halte},
    ).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Halte tidak ditemukan")

    sets: list[str] = []
    params: dict = {"id": id_halte}
    field_map = {
        "id_rute_pelintas": "id_rute_pelintas",
        "nama_halte":       "nama_halte",
        "nama_jalan":       "nama_jalan",
        "kondisi_fisik":    "kondisi_fisik",
        "keterangan":       "keterangan",
    }
    for attr, col in field_map.items():
        val = getattr(payload, attr)
        if val is not None:
            sets.append(f"{col} = :{attr}")
            params[attr] = val

    if payload.latitude is not None and payload.longitude is not None:
        sets.append("koordinat_titik = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)")
        params["lng"] = payload.longitude
        params["lat"] = payload.latitude
    elif (payload.latitude is None) ^ (payload.longitude is None):
        raise HTTPException(status_code=400, detail="latitude & longitude harus diisi keduanya")

    if not sets:
        raise HTTPException(status_code=400, detail="Tidak ada field yang diperbarui")

    db.execute(text(f"UPDATE halte_infrastruktur SET {', '.join(sets)} WHERE id_halte = :id"), params)
    db.commit()
    return get_halte(id_halte, db)


@router.delete("/{id_halte}", status_code=204, summary="Hapus halte", dependencies=[Depends(verify_token)])
def delete_halte(id_halte: int, db: Session = Depends(get_db)):
    result = db.execute(text("DELETE FROM halte_infrastruktur WHERE id_halte = :id"), {"id": id_halte})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Halte tidak ditemukan")
    return None
