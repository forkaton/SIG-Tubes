import { useState } from "react";
import {
  IconMousePointer, IconLocateFixed, IconXCircle, IconMapPin,
  IconLayers, IconRoute, IconBus, IconAlert, IconSearch, IconLoader,
  IconNavigation, IconArrowRight, IconRuler, IconFlag,
} from "./Icons.jsx";

export default function Sidebar({
  className = "",
  mode = "radius", onChangeMode,
  ruteList,
  selectedRute,
  onToggleRute,
  onToggleAll,
  showRute, onToggleShowRute,
  showHalte, onToggleShowHalte,
  showRusak, onToggleRusak,
  radius, onChangeRadius,
  onPickFromGPS,
  radiusResult,
  onClearRadius,
  tripA, tripB, tripResult, tripLoading,
  onResetTrip,
}) {
  const [loadingGPS, setLoadingGPS] = useState(false);

  function handleGPS() {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung Geolocation");
      return;
    }
    setLoadingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPickFromGPS({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoadingGPS(false);
      },
      (err) => { alert("Gagal ambil GPS: " + err.message); setLoadingGPS(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function badgeClass(k) {
    return k === "Beroperasi" ? "badge badge-beroperasi" : "badge badge-tidak-beroperasi";
  }

  function fmtJarak(m) {
    return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
  }

  return (
    <aside className={`sidebar ${className}`}>
      {/* ===== Pemilih Mode ===== */}
      <div className="card">
        <div className="mode-switch">
          <button
            type="button"
            className={`mode-btn ${mode === "radius" ? "active" : ""}`}
            onClick={() => onChangeMode && onChangeMode("radius")}
          >
            <IconSearch size={14} /> Cari Halte
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === "trip" ? "active" : ""}`}
            onClick={() => onChangeMode && onChangeMode("trip")}
          >
            <IconNavigation size={14} /> Rute A→B
          </button>
        </div>
      </div>

      {/* ===================== MODE: RADIUS ===================== */}
      {mode === "radius" && (
        <>
          <div className="card">
            <h2><IconSearch size={14} /> Pencarian Halte Terdekat</h2>

            <div style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              padding: 8, borderRadius: 12, fontSize: ".78rem", marginBottom: 8,
              color: "var(--text-primary)",
              display: "flex", gap: 6, alignItems: "flex-start",
              boxShadow: "var(--shadow-inner-sm)",
            }}>
              <IconMousePointer size={16} style={{ marginTop: 1, color: "var(--accent-color)" }} />
              <span><b>Klik di peta</b> untuk menentukan lokasi referensi. Lingkaran radius dan daftar halte terdekat akan tampil otomatis.</span>
            </div>

            <label>Radius: <b>{radius}</b> meter</label>
            <input type="range" min="100" max="5000" step="50"
                   value={radius} onChange={(e) => onChangeRadius(parseInt(e.target.value, 10))} />

            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button type="button" className="btn btn-secondary" onClick={handleGPS} disabled={loadingGPS}>
                {loadingGPS ? <IconLoader size={14} /> : <IconLocateFixed size={14} />}{" "}
                {loadingGPS ? "Mengambil GPS..." : "Pakai GPS"}
              </button>
              {radiusResult && (
                <button type="button" className="btn btn-danger" onClick={onClearRadius}>
                  <IconXCircle size={14} /> Reset
                </button>
              )}
            </div>

            {radiusResult && (
              <div style={{
                marginTop: 8, padding: 8,
                background: "var(--bg-tertiary)", borderRadius: 12,
                fontSize: ".78rem", fontFamily: "monospace",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: "var(--shadow-inner-sm)",
                color: "var(--text-primary)",
              }}>
                <IconMapPin size={14} color="var(--accent-color)" />
                {radiusResult.lat.toFixed(6)}, {radiusResult.lng.toFixed(6)}
              </div>
            )}
          </div>

          {radiusResult && (
            <div className="card">
              <h2>Hasil ({radiusResult.halte?.length ?? 0} halte)</h2>
              {!radiusResult.halte?.length ? (
                <div style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>
                  Tidak ada halte dalam radius {radiusResult.radius} m. Coba perbesar radius.
                </div>
              ) : (
                <ul className="result-list">
                  {radiusResult.halte.map((h) => (
                    <li key={h.id_halte}>
                      <div><b>{h.nama_halte}</b> <span className={badgeClass(h.kondisi_fisik)}>{h.kondisi_fisik}</span></div>
                      <div className="muted">{h.kode_trayek || "—"} · {Math.round(h.jarak_meter)} m</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================== MODE: TRIP A->B ===================== */}
      {mode === "trip" && (
        <div className="card">
          <h2><IconNavigation size={14} /> Rencana Perjalanan</h2>

          <div style={{
            background: "var(--bg-tertiary)", border: "1px solid var(--border-color)",
            padding: 8, borderRadius: 12, fontSize: ".78rem", marginBottom: 8,
            color: "var(--text-primary)", display: "flex", gap: 6, alignItems: "flex-start",
            boxShadow: "var(--shadow-inner-sm)",
          }}>
            <IconMousePointer size={16} style={{ marginTop: 1, color: "var(--accent-color)" }} />
            <span>Klik peta untuk titik <b>Asal (A)</b>, lalu klik lagi untuk <b>Tujuan (B)</b>. Sistem akan mencari halte terdekat & estimasi perjalanan.</span>
          </div>

          <div className="trip-points">
            <div className="trip-point">
              <span className="trip-dot" style={{ background: "#16a34a" }}>A</span>
              <span>{tripA ? `${tripA.lat.toFixed(5)}, ${tripA.lng.toFixed(5)}` : "Belum dipilih"}</span>
            </div>
            <div className="trip-point">
              <span className="trip-dot" style={{ background: "#dc2626" }}>B</span>
              <span>{tripB ? `${tripB.lat.toFixed(5)}, ${tripB.lng.toFixed(5)}` : "Belum dipilih"}</span>
            </div>
          </div>

          {(tripA || tripB) && (
            <button type="button" className="btn btn-danger" style={{ marginTop: 8 }} onClick={onResetTrip}>
              <IconXCircle size={14} /> Reset
            </button>
          )}

          {tripLoading && (
            <div style={{ marginTop: 10, fontSize: ".8rem", color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
              <IconLoader size={14} /> Menghitung rute…
            </div>
          )}

          {tripResult && !tripLoading && (
            <div className="trip-result" style={{ marginTop: 10 }}>
              <div className="trip-leg">
                <span className="trip-dot" style={{ background: "#16a34a" }}>A</span>
                <div>
                  <b>Naik:</b> {tripResult.halte_naik.nama_halte}
                  <div className="muted">{tripResult.halte_naik.kode_trayek} · jalan kaki {fmtJarak(tripResult.halte_naik.jarak_jalan_m)}</div>
                </div>
              </div>
              <div className="trip-leg">
                <span className="trip-dot" style={{ background: "#dc2626" }}>B</span>
                <div>
                  <b>Turun:</b> {tripResult.halte_turun.nama_halte}
                  <div className="muted">{tripResult.halte_turun.kode_trayek} · jalan kaki {fmtJarak(tripResult.halte_turun.jarak_jalan_m)}</div>
                </div>
              </div>

              <div className="trip-stats">
                <div className="trip-stat">
                  <IconRuler size={14} color="var(--accent-color)" />
                  <span>Total jarak</span>
                  <b>{fmtJarak(tripResult.total_jarak_m)}</b>
                </div>
                <div className="trip-stat">
                  <IconBus size={14} color="var(--accent-color)" />
                  <span>Naik bus</span>
                  <b>{fmtJarak(tripResult.naik_bus_m)}</b>
                </div>
                <div className="trip-stat">
                  <IconNavigation size={14} color="var(--accent-color)" />
                  <span>Estimasi waktu</span>
                  <b>± {tripResult.estimasi_menit} menit</b>
                </div>
              </div>

              <div style={{
                marginTop: 8, padding: 8, borderRadius: 10, fontSize: ".78rem",
                background: tripResult.satu_koridor ? "rgba(22,163,74,.12)" : "rgba(245,158,11,.12)",
                color: "var(--text-primary)", display: "flex", gap: 6, alignItems: "flex-start",
              }}>
                <IconFlag size={14} style={{ marginTop: 1 }} />
                <span>{tripResult.catatan}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Toggle Layer (selalu tampil) ===== */}
      <div className="card">
        <h2><IconLayers size={14} /> Layer Peta</h2>
        <label className="checkbox-row">
          <input type="checkbox" checked={showRute}
                 onChange={(e) => onToggleShowRute(e.target.checked)} />
          <IconRoute size={14} color="#f59e0b" />
          <span>Tampilkan Rute (LineString)</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={showHalte}
                 onChange={(e) => onToggleShowHalte(e.target.checked)} />
          <IconBus size={14} color="#10b981" />
          <span>Tampilkan Halte (Point)</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={showRusak}
                 onChange={(e) => onToggleRusak(e.target.checked)} />
          <IconAlert size={14} color="#ef4444" />
          <span>Tampilkan halte tidak beroperasi</span>
        </label>
      </div>
    </aside>
  );
}
