import { useMemo, useEffect } from "react";
import {
  MapContainer, TileLayer, GeoJSON, Marker, Popup, Circle, useMapEvents, useMap
} from "react-leaflet";
import L from "leaflet";

const PEKANBARU_CENTER = [0.5071, 101.4478];

/* ─────────────────────────────────────────
   SVG Icon factories
───────────────────────────────────────── */
function busStopPin(color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='44' viewBox='0 0 32 44'>
    <filter id='s'><feDropShadow dx='0' dy='2' stdDeviation='2' flood-opacity='.3'/></filter>
    <path filter='url(#s)' d='M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28S32 28 32 16C32 7.16 24.84 0 16 0z' fill='${color}'/>
    <circle cx='16' cy='16' r='9' fill='white' opacity='.95'/>
    <path d='M12 11.5h8v6.5h-.5l.4.9H19l-.4-.9h-3.2l-.4.9h-.9l.4-.9H14V11.5zm1.1 1.1v3.6h5.8v-3.6H13.1zm.8 5c.4 0 .6-.3.6-.6s-.3-.6-.6-.6-.6.3-.6.6.3.6.6.6zm4.2 0c.4 0 .6-.3.6-.6s-.3-.6-.6-.6-.6.3-.6.6.3.6.6.6z' fill='${color}'/>
  </svg>`;
  return new L.Icon({
    iconUrl: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize: [32, 44], iconAnchor: [16, 44], popupAnchor: [0, -40],
  });
}

function searchPin() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='48' viewBox='0 0 36 48'>
    <filter id='s'><feDropShadow dx='0' dy='2' stdDeviation='2' flood-opacity='.3'/></filter>
    <path filter='url(#s)' d='M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z' fill='#f59e0b'/>
    <circle cx='18' cy='18' r='10' fill='white' opacity='.95'/>
    <circle cx='18' cy='18' r='5' fill='#f59e0b'/>
    <path d='M23 22.5l4 4' stroke='#f59e0b' stroke-width='2' stroke-linecap='round'/>
  </svg>`;
  return new L.Icon({
    iconUrl: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize: [36, 48], iconAnchor: [18, 48], popupAnchor: [0, -44],
  });
}

