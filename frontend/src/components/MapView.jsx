import { useMemo, useEffect } from "react";
import {
  MapContainer, TileLayer, GeoJSON, Marker, Popup, Circle, useMapEvents, useMap
} from "react-leaflet";
import L from "leaflet";

const PEKANBARU_CENTER = [0.5071, 101.4478];

function badgeClass(k) {
  return k === "Beroperasi" ? "badge badge-beroperasi" : "badge badge-tidak-beroperasi";
}

function busStopPinIcon(color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='42' viewBox='0 0 30 42'>
    <path d='M15 0C6.72 0 0 6.72 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.72 23.28 0 15 0z' fill='${color}' stroke='white' stroke-width='2'/>
    <circle cx='15' cy='15' r='8' fill='white'/>
    <path d='M11.5 11.5h7v5.5h-.4l.3.7h-.7l-.3-.7h-3l-.3.7h-.7l.3-.7h-.4v-5.5zm1 1v3h5v-3h-5zm.7 4.2c.3 0 .5-.2.5-.5s-.2-.5-.5-.5-.5.2-.5.5.2.5.5.5zm3.6 0c.3 0 .5-.2.5-.5s-.2-.5-.5-.5-.5.2-.5.5.2.5.5.5z' fill='${color}'/>
  </svg>`;
  return new L.Icon({
    iconUrl:     "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize:    [30, 42],
    iconAnchor:  [15, 42],
    popupAnchor: [0, -38],
  });
}

function searchPinIcon() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='34' height='46' viewBox='0 0 34 46'>
    <path d='M17 0C7.6 0 0 7.6 0 17c0 12.75 17 29 17 29s17-16.25 17-29C34 7.6 26.4 0 17 0z' fill='#f59e0b' stroke='white' stroke-width='2.5'/>
    <circle cx='17' cy='17' r='9' fill='white'/>
    <circle cx='17' cy='17' r='5' fill='#f59e0b'/>
  </svg>`;
  return new L.Icon({
    iconUrl:     "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize:    [34, 46],
    iconAnchor:  [17, 46],
    popupAnchor: [0, -42],
  });
}

