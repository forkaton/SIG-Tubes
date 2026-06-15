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
  onResetTrip, onHalteClick,
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

            <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "8px", display: "block" }}>Radius: <b>{radius}</b> meter</label>
            <input type="range" min="100" max="5000" step="50"
                   className="custom-range"
                   style={{ backgroundSize: `${((radius - 100) * 100) / 4900}% 100%` }}
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
                    <li key={h.id_halte} onClick={() => onHalteClick?.(h)}>
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
              <span className="trip-dot" style={{ background: "#10b981" }}>A</span>
              <span className="trip-coords">{tripA ? `${tripA.lat.toFixed(5)}, ${tripA.lng.toFixed(5)}` : "Pilih di peta"}</span>
            </div>
            <div className="trip-point">
              <span className="trip-dot" style={{ background: "#ef4444" }}>B</span>
              <span className="trip-coords">{tripB ? `${tripB.lat.toFixed(5)}, ${tripB.lng.toFixed(5)}` : "Pilih di peta"}</span>
            </div>
          </div>

          {(tripA || tripB) && (
            <button type="button" className="btn btn-secondary" style={{ marginTop: 12, width: "100%" }} onClick={onResetTrip}>
              <IconXCircle size={14} /> Reset Titik Asal & Tujuan
            </button>
          )}

          {tripLoading && (
            <div style={{ marginTop: 16, fontSize: "0.9rem", color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <IconLoader size={18} className="spin" /> Menghitung rute terbaik...
            </div>
          )}

          {tripResult && !tripLoading && (
            <div className="trip-result">
              <div className="trip-leg">
                <span className="trip-dot" style={{ background: "#10b981" }}>A</span>
                <div className="trip-leg-info">
                  <span className="leg-label">Berangkat dari</span>
                  <b>{tripResult.halte_naik.nama_halte}</b>
                  <div className="muted">
                    <span className="badge-trayek">{tripResult.halte_naik.kode_trayek}</span>
                    <span>Jalan kaki {fmtJarak(tripResult.halte_naik.jarak_jalan_m)}</span>
                  </div>
                </div>
              </div>

              <div className="trip-leg">
                <span className="trip-dot" style={{ background: "#ef4444" }}>B</span>
                <div className="trip-leg-info">
                  <span className="leg-label">Tiba di</span>
                  <b>{tripResult.halte_turun.nama_halte}</b>
                  <div className="muted">
                    <span className="badge-trayek">{tripResult.halte_turun.kode_trayek}</span>
                    <span>Jalan kaki {fmtJarak(tripResult.halte_turun.jarak_jalan_m)}</span>
                  </div>
                </div>
              </div>

              <div className="trip-stats">
                <div className="trip-stat">
                  <IconRuler size={16} color="var(--accent-color)" />
                  <span>Total Jarak</span>
                  <b>{fmtJarak(tripResult.total_jarak_m)}</b>
                </div>
                <div className="trip-stat">
                  <IconBus size={16} color="var(--accent-color)" />
                  <span>Naik Bus</span>
                  <b>{fmtJarak(tripResult.naik_bus_m)}</b>
                </div>
                <div className="trip-stat">
                  <IconNavigation size={16} color="var(--accent-color)" />
                  <span>Estimasi</span>
                  <b>{tripResult.estimasi_menit} mnt</b>
                </div>
              </div>

              <div className={`trip-alert ${tripResult.satu_koridor ? "success" : "warning"}`}>
                <IconFlag size={16} style={{ marginTop: 2, flexShrink: 0 }} color={tripResult.satu_koridor ? "#10b981" : "#f59e0b"} />
                <span>{tripResult.catatan}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Toggle Layer (selalu tampil) ===== */}
      <div className="card">
        <h2><IconLayers size={16} /> Layer Peta</h2>
        <div className="layer-list">
          <label className="checkbox-row">
            <div className="checkbox-left">
              <IconRoute size={18} color="#f59e0b" />
              <span>Rute Bus (LineString)</span>
            </div>
            <div className="toggle-switch">
              <input type="checkbox" checked={showRute}
                     onChange={(e) => onToggleShowRute(e.target.checked)} />
              <span className="toggle-slider"></span>
            </div>
          </label>
          <label className="checkbox-row">
            <div className="checkbox-left">
              <IconBus size={18} color="#10b981" />
              <span>Titik Halte (Point)</span>
            </div>
            <div className="toggle-switch">
              <input type="checkbox" checked={showHalte}
                     onChange={(e) => onToggleShowHalte(e.target.checked)} />
              <span className="toggle-slider"></span>
            </div>
          </label>
          <label className="checkbox-row">
            <div className="checkbox-left">
              <IconAlert size={18} color="#ef4444" />
              <span>Halte Tidak Beroperasi</span>
            </div>
            <div className="toggle-switch">
              <input type="checkbox" checked={showRusak}
                     onChange={(e) => onToggleRusak(e.target.checked)} />
              <span className="toggle-slider"></span>
            </div>
          </label>
        </div>
      </div>
    </aside>
  );
}
