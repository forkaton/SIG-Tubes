-- =====================================================================
-- Sistem Informasi Rute Angkutan Umum Pekanbaru (Trans Metro Pekanbaru)
-- Skema Database PostgreSQL + PostGIS  (v2 — Rute, tanpa Armada)
-- Kelompok 1 - SIG ITERA 2026
-- =====================================================================
--
-- Cara pakai (drop DB lama jika sudah pernah dibuat):
--   dropdb   -U postgres sig_tmp_pekanbaru
--   createdb -U postgres sig_tmp_pekanbaru
--   psql     -U postgres -d sig_tmp_pekanbaru -f 01_schema.sql
--
-- Seed data dimuat OTOMATIS oleh backend FastAPI saat startup
-- dari berkas backend/data/rute.geojson dan backend/data/halte.geojson.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS halte_infrastruktur CASCADE;
DROP TABLE IF EXISTS rute_trayek        CASCADE;

DROP TYPE IF EXISTS kondisi_fisik_enum;

CREATE TYPE kondisi_fisik_enum AS ENUM ('Beroperasi', 'Tidak Beroperasi');

-- =====================================================================
-- 1. Tabel Induk: RUTE_TRAYEK (Entitas Garis / LineString)
-- =====================================================================
CREATE TABLE rute_trayek (
    id_rute             SERIAL PRIMARY KEY,
    kode_trayek         VARCHAR(10)  NOT NULL UNIQUE,
    nama_trayek         VARCHAR(150) NOT NULL,
    titik_awal          VARCHAR(100),
    titik_akhir         VARCHAR(100),
    warna_peta          VARCHAR(7)   NOT NULL DEFAULT '#3388ff',
    panjang_km          NUMERIC(6,2),
    geometri_jalur      GEOMETRY(LineString, 4326) NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rute_geom ON rute_trayek USING GIST (geometri_jalur);
CREATE INDEX idx_rute_kode ON rute_trayek (kode_trayek);

COMMENT ON TABLE rute_trayek IS 'Rute trayek BRT Trans Metro Pekanbaru (LineString WGS84)';

-- =====================================================================
-- 2. Tabel Anak: HALTE_INFRASTRUKTUR (Entitas Titik / Point)
-- =====================================================================
CREATE TABLE halte_infrastruktur (
    id_halte            SERIAL PRIMARY KEY,
    id_rute_pelintas    INTEGER REFERENCES rute_trayek(id_rute) ON DELETE SET NULL,
    nama_halte          VARCHAR(150) NOT NULL,
    nama_jalan          VARCHAR(200),
    kondisi_fisik       kondisi_fisik_enum NOT NULL DEFAULT 'Beroperasi',
    keterangan          TEXT,
    koordinat_titik     GEOMETRY(Point, 4326) NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_halte_geom ON halte_infrastruktur USING GIST (koordinat_titik);
CREATE INDEX idx_halte_rute ON halte_infrastruktur (id_rute_pelintas);
CREATE INDEX idx_halte_kondisi ON halte_infrastruktur (kondisi_fisik);

COMMENT ON TABLE halte_infrastruktur IS 'Titik halte/shelter BRT (Point WGS84). Target query ST_DWithin radius.';

-- =====================================================================
-- Trigger updated_at otomatis
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rute_updated_at  BEFORE UPDATE ON rute_trayek
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_halte_updated_at BEFORE UPDATE ON halte_infrastruktur
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
