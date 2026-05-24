"""Endpoints untuk entitas Rute Trayek (LineString). Raw SQL via SQLAlchemy text()."""
import json
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import RuteCreate, RuteUpdate, RuteOut, FeatureCollection
from ..seeder import osrm_snap_to_road

router = APIRouter(prefix="/api/v1/rute", tags=["Rute"])


def _row_to_rute(row) -> dict:
    return {
        "id_rute":     row.id_rute,
        "kode_trayek": row.kode_trayek,
        "nama_trayek": row.nama_trayek,
        "titik_awal":  row.titik_awal,
        "titik_akhir": row.titik_akhir,
        "warna_peta":  row.warna_peta,
        "panjang_km":  float(row.panjang_km) if row.panjang_km is not None else None,
    }


@router.get("", response_model=List[RuteOut], summary="Daftar seluruh rute")
def list_rute(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT id_rute, kode_trayek, nama_trayek, titik_awal, titik_akhir, "
        "       warna_peta, panjang_km "
        "FROM   rute_trayek "
        "ORDER  BY kode_trayek"
    )).fetchall()
    return [_row_to_rute(r) for r in rows]


@router.get(
    "/geojson",
    response_model=FeatureCollection,
    summary="Seluruh rute sebagai GeoJSON FeatureCollection",
)
def all_rute_geojson(db: Session = Depends(get_db)):
    sql = """
        SELECT  json_build_object(
                    'type',     'FeatureCollection',
                    'features', COALESCE(json_agg(feat), '[]'::json)
                ) AS fc
        FROM (
            SELECT  json_build_object(
                        'type',       'Feature',
                        'id',         id_rute,
                        'geometry',   ST_AsGeoJSON(geometri_jalur)::json,
                        'properties', json_build_object(
                            'id_rute',     id_rute,
                            'kode_trayek', kode_trayek,
                            'nama_trayek', nama_trayek,
                            'titik_awal',  titik_awal,
                            'titik_akhir', titik_akhir,
                            'warna_peta',  warna_peta,
                            'panjang_km',  panjang_km
                        )
                    ) AS feat
            FROM    rute_trayek
            ORDER BY kode_trayek
        ) sub
    """
    return db.execute(text(sql)).scalar()


@router.get(
    "/{id_rute}/geojson",
    response_model=dict,
    summary="GeoJSON Feature untuk satu rute",
)
def rute_geojson(id_rute: int, db: Session = Depends(get_db)):
    sql = """
        SELECT  json_build_object(
                    'type',       'Feature',
                    'id',         id_rute,
                    'geometry',   ST_AsGeoJSON(geometri_jalur)::json,
                    'properties', json_build_object(
                        'id_rute',     id_rute,
                        'kode_trayek', kode_trayek,
                        'nama_trayek', nama_trayek,
                        'titik_awal',  titik_awal,
                        'titik_akhir', titik_akhir,
                        'warna_peta',  warna_peta,
                        'panjang_km',  panjang_km
                    )
                ) AS feature
        FROM    rute_trayek
        WHERE   id_rute = :id
    """
    feat = db.execute(text(sql), {"id": id_rute}).scalar()
    if not feat:
        raise HTTPException(status_code=404, detail="Rute tidak ditemukan")
    return feat


@router.get(
    "/{id_rute}/halte-sekitar",
    response_model=FeatureCollection,
    summary="Halte di sekitar jalur rute (ST_DWithin pada LineString)",
)
def halte_sekitar_rute(id_rute: int, buffer_meter: int = 200, db: Session = Depends(get_db)):
    sql = """
        WITH r AS (SELECT geometri_jalur FROM rute_trayek WHERE id_rute = :id)
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
                            'id_halte',      h.id_halte,
                            'nama_halte',    h.nama_halte,
                            'kondisi_fisik', h.kondisi_fisik
                        )
                    ) AS feat
            FROM    halte_infrastruktur h, r
            WHERE   ST_DWithin(h.koordinat_titik::geography, r.geometri_jalur::geography, :buf)
        ) sub
    """
    fc = db.execute(text(sql), {"id": id_rute, "buf": buffer_meter}).scalar()
    if fc is None:
        raise HTTPException(status_code=404, detail="Rute tidak ditemukan")
    return fc