/** Pin huruf (A / B) untuk titik trip */
function letterPinIcon(letter, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='34' height='46' viewBox='0 0 34 46'>
    <path d='M17 0C7.6 0 0 7.6 0 17c0 12.75 17 29 17 29s17-16.25 17-29C34 7.6 26.4 0 17 0z' fill='${color}' stroke='white' stroke-width='2.5'/>
    <circle cx='17' cy='17' r='10' fill='white'/>
    <text x='17' y='22' font-size='14' font-weight='bold' text-anchor='middle' fill='${color}' font-family='Arial,sans-serif'>${letter}</text>
  </svg>`;
  return new L.Icon({
    iconUrl:     "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize:    [34, 46],
    iconAnchor:  [17, 46],
    popupAnchor: [0, -42],
  });
}

const ICONS = {
  "Beroperasi":       busStopPinIcon("#16a34a"),
  "Tidak Beroperasi": busStopPinIcon("#dc2626"),
};
const ICON_SEARCH = searchPinIcon();
const ICON_A = letterPinIcon("A", "#16a34a");
const ICON_B = letterPinIcon("B", "#dc2626");

function ClickToSearch({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapPanner({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) {
      map.flyTo([pos.lat, pos.lng], pos.zoom || 16, { animate: true, duration: 1.5 });
    }
  }, [pos, map]);
  return null;
}

export default function MapView({
  ruteFc, halteFc, selectedRute,
  showHalte = true, showRute = true, showRusak = true,
  radiusResult, onMapClick,
  mode = "radius", tripA, tripB, tripResult,
  theme = "dark", panToPos,
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
      const k = f.properties.kondisi_fisik;
      if (!showRusak && k === "Tidak Beroperasi") return false;
      return true;
    });
  }, [halteFc, showHalte, showRusak]);

  const ruteKey = `rute-${ruteFc.features.length}-${showRute}-${Array.from(selectedRute).sort().join(",")}-${mode}-${tripResult ? 'active' : 'inactive'}-${theme}`;
  const absoluteColor = theme === "dark" ? "#f59e0b" : "#3b82f6";
  const rideColor = absoluteColor;

  return (
    <MapContainer center={PEKANBARU_CENTER} zoom={12} scrollWheelZoom style={{ cursor: "crosshair" }}>
      {theme === "dark" ? (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}

      <ClickToSearch onMapClick={onMapClick} />
      <MapPanner pos={panToPos} />

      {/* === Rute (LineString) === */}
      {showRute && ruteFiltered.features.length > 0 && (
        <GeoJSON
          key={ruteKey}
          data={ruteFiltered}
          style={(f) => {
            const isTripModeActive = mode === "trip" && tripResult;
            return {
              color: f.properties.warna_peta || "#3388ff",
              weight: isTripModeActive ? 4 : 6, 
              opacity: isTripModeActive ? 0.3 : 0.85,
            };
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties;
            layer.bindPopup(`
              <div class="popup-row">
                <b>${p.kode_trayek} · ${p.nama_trayek}</b><br/>
                ${p.titik_awal} &rarr; ${p.titik_akhir}<br/>
                Panjang: <b>${p.panjang_km ?? "?"} km</b>
              </div>
            `);
          }}
        />
      )}

      {/* === Halte (SVG bus-stop pin) === */}
      {halteFiltered.map((f) => {
        const [lng, lat] = f.geometry.coordinates;
        const p = f.properties;
        return (
          <Marker
            key={p.id_halte}
            position={[lat, lng]}
            icon={ICONS[p.kondisi_fisik] || ICONS["Beroperasi"]}
          >
            <Popup>
              <div className="popup-row">
                <b>{p.nama_halte}</b>{" "}
                <span className={badgeClass(p.kondisi_fisik)}>{p.kondisi_fisik}</span><br/>
                {p.nama_jalan && <>{p.nama_jalan}<br/></>}
                {p.kode_trayek && <>{p.kode_trayek} &middot; {p.nama_trayek}<br/></>}
                {p.keterangan && <em style={{ color: "#6b7280" }}>{p.keterangan}</em>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* === Lingkaran radius (mode radius) === */}
      {mode === "radius" && radiusResult && (
        <>
          <Circle
            center={[radiusResult.lat, radiusResult.lng]}
            radius={radiusResult.radius}
            pathOptions={{ color: "#f59e0b", fillOpacity: 0.15, weight: 2, dashArray: "4 6" }}
          />
          <Marker position={[radiusResult.lat, radiusResult.lng]} icon={ICON_SEARCH}>
            <Popup>
              <div className="popup-row">
                <b>Titik Pencarian</b><br/>
                Lat: {radiusResult.lat.toFixed(6)}<br/>
                Lng: {radiusResult.lng.toFixed(6)}<br/>
                Radius: {radiusResult.radius} m<br/>
                Halte ditemukan: <b>{radiusResult.halte?.length ?? 0}</b>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {/* === Trip A->B (mode trip) === */}
      {mode === "trip" && tripResult?.ride_geojson && (
        <>
          {/* halo putih di bawah agar jalur menonjol */}
          <GeoJSON key={`ride-halo-${tripResult.halte_naik?.id_halte}-${tripResult.halte_turun?.id_halte}`}
                   data={tripResult.ride_geojson}
                   style={{ color: "#ffffff", weight: 11, opacity: 0.9 }} />
          <GeoJSON key={`ride-${tripResult.halte_naik?.id_halte}-${tripResult.halte_turun?.id_halte}`}
                   data={tripResult.ride_geojson}
                   style={{ color: rideColor, weight: 6, opacity: 1 }} />
        </>
      )}
      {mode === "trip" && tripA && (
        <Marker position={[tripA.lat, tripA.lng]} icon={ICON_A}>
          <Popup><b>Titik Asal (A)</b></Popup>
        </Marker>
      )}
      {mode === "trip" && tripB && (
        <Marker position={[tripB.lat, tripB.lng]} icon={ICON_B}>
          <Popup><b>Titik Tujuan (B)</b></Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
