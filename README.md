# WebGIS Sistem Informasi Rute Angkutan Umum Pekanbaru

**Mata Kuliah:** Sistem Informasi Geografis (SIG) Institut Teknologi Sumatera
**Kelompok 1 (2026):**
- Febrian Valentino Nugroho 123140034
- Anselmus Herpin Hasugian 123140020
- Adi Septriansyah 123140021
- Jonathan Nicholaus Damero Sinaga 123140153.

Implementasi WebGIS *full-stack* untuk **Trans Metro Pekanbaru (TMP)** 
memetakan 8 **rute** BRT, 25 **halte** beserta status fisik, pencarian halte
terdekat (ST_DWithin), perencana perjalanan (Trip Planner), dan admin panel CRUD dengan **klik peta untuk koordinat**
serta **snap-to-road via OSRM** saat menambah rute baru. Terintegrasi dengan **Autentikasi JWT Stateless** dan disiapkan untuk **Vercel Deployment**.

---

## Arsitektur

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
| Database | PostgreSQL >=14 + PostGIS >=3                       | database/         |
| Backend  | FastAPI sinkron - SQLAlchemy 2 - Pydantic v2 - JWT  | backend/          |
| Frontend | React 18 - Vite 5 - react-leaflet 4 - OSRM API      | frontend/         |
| Deploy   | Vercel Serverless Functions                         | api/ & vercel.json|

---

## 1. Setup Database (PostGIS)

```powershell
$env:PGPASSWORD = "PASSWORD_ANDA"

# Drop & recreate (PERHATIAN: data lama akan hilang)
dropdb   -U postgres sig_tmp_pekanbaru 2>$null
createdb -U postgres sig_tmp_pekanbaru

psql -U postgres -d sig_tmp_pekanbaru -f database/01_schema.sql
```

Itu saja tidak perlu menjalankan file seed SQL. Saat backend pertama kali
dijalankan, ia akan otomatis memuat 8 rute & 25 halte dari
`backend/data/rute.geojson` dan `backend/data/halte.geojson` ke PostGIS.

### Re-seed (kalau data perlu diperbarui)

Untuk membersihkan data lama dan seed ulang dari GeoJSON:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -c "from app.seeder import reseed_all; print(reseed_all())"
```

Script ini akan `TRUNCATE` rute & halte, lalu seed ulang. Seeder akan:
1. Mengelompokkan OSM features per `kode_trayek`
2. Menggabungkan segmen LineString terpotong menjadi MultiLineString utuh
   via `ST_Multi(ST_LineMerge(ST_Collect(...)))`
3. Menghitung panjang rute aktual dengan `ST_Length(...geography)`

Setelah selesai, restart backend rute akan ditampilkan dengan geometri
yang sudah tergabung dan mengikuti jalan raya OSM.

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
rute_trayek (id_rute PK, Geometry geom LineString atau MultiLineString)
  │  1:N memiliki
  └──> halte_infrastruktur (id_halte PK, Point geom, FK id_rute_pelintas)
```

GIST spatial index pada `geometri_jalur` dan `koordinat_titik`.

---

## 2. Setup Backend (FastAPI sinkron, raw SQL, JWT Auth)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Edit DATABASE_URL dan JWT_SECRET sesuai kebutuhan Anda
copy .env.example .env
notepad .env

