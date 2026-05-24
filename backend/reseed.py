"""
CLI: hapus seluruh data rute + halte di database, lalu seed ulang
dengan OSRM snap-to-road agar geometri rute mengikuti jalan raya.

Cara pakai (dari folder backend, dengan venv aktif):
    python reseed.py

Backend uvicorn tidak perlu dimatikan — script ini hanya akses DB.
Setelah selesai, refresh browser; rute akan tampil mengikuti jalan.

PERINGATAN: semua data halte & rute yang dibuat manual via Admin form
akan terhapus. Hanya seeded data (dari berkas .geojson) yang dipulihkan.
"""
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from app.seeder import reseed_all

if __name__ == "__main__":
    print("=" * 70)
    print("RE-SEED: wipe & re-load rute + halte dengan OSRM snap-to-road")
    print("=" * 70)
    result = reseed_all()
    print()
    print("=" * 70)
    print(f"Selesai: {result}")
    print("=" * 70)
