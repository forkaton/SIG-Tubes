-- =====================================================================
-- Migration v3: kondisi_fisik enum baru + titik_awal/akhir nullable
--
-- Jalankan SEKALI saja pada database existing:
--   psql -U postgres -d sig_tmp_pekanbaru -f database/02_migration_v3.sql
--
-- Perubahan:
--   1. ENUM kondisi_fisik_enum nilai "Baik"  → "Beroperasi",
--                                "Rusak"     → "Tidak Beroperasi"
--   2. Data lama bernilai "Terbengkalai" di-migrate ke "Tidak Beroperasi"
--   3. Kolom titik_awal & titik_akhir pada rute_trayek jadi nullable
--      (form admin tidak lagi meminta input)
-- =====================================================================

BEGIN;

-- 1. Rename nilai ENUM (PG 10+)
ALTER TYPE kondisi_fisik_enum RENAME VALUE 'Baik'  TO 'Beroperasi';
ALTER TYPE kondisi_fisik_enum RENAME VALUE 'Rusak' TO 'Tidak Beroperasi';

-- 2. Migrasi data yang masih bernilai 'Terbengkalai'
UPDATE halte_infrastruktur
SET    kondisi_fisik = 'Tidak Beroperasi'
WHERE  kondisi_fisik::text = 'Terbengkalai';

-- 3. Set default kondisi_fisik ke nilai baru
ALTER TABLE halte_infrastruktur
    ALTER COLUMN kondisi_fisik SET DEFAULT 'Beroperasi';

-- 4. titik_awal / titik_akhir jadi optional
ALTER TABLE rute_trayek ALTER COLUMN titik_awal  DROP NOT NULL;
ALTER TABLE rute_trayek ALTER COLUMN titik_akhir DROP NOT NULL;

COMMIT;

-- Verifikasi:
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'kondisi_fisik_enum'::regtype;
SELECT kondisi_fisik, COUNT(*) FROM halte_infrastruktur GROUP BY kondisi_fisik;