function letterPin(letter, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='48' viewBox='0 0 36 48'>
    <filter id='s'><feDropShadow dx='0' dy='2' stdDeviation='2' flood-opacity='.3'/></filter>
    <path filter='url(#s)' d='M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z' fill='${color}'/>
    <circle cx='18' cy='18' r='11' fill='white' opacity='.95'/>
    <text x='18' y='23' font-size='14' font-weight='700' text-anchor='middle' fill='${color}' font-family='Inter,Arial,sans-serif'>${letter}</text>
  </svg>`;
  return new L.Icon({
    iconUrl: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize: [36, 48], iconAnchor: [18, 48], popupAnchor: [0, -44],
  });
}

/* Singleton icons — avoid recreating on every render */
const ICONS = {
  "Beroperasi":       busStopPin("#16a34a"),
  "Tidak Beroperasi": busStopPin("#dc2626"),
};
const ICON_SEARCH = searchPin();
const ICON_A      = letterPin("A", "#16a34a");
const ICON_B      = letterPin("B", "#dc2626");

/* ─────────────────────────────────────────
   Inline SVG strings for popup icons
   (can't use React components inside
   dangerouslySetInnerHTML / bindPopup)
───────────────────────────────────────── */
const SVG_BUS = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="13" rx="3"/><path d="M3 9h18M8 3v4M16 3v4M7 16v4M17 16v4"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/></svg>`;
const SVG_ROUTE = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18M3 7h18M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>`;
const SVG_PIN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
const SVG_RULER = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 8.7L8.7 21.3a2.4 2.4 0 0 1-3.4 0L2.7 18.7a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4z"/><path d="m7.5 10.5 3 3M10.5 7.5l3 3M13.5 4.5l3 3"/></svg>`;
const SVG_ARROW = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const SVG_GPS = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>`;
const SVG_SEARCH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
const SVG_MSG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

/* ─────────────────────────────────────────
   Popup HTML builders
───────────────────────────────────────── */

function haltePopupHtml(p) {
  const isOk    = p.kondisi_fisik === "Beroperasi";
  const dotClr  = isOk ? "#16a34a" : "#dc2626";
  const badgeClr = isOk
    ? "color:#15803d;background:#dcfce7;border-color:#bbf7d0"
    : "color:#b91c1c;background:#fee2e2;border-color:#fecaca";
  const warna   = p.warna_peta || "#3b82f6";
  const lat     = Number(p.latitude  || 0).toFixed(5);
  const lng     = Number(p.longitude || 0).toFixed(5);

  const trayekRow = p.kode_trayek ? `
    <div class="mpc-row">
      <dt class="mpc-label">Trayek</dt>
      <dd class="mpc-val">
        <span class="mpc-chip" style="background:${warna}20;color:${warna};border-color:${warna}40">${p.kode_trayek}</span>
        <span class="mpc-route-name">${p.nama_trayek || ""}</span>
      </dd>
    </div>` : `
    <div class="mpc-row">
      <dt class="mpc-label">Trayek</dt>
      <dd class="mpc-val mpc-muted">Tanpa rute</dd>
    </div>`;

  const keterangan = p.keterangan ? `
    <div class="mpc-note">
      <span class="mpc-note-icon">${SVG_MSG}</span>
      <span>${p.keterangan}</span>
    </div>` : "";

  return `
  <div class="mpc-card">
    <div class="mpc-header" style="border-top:3px solid ${dotClr}">
      <div class="mpc-icon-wrap" style="background:${dotClr}15;color:${dotClr}">${SVG_BUS}</div>
      <div class="mpc-title-col">
        <p class="mpc-name">${p.nama_halte || "Halte"}</p>
        <span class="mpc-badge" style="${badgeClr}">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotClr};flex-shrink:0"></span>
          ${p.kondisi_fisik || "—"}
        </span>
      </div>
    </div>
    <dl class="mpc-grid">
      ${trayekRow}
      <div class="mpc-row">
        <dt class="mpc-label">Koordinat</dt>
        <dd class="mpc-val mpc-mono">${lat}, ${lng}</dd>
      </div>
    </dl>
    ${keterangan}
  </div>`;
}

function rutePopupHtml(p) {
  const warna    = p.warna_peta || "#3b82f6";
  const panjang  = p.panjang_km != null
    ? `<div class="mpc-row">
         <dt class="mpc-label">Panjang</dt>
         <dd class="mpc-val"><b>${p.panjang_km} km</b></dd>
       </div>` : "";
  const arah = (p.titik_awal && p.titik_akhir)
    ? `<div class="mpc-row">
         <dt class="mpc-label">Arah</dt>
         <dd class="mpc-val">${p.titik_awal} <span class="mpc-arrow">→</span> ${p.titik_akhir}</dd>
       </div>` : "";

  return `
  <div class="mpc-card">
    <div class="mpc-header" style="border-top:3px solid ${warna}">
      <div class="mpc-icon-wrap" style="background:${warna}15;color:${warna}">${SVG_ROUTE}</div>
      <div class="mpc-title-col">
        <p class="mpc-name">${p.kode_trayek || "Rute"}</p>
        <span class="mpc-subtitle">${p.nama_trayek || ""}</span>
      </div>
    </div>
    <dl class="mpc-grid">
      ${arah}
      ${panjang}
    </dl>
  </div>`;
}

function radiusPopupHtml(r) {
  return `
  <div class="mpc-card">
    <div class="mpc-header" style="border-top:3px solid #f59e0b">
      <div class="mpc-icon-wrap" style="background:#fef3c720;color:#d97706">${SVG_SEARCH}</div>
      <div class="mpc-title-col">
        <p class="mpc-name">Titik Pencarian</p>
        <span class="mpc-subtitle">Radius <b>${r.radius} m</b> aktif</span>
      </div>
    </div>
    <dl class="mpc-grid">
      <div class="mpc-row">
        <dt class="mpc-label">Koordinat</dt>
        <dd class="mpc-val mpc-mono">${r.lat.toFixed(6)},&nbsp;${r.lng.toFixed(6)}</dd>
      </div>
      <div class="mpc-row">
        <dt class="mpc-label">Halte</dt>
        <dd class="mpc-val"><b>${r.halte?.length ?? 0}</b> dalam radius</dd>
      </div>
    </dl>
  </div>`;
}

function tripPinPopupHtml(letter, color, label, lat, lng) {
  return `
  <div class="mpc-card mpc-card--compact">
    <div class="mpc-header" style="border-top:3px solid ${color}">
      <div class="mpc-dot-letter" style="background:${color}">${letter}</div>
      <div class="mpc-title-col">
        <p class="mpc-name">${label}</p>
        <span class="mpc-subtitle mpc-mono">${lat.toFixed(5)},&nbsp;${lng.toFixed(5)}</span>
      </div>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────
   Inner map components