@router.post("", response_model=RuteOut, status_code=201)
def create_rute(payload: RuteCreate, db: Session = Depends(get_db)):
    sql_insert = """
        INSERT INTO rute_trayek
            (kode_trayek, nama_trayek, titik_awal, titik_akhir, warna_peta, geometri_jalur)
        VALUES
            (:kode, :nama, :awal, :akhir, :warna,
             ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))
        RETURNING id_rute
    """
    try:
        new_id = db.execute(text(sql_insert), {
            "kode":  payload.kode_trayek,
            "nama":  payload.nama_trayek,
            "awal":  payload.titik_awal,
            "akhir": payload.titik_akhir,
            "warna": payload.warna_peta,
            "geom":  json.dumps(payload.geometri_jalur),
        }).scalar()
        db.execute(text(
            "UPDATE rute_trayek SET panjang_km = "
            "ROUND((ST_Length(geometri_jalur::geography)/1000.0)::numeric, 2) "
            "WHERE id_rute = :id"
        ), {"id": new_id})
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Gagal insert rute: {exc}") from exc

    row = db.execute(text(
        "SELECT id_rute, kode_trayek, nama_trayek, titik_awal, titik_akhir, "
        "       warna_peta, panjang_km FROM rute_trayek WHERE id_rute = :id"
    ), {"id": new_id}).fetchone()
    return _row_to_rute(row)


@router.put("/{id_rute}", response_model=RuteOut)
def update_rute(id_rute: int, payload: RuteUpdate, db: Session = Depends(get_db)):
    exists = db.execute(text("SELECT 1 FROM rute_trayek WHERE id_rute = :id"),
                        {"id": id_rute}).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Rute tidak ditemukan")

    sets: list[str] = []
    params: dict = {"id": id_rute}
    for attr in ("nama_trayek", "titik_awal", "titik_akhir", "warna_peta"):
        val = getattr(payload, attr)
        if val is not None:
            sets.append(f"{attr} = :{attr}")
            params[attr] = val
    if payload.geometri_jalur is not None:
        sets.append("geometri_jalur = ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)")
        params["geom"] = json.dumps(payload.geometri_jalur)

    if not sets:
        raise HTTPException(status_code=400, detail="Tidak ada field yang diperbarui")

    db.execute(text(f"UPDATE rute_trayek SET {', '.join(sets)} WHERE id_rute = :id"), params)
    if payload.geometri_jalur is not None:
        db.execute(text(
            "UPDATE rute_trayek SET panjang_km = "
            "ROUND((ST_Length(geometri_jalur::geography)/1000.0)::numeric, 2) "
            "WHERE id_rute = :id"
        ), {"id": id_rute})
    db.commit()

    row = db.execute(text(
        "SELECT id_rute, kode_trayek, nama_trayek, titik_awal, titik_akhir, "
        "       warna_peta, panjang_km FROM rute_trayek WHERE id_rute = :id"
    ), {"id": id_rute}).fetchone()
    return _row_to_rute(row)


@router.delete("/{id_rute}", status_code=204)
def delete_rute(id_rute: int, db: Session = Depends(get_db)):
    result = db.execute(text("DELETE FROM rute_trayek WHERE id_rute = :id"), {"id": id_rute})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Rute tidak ditemukan")
    return None


@router.post(
    "/snap-all",
    summary="Re-snap geometri seluruh rute ke jalan raya via OSRM",
    description=(
        "Ambil koordinat existing tiap rute, kirim ke OSRM, lalu UPDATE "
        "geometri dengan hasil snap-to-road. Tidak menghapus data, hanya "
        "memperbarui kolom geometri_jalur. Berguna memperbaiki data lama "
        "yang masih berupa garis lurus antar waypoint."
    ),
)
def snap_all_rute(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT id_rute, kode_trayek, ST_AsGeoJSON(geometri_jalur)::json AS geom "
        "FROM rute_trayek ORDER BY kode_trayek"
    )).fetchall()

    results = []
    for r in rows:
        coords = r.geom.get("coordinates", []) if isinstance(r.geom, dict) else []
        if len(coords) < 2:
            results.append({"kode_trayek": r.kode_trayek, "status": "skip", "alasan": "kurang waypoint"})
            continue

        snapped = osrm_snap_to_road(coords)
        if not snapped:
            results.append({"kode_trayek": r.kode_trayek, "status": "osrm_gagal"})
            time.sleep(0.6)
            continue

        db.execute(text("""
            UPDATE rute_trayek
            SET   geometri_jalur = ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326),
                  panjang_km     = ROUND((ST_Length(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)::geography)/1000.0)::numeric, 2)
            WHERE id_rute = :id
        """), {"geom": json.dumps(snapped), "id": r.id_rute})

        results.append({
            "kode_trayek": r.kode_trayek,
            "status": "ok",
            "titik_geometri": len(snapped["coordinates"]),
        })
        time.sleep(0.6)

    db.commit()
    sukses = sum(1 for x in results if x["status"] == "ok")
    return {"total": len(rows), "sukses": sukses, "detail": results}
