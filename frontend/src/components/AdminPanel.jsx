import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import HaltePicker from "./HaltePicker.jsx";
import RutePicker  from "./RutePicker.jsx";
import {
  IconBus, IconRoute, IconRefresh, IconBarChart, IconXCircle, IconAlert,
  IconEdit, IconTrash, IconPlus, IconRuler, IconLoader,
} from "./Icons.jsx";

export default function AdminPanel({ onChanged }) {
  const [tab, setTab] = useState("halte");

  return (
    <div className="admin">
      <div className="admin-header">
        <h2>Panel Administrasi</h2>
        <p>Kelola data Halte dan Rute Trans Metro Pekanbaru</p>
      </div>

      <div className="admin-tabs">
        <button 
          onClick={() => setTab("halte")} 
          className={`admin-tab-btn ${tab === "halte" ? "active" : ""}`}
        >
          <IconBus size={16} /> Halte
        </button>
        <button 
          onClick={() => setTab("rute")}  
          className={`admin-tab-btn ${tab === "rute" ? "active" : ""}`}
        >
          <IconRoute size={16} /> Rute
        </button>
      </div>

      <div className="admin-content">
        {tab === "halte"
          ? <HalteCrud onChanged={onChanged} />
          : <RuteCrud  onChanged={onChanged} />}
      </div>
    </div>
  );
}

function RefreshButton({ onClick, loading }) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      disabled={loading}
      className="admin-action-btn success"
    >
      {loading ? <IconLoader size={14} /> : <IconRefresh size={14} />}
      {loading ? "Memuat..." : "Refresh"}
    </button>
  );
}

function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="admin-error-box">
      <div className="error-content">
        <IconXCircle size={16} /> <b>Error memuat data:</b> {error}
      </div>
      <button onClick={onRetry} className="admin-action-btn danger">
        Coba Ulang
      </button>
    </div>
  );
}