───────────────────────────────────────── */
function ClickToSearch({ onMapClick }) {
  useMapEvents({ click(e) { onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function MapPanner({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo([pos.lat, pos.lng], pos.zoom || 16, { animate: true, duration: 1.5 });
  }, [pos, map]);
  return null;
}

/* ─────────────────────────────────────────
   Main MapView
───────────────────────────────────────── */
export default function MapView({
  ruteFc, halteFc, selectedRute,
  showHalte = true, showRute = true, showRusak = true,
  radiusResult, onMapClick,
  mode = "radius", tripA, tripB, tripResult,
  theme = "light", panToPos,
}) {
  const ruteFiltered = useMemo(() => ({
    type: "FeatureCollection",
    features: showRute
      ? ruteFc.features.filter((f) => selectedRute.has(f.properties.id_rute))
      : [],
  }), [ruteFc, selectedRute, showRute]);

  const halteFiltered = useMemo(() => {
    if (!showHalte) return [];
    return halteFc.features.filter((f) => {
      if (!showRusak && f.properties.kondisi_fisik === "Tidak Beroperasi") return false;
      return true;
    });
  }, [halteFc, showHalte, showRusak]);

  const ruteKey     = `rute-${ruteFc.features.length}-${showRute}-${Array.from(selectedRute).sort().join(",")}-${mode}-${!!tripResult}-${theme}`;
  const rideColor   = theme === "dark" ? "#f59e0b" : "#3b82f6";
  const isDark      = theme === "dark";

  /* Tile URLs — Voyager (Google Maps feel) for light, Dark Matter for dark */
  const tileUrl  = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const tileAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

  const popupOpts = { maxWidth: 300, className: "mpc-popup" };

  return (
    <MapContainer center={PEKANBARU_CENTER} zoom={12} scrollWheelZoom style={{ cursor: "crosshair" }}>
      <TileLayer url={tileUrl} attribution={tileAttr} maxZoom={19} />

      <ClickToSearch onMapClick={onMapClick} />
      <MapPanner pos={panToPos} />

      {/* ── Rute lines ── */}
      {showRute && ruteFiltered.features.length > 0 && (
        <GeoJSON
          key={ruteKey}
          data={ruteFiltered}
          style={(f) => ({
            color:   f.properties.warna_peta || "#3388ff",
            weight:  mode === "trip" && tripResult ? 3 : 5,
            opacity: mode === "trip" && tripResult ? 0.25 : 0.9,
            lineCap: "round", lineJoin: "round",
          })}
          onEachFeature={(feature, layer) => {
            layer.bindPopup(rutePopupHtml(feature.properties), popupOpts);
          }}
        />
      )}

      {/* ── Halte markers ── */}
      {halteFiltered.map((f) => {
        const [lng, lat] = f.geometry.coordinates;
        const p = { ...f.properties, latitude: lat, longitude: lng };
        return (
          <Marker key={p.id_halte} position={[lat, lng]}
                  icon={ICONS[p.kondisi_fisik] || ICONS["Beroperasi"]}>
            <Popup {...popupOpts}>
              <div dangerouslySetInnerHTML={{ __html: haltePopupHtml(p) }} />
            </Popup>
          </Marker>
        );
      })}

      {/* ── Radius circle + search pin ── */}
      {mode === "radius" && radiusResult && (
        <>
          <Circle
            center={[radiusResult.lat, radiusResult.lng]}
            radius={radiusResult.radius}
            pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.08, weight: 2, dashArray: "6 8" }}
          />
          <Marker position={[radiusResult.lat, radiusResult.lng]} icon={ICON_SEARCH}>
            <Popup {...popupOpts}>
              <div dangerouslySetInnerHTML={{ __html: radiusPopupHtml(radiusResult) }} />
            </Popup>
          </Marker>
        </>
      )}

      {/* ── Trip ride line ── */}
      {mode === "trip" && tripResult?.ride_geojson && (
        <>
          <GeoJSON
            key={`ride-halo-${tripResult.halte_naik?.id_halte}`}
            data={tripResult.ride_geojson}
            style={{ color: "#fff", weight: 10, opacity: 0.85, lineCap: "round" }}
          />
          <GeoJSON
            key={`ride-${tripResult.halte_naik?.id_halte}`}
            data={tripResult.ride_geojson}
            style={{ color: rideColor, weight: 5, opacity: 1, lineCap: "round" }}
          />
        </>
      )}

      {/* ── Trip A/B pins ── */}
      {mode === "trip" && tripA && (
        <Marker position={[tripA.lat, tripA.lng]} icon={ICON_A}>
          <Popup {...popupOpts}>
            <div dangerouslySetInnerHTML={{ __html: tripPinPopupHtml("A", "#16a34a", "Titik Asal", tripA.lat, tripA.lng) }} />
          </Popup>
        </Marker>
      )}
      {mode === "trip" && tripB && (
        <Marker position={[tripB.lat, tripB.lng]} icon={ICON_B}>
          <Popup {...popupOpts}>
            <div dangerouslySetInnerHTML={{ __html: tripPinPopupHtml("B", "#dc2626", "Titik Tujuan", tripB.lat, tripB.lng) }} />
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
