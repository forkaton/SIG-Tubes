# 🚌 WebGIS Sistem Informasi Rute Angkutan Umum Pekanbaru

**Mata Kuliah:** Sistem Informasi Geografis (SIG) — Institut Teknologi Sumatera
**Kelompok 1 (2026):**
- Febrian Valentino Nugroho — 123140034
- Anselmus Herpin Hasugian — 123140020
- Adi Septriansyah — 123140021
- Jonathan Nicholaus Damero Sinaga — 123140153

Implementasi WebGIS *full-stack* untuk **Trans Metro Pekanbaru (TMP)** —
memetakan 8 **rute** BRT, 25 **halte** beserta status fisik, pencarian halte
terdekat (ST_DWithin), dan admin panel CRUD dengan **klik peta untuk koordinat**
serta **snap-to-road via OSRM** saat menambah rute baru.

---

## 🧱 Arsitektur

```
┌──────────────┐    HTTP/JSON    ┌──────────────┐   Raw SQL/PostGIS  ┌──────────────┐
│  Frontend    │ ──────────────> │  Backend     │ ─────────────────> │  PostgreSQL  │
│  React +     │                 │  FastAPI     │                    │  + PostGIS   │
│  react-leaf  │ <────────────── │  (sync)      │ <───────────────── │  (GIST idx)  │
└──────────────┘    GeoJSON      └──────────────┘                    └──────────────┘
   :5173                            :8000                                :5432
       │                              │
       │ OSRM public API              │ Auto-seed GeoJSON pada startup
       ▼                              ▼
   router.project-osrm.org      backend/data/{rute,halte}.geojson
```

| Lapis    | Tech                                                | Folder            |
|----------|-----------------------------------------------------|-------------------|
| Database | PostgreSQL ≥14 + PostGIS ≥3                         | [database/](database) |
| Backend  | FastAPI **sinkron** · SQLAlchemy 2 (raw SQL) · Pydantic v2 | [backend/](backend) |
| Frontend | React 18 · Vite 5 · react-leaflet 4 · OSRM API      | [frontend/](frontend) |

> **Catatan v2.0:** entitas **Armada** dihapus. Entitas **Koridor** diganti
> menjadi **Rute** (tabel `rute_trayek`, endpoint `/api/v1/rute`). Backend
> menggunakan **raw SQL via SQLAlchemy `text()`** tanpa GeoAlchemy2. Seeding
> bukan lagi via file `.sql` melainkan **otomatis dari GeoJSON** saat startup
> FastAPI.

---

## 🗃️ 1. Setup Database (PostGIS)

> **Jika sebelumnya sudah membuat DB versi lama (ada tabel `armada_bus_tmp` / `koridor_trayek`),
> drop dulu lalu buat baru — schema kolom berubah.**

```powershell
$env:PGPASSWORD = "PASSWORD_ANDA"

# Drop & recreate (PERHATIAN: data lama akan hilang)
dropdb   -U postgres sig_tmp_pekanbaru 2>$null
createdb -U postgres sig_tmp_pekanbaru

psql -U postgres -d sig_tmp_pekanbaru -f database/01_schema.sql
```

Itu saja — **tidak perlu menjalankan file seed SQL**. Saat backend pertama kali
dijalankan, ia akan otomatis memuat 8 rute & 25 halte dari
`backend/data/rute.geojson` dan `backend/data/halte.geojson` ke PostGIS.

> **🔑 Penting — OSRM Snap-to-Road saat seeding:**
> Seeder akan memanggil OSRM public API untuk setiap rute, supaya geometri
> yang disimpan **mengikuti jalan raya** (bukan garis lurus antar landmark).
> Pastikan ada koneksi internet saat startup pertama. Bila OSRM gagal,
> seeder fallback ke geometri waypoint mentah dengan peringatan.

### Re-seed (kalau data lama berupa garis lurus)

Bila Anda sudah menjalankan versi seeder lama (rute tampil sebagai garis
lurus), jalankan script reseed untuk membersihkan & re-snap via OSRM:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python reseed.py
```

Script ini akan `TRUNCATE` rute & halte lalu seed ulang dengan OSRM. Setelah
selesai, refresh browser — rute akan mengikuti jalan.

Verifikasi setelah backend dijalankan:

```sql
SELECT COUNT(*) FROM rute_trayek;          -- 8
SELECT COUNT(*) FROM halte_infrastruktur;  -- 25

-- Tes query spasial radius 1 km dari MPP Pekanbaru
SELECT nama_halte,
       ROUND(ST_Distance(koordinat_titik::geography,
            ST_SetSRID(ST_MakePoint(101.4458, 0.5083),4326)::geography)::numeric, 2) AS jarak_m
FROM   halte_infrastruktur
WHERE  ST_DWithin(koordinat_titik::geography,
                  ST_SetSRID(ST_MakePoint(101.4458, 0.5083),4326)::geography,
                  1000)
ORDER  BY jarak_m;
```

### Struktur ERD

```
rute_trayek (id_rute PK, LineString geom)
  │  1:N memiliki
  └──> halte_infrastruktur (id_halte PK, Point geom, FK id_rute_pelintas)
```

GIST spatial index pada `geometri_jalur` dan `koordinat_titik`.

---

## 🐍 2. Setup Backend (FastAPI sinkron, raw SQL)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Edit DATABASE_URL sesuai password postgres Anda
copy .env.example .env
notepad .env

uvicorn app.main:app --reload --port 8000
```

Pada log startup, Anda akan melihat:

```
INFO main: Menjalankan auto-seeder GeoJSON...
INFO seeder: Seeder rute: 8 baris dimasukkan.
INFO seeder: Seeder halte: 25 baris dimasukkan.
INFO main: Auto-seeder selesai: {'rute': 8, 'halte': 25}
```

