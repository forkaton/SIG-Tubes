// Helper fetch ringan untuk REST API FastAPI
const BASE = import.meta.env.VITE_API_BASE || "/api/v1";

function buildUrl(path, params = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([_, v]) =>
      v !== undefined && v !== null && v !== ""
    )
  );
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `${path}?${qs}` : path;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ===== Rute =====
  listRute:        ()       => request("/rute"),
  ruteGeojsonAll:  ()       => request("/rute/geojson"),
  ruteGeojson:     (id)     => request(`/rute/${id}/geojson`),
  createRute:      (body)   => request("/rute",       { method: "POST",   body: JSON.stringify(body) }),
  updateRute:      (id, b)  => request(`/rute/${id}`, { method: "PUT",    body: JSON.stringify(b) }),
  deleteRute:      (id)     => request(`/rute/${id}`, { method: "DELETE" }),

  // ===== Halte =====
  listHalte:       (p = {}) => request(buildUrl("/halte", p)),
  halteGeojson:    (p = {}) => request(buildUrl("/halte/geojson", p)),
  halteRadius:     (lat, lng, r = 500) =>
    request(buildUrl("/halte/radius", { lat, lng, radius: r })),
  createHalte:     (body)     => request("/halte",       { method: "POST",   body: JSON.stringify(body) }),
  updateHalte:     (id, body) => request(`/halte/${id}`, { method: "PUT",    body: JSON.stringify(body) }),
  deleteHalte:     (id)       => request(`/halte/${id}`, { method: "DELETE" }),

  // ===== Trip Planner =====
  planTrip:        (fromLat, fromLng, toLat, toLng) =>
    request(buildUrl("/trip", {
      from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng,
    })),
};

/**
 * Snap-to-road menggunakan OSRM public API (multi-waypoint).
 * Mengembalikan GeoJSON LineString yang mengikuti jalan raya.
 */
export async function osrmRouteMulti(waypoints) {
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
