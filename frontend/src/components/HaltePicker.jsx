/**
 * HaltePicker — peta interaktif untuk memilih koordinat halte.
 *
 * Mode bebas (restrictToRuteId = null):
 *   - Klik di mana saja → marker biru muncul, koordinat ter-isi
 *   - Tombol "Gunakan Lokasi GPS Saya" memanggil browser geolocation
 *
 * Mode dibatasi (restrictToRuteId = N):
 *   - Rute terpilih DIHIGHLIGHT tebal & biru terang di atas peta
 *   - Rute lain redup (opacity rendah) sebagai konteks
 *   - Klik di area rute ter-highlight → marker SNAP ke titik terdekat di garis rute
 *   - Klik di luar toleransi (200 m) → DITOLAK, muncul peringatan
 *   - Tombol GPS juga divalidasi dengan aturan yang sama
 */
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer, TileLayer, Marker, GeoJSON, Polyline, useMap, useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { IconMousePointer, IconLocateFixed, IconAlert } from "./Icons.jsx";

const blueIcon = new L.Icon({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize:    [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const PEKANBARU_CENTER = [0.5071, 101.4478];
const TOLERANSI_METER  = 200;   // klik dianggap "di rute" jika ≤ 200 m

// ---------- Geometri helpers (point-to-polyline snap) ----------
function metersBetween(p1, p2) {
  const R = 6371000;
  const φ1 = p1.lat * Math.PI / 180, φ2 = p2.lat * Math.PI / 180;
  const dφ = (p2.lat - p1.lat) * Math.PI / 180;
  const dλ = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/** Proyeksi titik p ke segmen ab menggunakan equirectangular lokal. */
function projectOntoSegment(p, a, b) {
  const refLat = (a.lat + b.lat) / 2 * Math.PI / 180;
  const k = Math.cos(refLat);
  const ax = a.lng * k, ay = a.lat;
  const bx = b.lng * k, by = b.lat;
  const px = p.lng * k, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return { lat: a.lat, lng: a.lng };
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const tC = Math.max(0, Math.min(1, t));
  return {
    lat: a.lat + tC * (b.lat - a.lat),
    lng: a.lng + tC * (b.lng - a.lng),
  };
}

/** Cari titik terdekat di LineString [[lng,lat], ...] dari titik p. */
function snapToLineString(p, coordinates) {
  let bestDist = Infinity, bestPt = null;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = { lng: coordinates[i][0],   lat: coordinates[i][1] };
    const b = { lng: coordinates[i+1][0], lat: coordinates[i+1][1] };
    const c = projectOntoSegment(p, a, b);
    const d = metersBetween(p, c);
    if (d < bestDist) { bestDist = d; bestPt = c; }
  }
  return { point: bestPt, distance: bestDist };
}

// ---------- Komponen anak react-leaflet ----------
function ClickHandler({ onClick }) {
  useMapEvents({ click(e) { onClick(e.latlng); } });
  return null;
}

function Recentre({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 15));
  }, [position, map]);
  return null;
}