Buka:
- Swagger UI: <http://localhost:8000/docs>
- OpenAPI:    <http://localhost:8000/openapi.json>

### Daftar Endpoint (v2.0)

| Method | Path                                          | Deskripsi |
|-------:|-----------------------------------------------|-----------|
| GET    | `/api/v1/halte`                               | List halte (filter `kondisi`, `id_rute`) |
| GET    | `/api/v1/halte/radius?lat&lng&radius`         | **ST_DWithin** — halte dalam radius (m) |
| GET    | `/api/v1/halte/geojson`                       | FeatureCollection halte |
| GET    | `/api/v1/halte/{id}`                          | Detail halte |
| POST   | `/api/v1/halte`                               | Tambah halte (validasi Pydantic) |
| PUT    | `/api/v1/halte/{id}`                          | Update halte |
| DELETE | `/api/v1/halte/{id}`                          | Hapus halte |
| GET    | `/api/v1/rute`                                | List rute |
| GET    | `/api/v1/rute/geojson`                        | FeatureCollection semua rute |
| GET    | `/api/v1/rute/{id}/geojson`                   | GeoJSON Feature satu rute |
| GET    | `/api/v1/rute/{id}/halte-sekitar?buffer_meter`| Halte di sekitar jalur (ST_DWithin LineString) |
| POST   | `/api/v1/rute`                                | Tambah rute (kirim GeoJSON LineString) |
| PUT    | `/api/v1/rute/{id}`                           | Update rute |
| DELETE | `/api/v1/rute/{id}`                           | Hapus rute |

---

## ⚛️ 3. Setup Frontend (React + Vite + Leaflet + OSRM)

```powershell
cd frontend
npm install
npm run dev
```

Buka <http://localhost:5173>.

### Fitur Frontend

- **Map Centric Layout** — OpenStreetMap full screen, sidebar filter 340 px.
- **Filter Rute** — checkbox per rute + toggle tampilkan halte rusak.
- **Pencarian Halte Terdekat** — input lat/lng manual atau **Pakai GPS**,
  slider radius 100–5000 m → `GET /api/v1/halte/radius`. Hasil di sidebar +
  lingkaran biru di peta.
- **Popup Detail** — halte (nama, jalan, rute, kondisi) & rute (kode, panjang).
- **Admin CRUD Halte** — `HaltePicker.jsx`:
  - **Klik peta** di mana saja → marker biru pindah, koordinat otomatis terisi.
  - Tombol **📍 Gunakan Lokasi GPS Saya** → langsung set ke posisi GPS.
  - Overlay rute eksisting ditampilkan transparan agar admin tahu trayek terdekat.
- **Admin CRUD Rute** — `RutePicker.jsx`:
  - Klik pertama → **Titik Awal** (marker hijau).
  - Klik kedua → **Titik Akhir** (marker merah).
  - Otomatis memanggil **OSRM** `https://router.project-osrm.org/route/v1/driving/...`
    → menerima GeoJSON LineString **yang mengikuti jalan raya** (snap-to-road).
  - Polyline biru tebal ditampilkan + estimasi panjang km dihitung haversine.
  - Tombol Simpan mengirim LineString utuh ke `POST /api/v1/rute`.

---

## 📁 Struktur Folder

```
SIG_TUBES/
├── database/
│   └── 01_schema.sql            # CREATE TABLE rute_trayek + halte_infrastruktur
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/
│   │   ├── rute.geojson         # 8 LineString koridor TMP
│   │   └── halte.geojson        # 25 Point halte
│   └── app/
│       ├── main.py              # FastAPI + lifespan hook auto-seeder
│       ├── config.py            # Pydantic settings
│       ├── database.py          # SQLAlchemy engine/session sinkron
│       ├── models.py            # Slim ORM (raw SQL untuk geom)
│       ├── schemas.py           # Pydantic schemas (Rute, Halte)
│       ├── seeder.py            # Auto-seed dari GeoJSON
│       └── routers/
│           ├── halte.py         # CRUD + ST_DWithin radius (raw SQL)
│           └── rute.py          # CRUD + GeoJSON + ST_DWithin LineString
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js               # fetch helper + osrmRoute()
        ├── styles.css
        └── components/
            ├── MapView.jsx      # Peta utama (rute + halte + radius)
            ├── Sidebar.jsx      # Filter + radius search GPS
            ├── HaltePicker.jsx  # Klik peta → koordinat halte + GPS
            ├── RutePicker.jsx   # Klik A→B → OSRM snap-to-road
            └── AdminPanel.jsx   # CRUD Halte + Rute (integrasi picker)
```

---

## 🔗 Catatan Teknis

- **Raw SQL only**: setiap router menggunakan `db.execute(text("..."))` untuk
  mengeksekusi kueri spasial PostGIS (`ST_DWithin`, `ST_Distance`, `ST_AsGeoJSON`,
  `ST_SetSRID(ST_MakePoint(...))`). GeoAlchemy2 tidak diperlukan.
- **Auto-seed idempoten**: seeder mengecek `COUNT(*)` lebih dulu — kalau tabel
  sudah berisi data, ia melompat. Restart backend aman.
- **OSRM**: memakai server publik `router.project-osrm.org` (rate-limited).
  Untuk produksi, pertimbangkan self-host OSRM atau gunakan alternatif seperti
  `leaflet-routing-machine` dengan plugin OSRM/GraphHopper.
- **GeoJSON konvensi**: koordinat `[longitude, latitude]` (bukan lat,lng).
  Konversi ke Leaflet `[lat, lng]` dilakukan saat render.
