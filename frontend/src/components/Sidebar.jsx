import { useState } from "react";
import {
  IconMousePointer, IconLocateFixed, IconXCircle, IconMapPin,
  IconLayers, IconRoute, IconBus, IconAlert, IconSearch, IconLoader,
} from "./Icons.jsx";

export default function Sidebar({
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
    return k === "Baik" ? "badge badge-baik"
         : k === "Rusak" ? "badge badge-rusak"
         : "badge badge-terbengkalai";
  }

  const allChecked = ruteList.length > 0 && selectedRute.size === ruteList.length;

  return (
    <aside className="sidebar">
      {/* ===== Pencarian Halte Terdekat ===== */}
      <div className="card">
        <h2><IconSearch size={14} /> Pencarian Halte Terdekat</h2>

        <div style={{
          background: "#dbeafe", border: "1px solid #93c5fd", padding: 8,
          borderRadius: 6, fontSize: ".78rem", marginBottom: 8, color: "#1e3a8a",
          display: "flex", gap: 6, alignItems: "flex-start",
        }}>
          <IconMousePointer size={16} style={{ marginTop: 1 }} />
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
            marginTop: 8, padding: 8, background: "#f0f9ff", borderRadius: 6,
            fontSize: ".78rem", fontFamily: "monospace",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <IconMapPin size={14} color="#1e3a8a" />
            {radiusResult.lat.toFixed(6)}, {radiusResult.lng.toFixed(6)}
          </div>
        )}
      </div>

      {/* ===== Hasil pencarian ===== */}
      {radiusResult && (
        <div className="card">
          <h2>Hasil ({radiusResult.halte?.length ?? 0} halte)</h2>
          {!radiusResult.halte?.length ? (
            <div style={{ fontSize: ".8rem", color: "#6b7280" }}>
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

      {/* ===== Toggle Layer ===== */}
      <div className="card">
        <h2><IconLayers size={14} /> Layer Peta</h2>
        <label className="checkbox-row">
          <input type="checkbox" checked={showRute}
                 onChange={(e) => onToggleShowRute(e.target.checked)} />
          <IconRoute size={14} color="#1e3a8a" />
          <span>Tampilkan Rute (LineString)</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={showHalte}
                 onChange={(e) => onToggleShowHalte(e.target.checked)} />
          <IconBus size={14} color="#16a34a" />
          <span>Tampilkan Halte (Point)</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={showRusak}
                 onChange={(e) => onToggleRusak(e.target.checked)} />
          <IconAlert size={14} color="#dc2626" />
          <span>Tampilkan halte tidak beroperasi</span>
        </label>
      </div>

      {/* ===== Filter per-rute ===== */}
      <div className="card">
        <h2><IconRoute size={14} /> Filter Rute TMP ({ruteList.length})</h2>
        <label className="checkbox-row">
          <input type="checkbox" checked={allChecked}
                 onChange={(e) => onToggleAll(e.target.checked)} />
          <span><b>Semua Rute</b></span>
        </label>
        <div style={{ borderTop: "1px solid #e5e7eb", margin: "6px 0" }} />
        {ruteList.map((r) => (
          <label key={r.id_rute} className="checkbox-row">
            <input type="checkbox"
                   checked={selectedRute.has(r.id_rute)}
                   onChange={() => onToggleRute(r.id_rute)} />
            <span className="swatch" style={{ background: r.warna_peta }} />
            <span>{r.kode_trayek} · {r.titik_awal} – {r.titik_akhir}</span>
          </label>
        ))}
      </div>

      <div className="card" style={{ fontSize: ".72rem", color: "#6b7280" }}>
        Backend: FastAPI sinkron + PostGIS (raw SQL).
        Snap-to-road via OSRM saat menambah rute baru.
      </div>
    </aside>
  );
}