function FitToLineString({ lineString }) {
  const map = useMap();
  useEffect(() => {
    if (!lineString?.coordinates?.length) return;
    const bounds = L.latLngBounds(lineString.coordinates.map(([lng, lat]) => [lat, lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [lineString, map]);
  return null;
}

// ---------- Komponen utama ----------
export default function HaltePicker({
  value, onChange,
  ruteFc,
  restrictToRuteId,
  height = 360,
}) {
  const [warning, setWarning] = useState(null);

  // Geometri rute yang sedang dibatasi
  const restrictGeom = useMemo(() => {
    if (!restrictToRuteId || !ruteFc?.features) return null;
    const f = ruteFc.features.find((x) => x.properties.id_rute === restrictToRuteId);
    return f?.geometry || null;
  }, [restrictToRuteId, ruteFc]);

  const restrictMeta = useMemo(() => {
    if (!restrictToRuteId || !ruteFc?.features) return null;
    const f = ruteFc.features.find((x) => x.properties.id_rute === restrictToRuteId);
    return f?.properties || null;
  }, [restrictToRuteId, ruteFc]);

  function showWarning(msg) {
    setWarning(msg);
    setTimeout(() => setWarning(null), 3500);
  }

  function handlePoint(latlng) {
    const pt = { lat: latlng.lat, lng: latlng.lng };

    if (!restrictGeom) {
      onChange(pt);
      return;
    }
    const { point, distance } = snapToLineString(pt, restrictGeom.coordinates);
    if (distance > TOLERANSI_METER) {
      showWarning(
        `Klik berada ${Math.round(distance)} m dari rute ${restrictMeta?.kode_trayek || ""}. ` +
        `Silakan klik di area garis rute yang ter-highlight (toleransi ${TOLERANSI_METER} m).`
      );
      return;
    }
    onChange({ lat: point.lat, lng: point.lng });
  }

  function handleGPS() {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung Geolocation");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => handlePoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => alert("Gagal ambil GPS: " + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Style GeoJSON: highlight selected, dim others
  const ruteStyle = (feature) => {
    if (restrictToRuteId && feature.properties.id_rute === restrictToRuteId) {
      return { color: "#1e3a8a", weight: 7, opacity: 0.9 };
    }
    return { color: feature.properties.warna_peta || "#9ca3af", weight: 2, opacity: 0.3 };
  };

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6, fontSize: ".85rem", gap: 8, flexWrap: "wrap",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <IconMousePointer size={16} color="#1e3a8a" />
          {restrictGeom
            ? <><b>Klik pada rute biru</b> (highlight) untuk pilih halte.</>
            : <><b>Klik peta</b> untuk memilih lokasi halte.</>}
          {value && (
            <span style={{ marginLeft: 8, fontFamily: "monospace", color: "#1e3a8a" }}>
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </span>
          )}
        </span>
        <button type="button" onClick={handleGPS}
          style={{ background: "#0f766e", color: "white", border: 0, padding: "6px 10px", borderRadius: 6, fontSize: ".8rem", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <IconLocateFixed size={14} /> Gunakan Lokasi GPS Saya
        </button>
      </div>

      {restrictMeta && (
        <div style={{
          background: "#dbeafe", border: "1px solid #93c5fd", padding: 8,
          borderRadius: 6, fontSize: ".78rem", marginBottom: 6, color: "#1e3a8a",
          display: "flex", gap: 6, alignItems: "center",
        }}>
          <span style={{ width: 14, height: 4, background: "#1e3a8a", borderRadius: 2 }} />
          Mode terbatas: hanya dapat menambah halte pada rute{" "}
          <b>{restrictMeta.kode_trayek} — {restrictMeta.nama_trayek}</b>{" "}
          (toleransi {TOLERANSI_METER} m).
        </div>
      )}

      <div style={{ height, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", position: "relative" }}>
        <MapContainer
          center={value ? [value.lat, value.lng] : PEKANBARU_CENTER}
          zoom={value ? 15 : 12}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", cursor: restrictGeom ? "crosshair" : "pointer" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {ruteFc && ruteFc.features?.length > 0 && (
            <GeoJSON
              key={`pickerrute-${restrictToRuteId || "none"}-${ruteFc.features.length}`}
              data={ruteFc}
              style={ruteStyle}
            />
          )}

          {/* Halo putih tebal untuk rute terpilih supaya benar-benar menonjol */}
          {restrictGeom && (
            <Polyline
              positions={restrictGeom.coordinates.map(([lng, lat]) => [lat, lng])}
              pathOptions={{ color: "#3b82f6", weight: 14, opacity: 0.25 }}
            />
          )}

          <ClickHandler onClick={handlePoint} />
          <Recentre position={value} />
          {restrictGeom && <FitToLineString lineString={restrictGeom} />}

          {value && <Marker position={[value.lat, value.lng]} icon={blueIcon} />}
        </MapContainer>

        {warning && (
          <div style={{
            position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            background: "#fee2e2", color: "#991b1b",
            padding: "8px 14px", borderRadius: 8, fontSize: ".82rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)", zIndex: 1000,
            maxWidth: "85%", display: "flex", alignItems: "center", gap: 6,
            border: "1px solid #fca5a5",
          }}>
            <IconAlert size={16} /> {warning}
          </div>
        )}
      </div>
    </div>
  );
}
