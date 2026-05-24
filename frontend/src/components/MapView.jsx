import { useMemo } from "react";
import {
  MapContainer, TileLayer, GeoJSON, Marker, Popup, Circle, useMapEvents,
} from "react-leaflet";
import L from "leaflet";

const PEKANBARU_CENTER = [0.5071, 101.4478];

function badgeClass(k) {
  return k === "Beroperasi" ? "badge badge-beroperasi" : "badge badge-tidak-beroperasi";
}

/** Custom SVG bus-stop pin sebagai data URI — definitely terlihat,
 *  tampilan profesional konsisten lintas browser. */
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
    <path d='M17 0C7.6 0 0 7.6 0 17c0 12.75 17 29 17 29s17-16.25 17-29C34 7.6 26.4 0 17 0z' fill='#1e3a8a' stroke='white' stroke-width='2.5'/>
    <circle cx='17' cy='17' r='9' fill='white'/>
    <circle cx='17' cy='17' r='5' fill='#1e3a8a'/>
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

function ClickToSearch({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function MapView({
  ruteFc, halteFc, selectedRute,
  showHalte = true, showRute = true, showRusak = true,
  radiusResult, onMapClick,
}) {
  // Rute: tergantung selectedRute + showRute
  const ruteFiltered = useMemo(() => ({
    type: "FeatureCollection",
    features: showRute
      ? ruteFc.features.filter((f) => selectedRute.has(f.properties.id_rute))
      : [],
  }), [ruteFc, selectedRute, showRute]);

  // Halte: HANYA tergantung showHalte + showRusak (INDEPENDEN dari filter rute)
  const halteFiltered = useMemo(() => {
    if (!showHalte) return [];
    return halteFc.features.filter((f) => {
      const k = f.properties.kondisi_fisik;
      if (!showRusak && k === "Tidak Beroperasi") return false;
      return true;
    });
  }, [halteFc, showHalte, showRusak]);

  const ruteKey = `rute-${ruteFc.features.length}-${showRute}-${Array.from(selectedRute).sort().join(",")}`;

  return (
    <MapContainer center={PEKANBARU_CENTER} zoom={12} scrollWheelZoom style={{ cursor: "crosshair" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickToSearch onMapClick={onMapClick} />

      {/* === Rute (LineString) === */}
      {showRute && ruteFiltered.features.length > 0 && (
        <GeoJSON
          key={ruteKey}
          data={ruteFiltered}
          style={(f) => ({
            color: f.properties.warna_peta || "#3388ff",
            weight: 6, opacity: 0.85,
          })}
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

      {/* === Lingkaran radius === */}
      {radiusResult && (
        <>
          <Circle
            center={[radiusResult.lat, radiusResult.lng]}
            radius={radiusResult.radius}
            pathOptions={{ color: "#1e3a8a", fillOpacity: 0.1, weight: 2, dashArray: "4 6" }}
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
    </MapContainer>
  );
}
