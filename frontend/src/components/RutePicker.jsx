/**
 * RutePicker — multi-waypoint snap-to-road via OSRM.
 *
 * Cara kerja:
 *   - Klik di peta untuk menambah waypoint berurutan.
 *   - Setiap kali waypoint baru ditambahkan, OSRM dipanggil untuk
 *     menyambung SEMUA waypoint menjadi satu LineString yang tetap
 *     mengikuti jalan raya valid.
 *   - Marker (pin) HANYA tampil di waypoint pertama (hijau "AWAL") dan
 *     waypoint terakhir (merah "AKHIR"). Waypoint tengah tidak digambar
 *     sebagai marker — hanya tergambar sebagai bagian dari polyline.
 *
 * Output `value`:
 *   { waypoints: [{lat,lng}, ...], lineString: GeoJSON | null }
 */
import { useEffect, useState } from "react";
import {
  MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  IconFlag, IconCheckCircle, IconLoader, IconUndo, IconXCircle, IconAlert, IconInfo,
} from "./Icons.jsx";

const PEKANBARU_CENTER = [0.5071, 101.4478];

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

function ClickHandler({ onClick }) {
  useMapEvents({ click(e) { onClick(e.latlng); } });
  return null;
}

function FitToReference({ lineString }) {
  const map = useMap();
  useEffect(() => {
    if (!lineString?.coordinates?.length) return;
    const bounds = L.latLngBounds(lineString.coordinates.map(([lng, lat]) => [lat, lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [lineString, map]);
  return null;
}

async function osrmRouteMulti(waypoints) {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coords}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  if (!data.routes?.length) throw new Error("OSRM: rute tidak ditemukan");
  return data.routes[0].geometry;
}

export default function RutePicker({
  value, onChange, onReset, height = 420,
  referenceLineString = null,    // geometri rute existing (mode edit)
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  const waypoints = value?.waypoints ?? [];
  const lineString = value?.lineString;

  async function recompute(newWaypoints) {
    setErr(null);
    if (newWaypoints.length < 2) {
      onChange({ waypoints: newWaypoints, lineString: null });
      return;
    }
    setBusy(true);
    try {
      const ls = await osrmRouteMulti(newWaypoints);
      onChange({ waypoints: newWaypoints, lineString: ls });
    } catch (e) {
      setErr(e.message);
      onChange({ waypoints: newWaypoints, lineString: null });
    } finally {
      setBusy(false);
    }
  }

  async function handleMapClick(latlng) {
    const pt = { lat: latlng.lat, lng: latlng.lng };
    await recompute([...waypoints, pt]);
  }

  function undoLast() {
    if (waypoints.length === 0) return;
    recompute(waypoints.slice(0, -1));
  }

  // GeoJSON [lng,lat] → Leaflet [lat,lng]
  const polyline = lineString
    ? lineString.coordinates.map(([lng, lat]) => [lat, lng])
    : null;

  // Marker hanya untuk titik AWAL dan AKHIR
  const startPoint = waypoints[0] ?? null;
  const endPoint   = waypoints.length >= 2 ? waypoints[waypoints.length - 1] : null;

  return (
    <div>
      {/* === Instruksi & status === */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 6, fontSize: ".85rem", flexWrap: "wrap", gap: 6,
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {waypoints.length === 0 && (
            <><IconFlag size={14} color="#16a34a" /> <b>Klik peta</b> untuk menentukan <b style={{ color: "#16a34a" }}>Titik Awal</b></>
          )}
          {waypoints.length === 1 && (
            <><IconFlag size={14} color="#dc2626" /> <b>Klik peta lagi</b> untuk menentukan <b style={{ color: "#dc2626" }}>Titik Akhir</b> (atau waypoint berikutnya)</>
          )}
          {waypoints.length >= 2 && lineString && (
            <>
              <IconCheckCircle size={14} color="#16a34a" />
              Rute terbentuk · {waypoints.length} waypoint ·
              {" "}<b>{lineString.coordinates.length}</b> titik geometri.
              {" "}Klik lagi untuk tambah waypoint, atau <b>Undo / Reset</b>.
            </>
          )}
          {busy && <span style={{ marginLeft: 8, color: "#1e3a8a", display: "inline-flex", alignItems: "center", gap: 4 }}><IconLoader size={14} /> OSRM…</span>}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {waypoints.length > 0 && (
            <button type="button" onClick={undoLast}
              style={{ background: "#f59e0b", color: "white", border: 0, padding: "6px 10px", borderRadius: 6, fontSize: ".8rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconUndo size={14} /> Undo
            </button>
          )}
          <button type="button" onClick={onReset}
            style={{ background: "#6b7280", color: "white", border: 0, padding: "6px 10px", borderRadius: 6, fontSize: ".8rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconXCircle size={14} /> Reset
          </button>
        </div>
      </div>

      {err && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 8, borderRadius: 6, marginBottom: 6, fontSize: ".8rem", display: "flex", alignItems: "center", gap: 6 }}>
          <IconAlert size={14} /> OSRM gagal: {err}. Pastikan titik berada di area jalan raya yang dikenal OSM.
        </div>
      )}

      {referenceLineString && !polyline && (
        <div style={{
          background: "#f3f4f6", border: "1px solid #d1d5db", padding: 8,
          borderRadius: 6, fontSize: ".78rem", marginBottom: 6, color: "#374151",
          display: "flex", gap: 6, alignItems: "center",
        }}>
          <IconInfo size={14} />
          <span>Mode edit — garis abu-abu menampilkan geometri rute saat ini.
          Klik peta untuk <b>menggambar ulang</b> rute, atau biarkan kosong jika geometri tidak ingin diubah.</span>
        </div>
      )}

      <div style={{ height, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
        <MapContainer center={PEKANBARU_CENTER} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%", cursor: "crosshair" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap | Routing: OSRM'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onClick={handleMapClick} />

          {/* Reference geometry (mode edit) — abu-abu putus-putus */}
          {referenceLineString && (
            <>
              <FitToReference lineString={referenceLineString} />
              <Polyline
                positions={referenceLineString.coordinates.map(([lng, lat]) => [lat, lng])}
                pathOptions={{ color: "#6b7280", weight: 4, opacity: 0.6, dashArray: "8 6" }}
              />
            </>
          )}

          {/* Marker AWAL — hanya 1 */}
          {startPoint && (
            <Marker position={[startPoint.lat, startPoint.lng]} icon={greenIcon}>
              <Tooltip permanent direction="top" offset={[0, -38]}>AWAL</Tooltip>
            </Marker>
          )}
          {/* Marker AKHIR — hanya 1 */}
          {endPoint && (
            <Marker position={[endPoint.lat, endPoint.lng]} icon={redIcon}>
              <Tooltip permanent direction="top" offset={[0, -38]}>AKHIR</Tooltip>
            </Marker>
          )}

          {/* Polyline rute snap-to-road */}
          {polyline && (
            <Polyline positions={polyline} pathOptions={{ color: "#1e3a8a", weight: 6, opacity: 0.85 }} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