// ============================================================
// CRUD HALTE
// ============================================================
function HalteCrud({ onChanged }) {
  const [halteList, setHalteList] = useState([]);
  const [ruteList,  setRuteList]  = useState([]);
  const [ruteFc,    setRuteFc]    = useState({ type: "FeatureCollection", features: [] });
  const [editing,   setEditing]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const empty = {
    nama_halte: "", id_rute_pelintas: "",
    kondisi_fisik: "Beroperasi", keterangan: "",
  };
  const [form, setForm]   = useState(empty);
  const [coords, setCoords] = useState(null);

  async function reload() {
    setLoading(true); setError(null);
    const [hlR, rlR, rfcR] = await Promise.allSettled([
      api.listHalte(), api.listRute(), api.ruteGeojsonAll(),
    ]);
    const errors = [];
    if (hlR.status === "fulfilled") setHalteList(hlR.value);
    else errors.push("listHalte: " + hlR.reason.message);
    if (rlR.status === "fulfilled") setRuteList(rlR.value);
    else errors.push("listRute: " + rlR.reason.message);
    if (rfcR.status === "fulfilled") setRuteFc(rfcR.value);
    else errors.push("ruteGeojsonAll: " + rfcR.reason.message);
    if (errors.length) setError(errors.join(" | "));
    setLoading(false);
  }
  useEffect(() => { reload(); }, []);

  function onEdit(h) {
    setEditing(h.id_halte);
    setForm({
      nama_halte:       h.nama_halte || "",
      id_rute_pelintas: h.id_rute_pelintas ? String(h.id_rute_pelintas) : "",
      kondisi_fisik:    h.kondisi_fisik === "Beroperasi" ? "Beroperasi" : "Tidak Beroperasi",
      keterangan:       h.keterangan || "",
    });
    setCoords({ lat: h.latitude, lng: h.longitude });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onCancel() { setEditing(null); setForm(empty); setCoords(null); }

  async function onSubmit(e) {
    e.preventDefault();
    if (!coords) { alert("Klik peta untuk memilih koordinat halte"); return; }
    const payload = {
      ...form,
      nama_jalan: null,
      id_rute_pelintas: form.id_rute_pelintas ? parseInt(form.id_rute_pelintas, 10) : null,
      latitude:  coords.lat,
      longitude: coords.lng,
    };
    try {
      if (editing) await api.updateHalte(editing, payload);
      else         await api.createHalte(payload);
      onCancel();
      await reload();
      onChanged?.();
    } catch (err) { alert(err.message); }
  }

  async function onDelete(id) {
    if (!confirm("Yakin hapus halte ini?")) return;
    try { await api.deleteHalte(id); await reload(); onChanged?.(); }
    catch (err) { alert(err.message); }
  }

  const restrictToRuteId = form.id_rute_pelintas ? parseInt(form.id_rute_pelintas, 10) : null;

  return (
    <div className="admin-crud-container">
      {/* ── CARD ATAS: Form & Peta ── */}
      <div className="admin-top-split">
        <div className="admin-form-side">
          <div className="admin-section-header">
            <h3>
              {editing 
                ? <><IconEdit size={18} /> Edit Halte #{editing}</> 
                : <><IconPlus size={18} /> Tambah Halte Baru</>}
            </h3>
            <div className="admin-header-actions">
              <RefreshButton onClick={reload} loading={loading} />
            </div>
          </div>

          <ErrorBox error={error} onRetry={reload} />

          <form onSubmit={onSubmit} className="admin-form-card">
            <div className="form-group">
              <label className="admin-form-label">Tautkan ke Rute (Opsional)</label>
              <select 
                className="admin-form-input"
                value={form.id_rute_pelintas}
                onChange={(e) => setForm({ ...form, id_rute_pelintas: e.target.value })}
              >
                <option value="">— Tanpa rute (bebas klik di mana saja) —</option>
                {ruteList.map((r) => (
                  <option key={r.id_rute} value={r.id_rute}>
                    {r.kode_trayek} — {r.nama_trayek}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid">
              <div className="full form-group">
                <label className="admin-form-label">Nama Halte</label>
                <input 
                  required 
                  className="admin-form-input"
                  placeholder="Contoh: Halte Sudirman 1"
                  value={form.nama_halte}
                  onChange={(e) => setForm({ ...form, nama_halte: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label className="admin-form-label">Kondisi</label>
                <select 
                  className="admin-form-input"
                  value={form.kondisi_fisik}
                  onChange={(e) => setForm({ ...form, kondisi_fisik: e.target.value })}
                >
                  <option value="Beroperasi">Beroperasi</option>
                  <option value="Tidak Beroperasi">Tidak Beroperasi</option>
                </select>
              </div>
              <div className="full form-group">
                <label className="admin-form-label">Keterangan Tambahan</label>
                <textarea 
                  rows={2} 
                  className="admin-form-input"
                  placeholder="Catatan..."
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })} 
                />
              </div>
            </div>

            <div className="admin-form-actions">
              <button type="submit" className="admin-btn-primary">
                {editing ? <><IconEdit size={16} /> Simpan Perubahan</> : <><IconPlus size={16} /> Tambah Halte</>}
              </button>
              {editing && (
                <button type="button" onClick={onCancel} className="admin-btn-secondary">
                  <IconXCircle size={16} /> Batal
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="admin-map-side">
          <HaltePicker
            value={coords}
            onChange={setCoords}
            ruteFc={ruteFc}
            restrictToRuteId={restrictToRuteId}
            height="100%"
          />
        </div>
      </div>

      {/* ── CARD BAWAH: Tabel Full Width ── */}
      <div className="admin-bottom-table">
        <div className="admin-table-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Daftar Halte Tersimpan ({halteList.length})</h3>
          <span className="admin-stat-badge">
            <IconBarChart size={14} /> Total Halte: <b>{halteList.length}</b>
          </span>
        </div>
        
        {halteList.length === 0 ? (
          <div className="warning-box trip-alert warning">
            <IconAlert size={16} style={{flexShrink:0, marginTop:2}} />
            <span>Tabel halte kosong. Klik <b>Refresh</b> atau jalankan migrasi backend.</span>
          </div>
        ) : (
          <div className="admin-table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nama Halte</th>
                  <th>Rute</th>
                  <th>Kondisi</th>
                  <th>Koordinat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {halteList.map((h) => (
                  <tr key={h.id_halte} className={editing === h.id_halte ? "editing-row" : ""}>
                    <td>{h.id_halte}</td>
                    <td><strong>{h.nama_halte}</strong></td>
                    <td>{h.kode_trayek || <span className="text-muted">—</span>}</td>
                    <td>
                      <span className={`badge badge-${(h.kondisi_fisik || "").toLowerCase().replace(/\s+/g, "-")}`}>
                        {h.kondisi_fisik}
                      </span>
                    </td>
                    <td className="coord-cell">
                      {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}
                    </td>
                    <td>
                      <div className="actions">
                        <button onClick={() => onEdit(h)} className="admin-table-action edit">
                          <IconEdit size={14} /> Edit
                        </button>
                        <button onClick={() => onDelete(h.id_halte)} className="admin-table-action delete">
                          <IconTrash size={14} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CRUD RUTE
// ============================================================
function RuteCrud({ onChanged }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const empty = { kode_trayek: "", nama_trayek: "", warna_peta: "#3b82f6" };
  const [form, setForm]     = useState(empty);
  const [picker, setPicker] = useState(null);
  const [editing, setEditing] = useState(null);
  const [refLineString, setRefLineString] = useState(null);

  async function reload() {
    setLoading(true); setError(null);
    try { setList(await api.listRute()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  function onCancel() {
    setEditing(null);
    setForm(empty);
    setPicker(null);
    setRefLineString(null);
  }

  async function onEdit(r) {
    setEditing(r.id_rute);
    setForm({
      kode_trayek: r.kode_trayek,
      nama_trayek: r.nama_trayek,
      warna_peta:  r.warna_peta,
    });
    setPicker(null);
    try {
      const feat = await api.ruteGeojson(r.id_rute);
      setRefLineString(feat.geometry);
    } catch (err) {
      console.error("Gagal load geometri:", err);
      setRefLineString(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (editing) {
      const payload = { ...form };
      if (picker?.lineString) payload.geometri_jalur = picker.lineString;
      try {
        await api.updateRute(editing, payload);
        onCancel();
        await reload();
        onChanged?.();
      } catch (err) { alert(err.message); }
    } else {
      if (!picker?.lineString) {
        alert("Klik peta untuk menggambar rute (minimal 2 waypoint)");
        return;
      }
      try {
        await api.createRute({ ...form, geometri_jalur: picker.lineString });
        onCancel();
        await reload();
        onChanged?.();
      } catch (err) { alert(err.message); }
    }
  }

  async function onDelete(id) {
    if (!confirm("Yakin hapus rute ini? Halte yang tertaut akan kehilangan referensi.")) return;
    try { await api.deleteRute(id); await reload(); onChanged?.(); }
    catch (err) { alert(err.message); }
  }

  const panjangKmEstimasi = useMemo(() => {
    if (!picker?.lineString) return null;
    const c = picker.lineString.coordinates;
    let m = 0;
    for (let i = 1; i < c.length; i++) {
      const [lng1, lat1] = c[i-1], [lng2, lat2] = c[i];
      const R = 6371000;
      const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
      const dφ = (lat2-lat1) * Math.PI / 180, dλ = (lng2-lng1) * Math.PI / 180;
      const a = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
      m += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return (m/1000).toFixed(2);
  }, [picker]);

  const isEdit = !!editing;

  return (
    <div className="admin-crud-container">
      {/* ── CARD ATAS: Form & Peta ── */}
      <div className="admin-top-split">
        <div className="admin-form-side">
          <div className="admin-section-header">
            <h3>
              {isEdit
                ? <><IconEdit size={18} /> Edit Rute #{editing}</>
                : <><IconPlus size={18} /> Tambah Rute Baru</>}
            </h3>
            <div className="admin-header-actions">
              <RefreshButton onClick={reload} loading={loading} />
            </div>
          </div>

          <ErrorBox error={error} onRetry={reload} />

          <form onSubmit={onSubmit} className="admin-form-card">
            {panjangKmEstimasi && (
              <div className="admin-rute-estimation">
                <IconRuler size={16} /> 
                <span>Estimasi: <b>{panjangKmEstimasi} km</b></span>
                <span className="dot-divider">•</span>
                <span><b>{picker.lineString.coordinates.length}</b> titik</span>
                <span className="dot-divider">•</span>
                <span><b>{picker.waypoints?.length || 0}</b> waypoint</span>
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label className="admin-form-label">Kode Trayek</label>
                <input 
                  required 
                  maxLength={10} 
                  className="admin-form-input text-uppercase"
                  placeholder="Misal: K01" 
                  value={form.kode_trayek}
                  onChange={(e) => setForm({ ...form, kode_trayek: e.target.value.toUpperCase() })} 
                />
              </div>
              <div className="form-group">
                <label className="admin-form-label">Warna Rute</label>
                <div className="color-picker-wrapper">
                  <input 
                    type="color" 
                    className="admin-form-color"
                    value={form.warna_peta}
                    onChange={(e) => setForm({ ...form, warna_peta: e.target.value })} 
                  />
                  <span className="color-value">{form.warna_peta}</span>
                </div>
              </div>
              <div className="full form-group">
                <label className="admin-form-label">Nama Trayek</label>
                <input 
                  required 
                  maxLength={150} 
                  className="admin-form-input"
                  placeholder="Misal: Pandau - Pelita Pantai" 
                  value={form.nama_trayek}
                  onChange={(e) => setForm({ ...form, nama_trayek: e.target.value })} 
                />
              </div>
            </div>

            <div className="admin-form-actions">
              <button 
                type="submit"
                disabled={!isEdit && !picker?.lineString}
                className={`admin-btn-primary ${(!isEdit && !picker?.lineString) ? "disabled" : ""}`}
              >
                {isEdit ? <><IconEdit size={16} /> Simpan Perubahan</> : <><IconPlus size={16} /> Simpan Rute Baru</>}
              </button>
              {isEdit && (
                <button type="button" onClick={onCancel} className="admin-btn-secondary">
                  <IconXCircle size={16} /> Batal
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="admin-map-side">
          <RutePicker
            value={picker}
            onChange={setPicker}
            onReset={() => setPicker(null)}
            referenceLineString={refLineString}
            referenceColor={form.warna_peta}
            height="100%"
          />
        </div>
      </div>

      {/* ── CARD BAWAH: Tabel Full Width ── */}
      <div className="admin-bottom-table">
        <div className="admin-table-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Daftar Rute Tersimpan ({list.length})</h3>
          <span className="admin-stat-badge">
            <IconBarChart size={14} /> Total Rute: <b>{list.length}</b>
          </span>
        </div>

        {list.length === 0 ? (
          <div className="warning-box trip-alert warning">
            <IconAlert size={16} style={{flexShrink:0, marginTop:2}} />
            <span>Tabel rute kosong. Klik <b>Refresh</b> atau jalankan migrasi backend.</span>
          </div>
        ) : (
          <div className="admin-table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Kode</th>
                  <th>Nama Trayek</th>
                  <th>Panjang</th>
                  <th>Warna</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id_rute} className={editing === r.id_rute ? "editing-row" : ""}>
                    <td>{r.id_rute}</td>
                    <td><strong>{r.kode_trayek}</strong></td>
                    <td>{r.nama_trayek}</td>
                    <td>{r.panjang_km != null ? `${r.panjang_km} km` : <span className="text-muted">—</span>}</td>
                    <td>
                      <div className="color-cell">
                        <span className="color-swatch" style={{ background: r.warna_peta }} />
                        <span className="coord-cell">{r.warna_peta}</span>
                      </div>
                    </td>
                    <td>
                      <div className="actions">
                        <button onClick={() => onEdit(r)} className="admin-table-action edit">
                          <IconEdit size={14} /> Edit
                        </button>
                        <button onClick={() => onDelete(r.id_rute)} className="admin-table-action delete">
                          <IconTrash size={14} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
