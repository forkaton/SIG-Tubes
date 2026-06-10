"""Generate backend/data/rute.geojson (koridor TMP) dari halte.geojson.
Tiap koridor = urutan halte ber-kode_trayek sama, di-snap ke jalan via OSRM
(fallback garis lurus jika OSRM gagal). Koridor < 2 halte di-skip."""
import json, urllib.request
from collections import OrderedDict
from pathlib import Path

DATA  = Path(__file__).resolve().parent / "data"
HALTE = DATA / "halte.geojson"
OUT   = DATA / "rute.geojson"
OSRM  = "https://router.project-osrm.org/route/v1/driving"

META = {
    "K01": ("Koridor 01 (Ramayana - Pandau Permai)",         "#E53935"),
    "K1A": ("Koridor 1A (MPP - Bandara SSK II)",             "#1E88E5"),
    "K02": ("Koridor 02 (Terminal BRPS - Kulim Ujung)",      "#43A047"),
    "K03": ("Koridor 03 (Awal Bros - UIN Suska)",            "#FB8C00"),
    "K4A": ("Koridor 4A (Pasar Pagi Arengka - Tenayan Raya)","#8E24AA"),
    "K4B": ("Koridor 4B (Sudirman Atas - Rumbai)",           "#00ACC1"),
    "K4C": ("Koridor 4C (Marpoyan Damai)",                   "#6D4C41"),
    "K8A": ("Koridor 8A (Pelita Pantai - UNRI Panam)",       "#3949AB"),
}

def osrm_snap(coords):
    if len(coords) < 2:
        return None
    cs = ";".join(f"{lng},{lat}" for lng, lat in coords)
    url = f"{OSRM}/{cs}?overview=full&geometries=geojson"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TMP-gen/1.0"})
        with urllib.request.urlopen(req, timeout=25) as r:
            data = json.loads(r.read().decode())
        if data.get("routes"):
            return data["routes"][0]["geometry"]
    except Exception as e:
        print(f"  OSRM gagal: {e} -> fallback garis lurus")
    return None

def main():
    halte = json.load(open(HALTE, encoding="utf-8"))["features"]
    groups, names = OrderedDict(), {}
    for f in halte:
        p = f["properties"]; k = p.get("kode_trayek")
        if not k:
            continue
        groups.setdefault(k, []).append(f["geometry"]["coordinates"])
        names.setdefault(k, []).append(p.get("nama_halte", "").replace("Halte ", ""))

    features = []
    for k, coords in groups.items():
        if len(coords) < 2:
            print(f"[SKIP] {k}: cuma {len(coords)} halte (butuh >=2)")
            continue
        geom = osrm_snap(coords) or {"type": "LineString", "coordinates": coords}
        nama, warna = META.get(k, (k, "#3388ff"))
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "kode_trayek": k,
                "nama_trayek": nama,
                "titik_awal":  names[k][0],
                "titik_akhir": names[k][-1],
                "warna_peta":  warna,
            },
        })
        print(f"[OK]  {k}: {len(coords)} halte -> {len(geom['coordinates'])} titik")

    json.dump({"type": "FeatureCollection", "features": features},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nDitulis {len(features)} koridor ke {OUT}")

if __name__ == "__main__":
    main()
