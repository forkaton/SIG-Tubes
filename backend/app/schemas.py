from typing import Literal, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


KondisiFisik = Literal["Beroperasi", "Tidak Beroperasi"]


# ===== Rute =====
class RuteBase(BaseModel):
    kode_trayek: str = Field(..., max_length=10, examples=["K01"])
    nama_trayek: str = Field(..., max_length=150)
    titik_awal:  Optional[str] = Field(None, max_length=100)
    titik_akhir: Optional[str] = Field(None, max_length=100)
    warna_peta:  str = Field("#3388ff", pattern=r"^#[0-9A-Fa-f]{6}$")


class RuteCreate(RuteBase):
    geometri_jalur: dict = Field(..., description="GeoJSON LineString geometry")


class RuteUpdate(BaseModel):
    kode_trayek: Optional[str] = Field(None, max_length=10)
    nama_trayek: Optional[str] = None
    titik_awal:  Optional[str] = None
    titik_akhir: Optional[str] = None
    warna_peta:  Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    geometri_jalur: Optional[dict] = None


class RuteOut(RuteBase):
    id_rute:    int
    panjang_km: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)


# ===== Halte =====
class HalteBase(BaseModel):
    id_rute_pelintas: Optional[int] = None
    nama_halte: str = Field(..., max_length=150)
    nama_jalan: Optional[str] = Field(None, max_length=200)
    kondisi_fisik: KondisiFisik = "Beroperasi"
    keterangan: Optional[str] = None


class HalteCreate(HalteBase):
    latitude:  float = Field(..., ge=-90,  le=90)
    longitude: float = Field(..., ge=-180, le=180)


class HalteUpdate(BaseModel):
    id_rute_pelintas: Optional[int] = None
    nama_halte: Optional[str] = Field(None, max_length=150)
    nama_jalan: Optional[str] = Field(None, max_length=200)
    kondisi_fisik: Optional[KondisiFisik] = None
    keterangan: Optional[str] = None
    latitude:  Optional[float] = Field(None, ge=-90,  le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class HalteOut(HalteBase):
    id_halte:  int
    latitude:  float
    longitude: float
    kode_trayek: Optional[str] = None
    nama_trayek: Optional[str] = None
    warna_peta:  Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class HalteRadiusOut(HalteOut):
    jarak_meter: float


# ===== GeoJSON =====
class FeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[dict[str, Any]]