uvicorn app.main:app --reload --port 8000
```

Pada log startup, Anda akan melihat:

```
INFO main: Menjalankan auto-seeder GeoJSON...
INFO seeder: Group rute: 8 kode trayek dari 394 fitur (skip 0)
INFO seeder: [1/8] Menjahit K01 (47 segmen)...
...
INFO seeder: Seeder rute: 8 baris dimasukkan.
INFO seeder: Seeder halte: 25 baris dimasukkan.
INFO main: Auto-seeder selesai: {'rute': 8, 'halte': 25}
```

Buka:
- Swagger UI: http://localhost:8000/docs
- OpenAPI:    http://localhost:8000/openapi.json

### Daftar Endpoint (v2.0)

| Method | Path                                          | Deskripsi |
|-------:|-----------------------------------------------|-----------|
| POST   | `/api/v1/auth/login`                          | Login Admin (JWT Stateless) |
| GET    | `/api/v1/trip`                                | Perencana perjalanan (Trip Planner) |
| GET    | `/api/v1/halte`                               | List halte (filter `kondisi`, `id_rute`) |
| GET    | `/api/v1/halte/radius?lat&lng&radius`         | **ST_DWithin** halte dalam radius (m) |
| GET    | `/api/v1/halte/geojson`                       | FeatureCollection halte |
| GET    | `/api/v1/halte/{id}`                          | Detail halte |
| POST   | `/api/v1/halte`                               | Tambah halte (Butuh Auth) |
| PUT    | `/api/v1/halte/{id}`                          | Update halte (Butuh Auth) |
| DELETE | `/api/v1/halte/{id}`                          | Hapus halte (Butuh Auth) |
| GET    | `/api/v1/rute`                                | List rute |
| GET    | `/api/v1/rute/geojson`                        | FeatureCollection semua rute |
| GET    | `/api/v1/rute/{id}/geojson`                   | GeoJSON Feature satu rute |
| GET    | `/api/v1/rute/{id}/halte-sekitar?buffer_meter`| Halte di sekitar jalur (ST_DWithin LineString) |
| POST   | `/api/v1/rute`                                | Tambah rute (Butuh Auth) |
| PUT    | `/api/v1/rute/{id}`                           | Update rute (Butuh Auth) |
| DELETE | `/api/v1/rute/{id}`                           | Hapus rute (Butuh Auth) |

---

## 3. Setup Frontend (React + Vite + Leaflet + OSRM)

```powershell
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173.

### Fitur Frontend

- **Landing Page & Single-Card Login:** Tampilan profesional dengan logo kustom (Light/Dark mode) dan formulir login admin bergaya Progressive Disclosure.
- **Trip Planner (Rute A-B):** Cari rute antar 2 lokasi, menghitung estimasi jarak & waktu tempuh. Sistem akan menyorot rute (highlight dinamis) pada peta berdasarkan geometri dari PostGIS (ST_LineLocatePoint) atau fall back ke OSRM.
- **Map Centric Layout:** OpenStreetMap full screen, sidebar interaktif.
- **Pencarian Halte Terdekat:** Klik peta untuk menentukan lokasi referensi, slider radius 100-5000 m. Hasil di sidebar + lingkaran radius di peta. Tombol GPS untuk lokasi aktual.
- **Toggle Layer:** Checkbox tampilkan/sembunyikan Rute & Halte, filter halte.
- **Popup Detail:** Halte (nama, jalan, rute, kondisi) & Rute (kode, panjang).
- **Admin CRUD Halte:** Klik peta di mana saja untuk mengisi koordinat secara otomatis, dan tombol set dari lokasi GPS.
- **Admin CRUD Rute (OSRM Snap-to-Road):** Klik Titik Awal & Titik Akhir untuk membentuk garis rute yang secara otomatis menempel (snap) ke jalan raya via OSRM public API, lalu disimpan kembali sebagai PostGIS LineString.

---

## Struktur Folder Terkini

```
SIG_TUBES/
├── api/
│   └── index.py                 # Vercel Serverless Function entry point
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
│       ├── auth.py              # JWT Stateless authentication
│       └── routers/
│           ├── halte.py         # CRUD + ST_DWithin radius (raw SQL)
│           ├── rute.py          # CRUD + GeoJSON + ST_DWithin LineString
│           └── trip.py          # Perencana Perjalanan (Trip Planner)
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js               # fetch helper + osrmRoute()
│       ├── styles.css
│       └── components/
│           ├── MapView.jsx      # Peta utama (rute + halte + radius)
│           ├── Sidebar.jsx      # Filter + radius search GPS
│           ├── HaltePicker.jsx  # Klik peta untuk koordinat halte
│           ├── RutePicker.jsx   # Klik A-B untuk OSRM snap-to-road
│           ├── AdminPanel.jsx   # CRUD Halte + Rute (integrasi picker)
│           ├── LandingPage.jsx  # Halaman landing dengan login admin
│           ├── ConfirmModal.jsx # Modal konfirmasi untuk hapus data
│           └── Icons.jsx        # Komponen icon SVG
├── logo/                        # Aset logo aplikasi (Light/Dark mode)
└── vercel.json                  # Konfigurasi deployment Vercel
```

---

