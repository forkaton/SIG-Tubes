"""
Models referensi skema (slim, tanpa GeoAlchemy2).

Catatan: seluruh CRUD & query spasial pada proyek ini dieksekusi via Raw SQL
(`db.execute(text(...))`) sehingga deklarasi ORM di sini hanya berfungsi
sebagai dokumentasi tabel dan tidak dipakai oleh router. Kolom geometri
(LineString/Point) sengaja tidak dideklarasikan karena SQLAlchemy core
tidak mengenal tipe PostGIS tanpa GeoAlchemy2.
"""
from sqlalchemy import (
    Column, Integer, String, Text, ForeignKey, Numeric, DateTime, func,
)
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

from .database import Base


class RuteTrayek(Base):
    __tablename__ = "rute_trayek"

    id_rute        = Column(Integer, primary_key=True, index=True)
    kode_trayek    = Column(String(10),  unique=True, nullable=False, index=True)
    nama_trayek    = Column(String(150), nullable=False)
    titik_awal     = Column(String(100), nullable=False)
    titik_akhir    = Column(String(100), nullable=False)
    warna_peta     = Column(String(7),   nullable=False, default="#3388ff")
    panjang_km     = Column(Numeric(6, 2))
    # geometri_jalur GEOMETRY(LineString, 4326) — diakses via Raw SQL
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class HalteInfrastruktur(Base):
    __tablename__ = "halte_infrastruktur"

    id_halte         = Column(Integer, primary_key=True, index=True)
    id_rute_pelintas = Column(Integer, ForeignKey("rute_trayek.id_rute", ondelete="SET NULL"), index=True)
    nama_halte       = Column(String(150), nullable=False)
    nama_jalan       = Column(String(200))
    kondisi_fisik    = Column(
        PGEnum("Baik", "Rusak", "Terbengkalai", name="kondisi_fisik_enum", create_type=False),
        nullable=False, default="Baik",
    )
    keterangan       = Column(Text)
    # koordinat_titik GEOMETRY(Point, 4326) — diakses via Raw SQL
    created_at       = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
