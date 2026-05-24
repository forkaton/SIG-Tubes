import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import HaltePicker from "./HaltePicker.jsx";
import RutePicker  from "./RutePicker.jsx";
import {
  IconBus, IconRoute, IconRefresh, IconBarChart, IconXCircle, IconAlert,
  IconEdit, IconTrash, IconPlus, IconRuler, IconWand, IconLoader, IconCheckCircle,
} from "./Icons.jsx";

export default function AdminPanel({ onChanged }) {
  const [tab, setTab] = useState("halte");

  return (
    <div className="admin">
      <h2>Panel Administrasi CRUD</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button onClick={() => setTab("halte")} style={btnStyle(tab === "halte")}>
          <IconBus size={14} /> Halte
        </button>
        <button onClick={() => setTab("rute")}  style={btnStyle(tab === "rute")}>
          <IconRoute size={14} /> Rute
        </button>
      </div>

      {tab === "halte"
        ? <HalteCrud onChanged={onChanged} />
        : <RuteCrud  onChanged={onChanged} />}
    </div>
  );
}

function btnStyle(active) {
  return {
    background: active ? "#1e3a8a" : "#6b7280",
    color: "white", padding: "8px 14px", border: 0, borderRadius: 6, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 6,
  };
}

function RefreshButton({ onClick, loading }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      style={{
        background: "#0f766e", color: "white", border: 0,
        padding: "6px 12px", borderRadius: 6, fontSize: ".85rem",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}>
      {loading ? <IconLoader size={14} /> : <IconRefresh size={14} />}
      {loading ? "Memuat..." : "Refresh"}
    </button>
  );
}

function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div style={{
      background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8,
      marginBottom: 12, fontSize: ".85rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <IconXCircle size={16} /> <b>Error memuat data:</b> {error}
      </div>
      <button onClick={onRetry} style={{
        marginTop: 8, background: "#dc2626", color: "white", border: 0,
        padding: "6px 12px", borderRadius: 6, fontSize: ".85rem",
      }}>Coba Ulang</button>
    </div>
  );
}

// ============================================================
// CRUD HALTE — form simple + restrict to selected rute
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

  // Saat rute dipilih berubah, validasi koord existing — jika di luar rute baru,
  // hapus koord supaya admin sadar harus klik ulang.
  useEffect(() => {
    if (!coords || !form.id_rute_pelintas) return;
    // Tidak otomatis hapus, biarkan admin lihat efek pemilihan rute baru.
  }, [form.id_rute_pelintas]);

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

  const restrictToRuteId = form.id_rute_pelintas
    ? parseInt(form.id_rute_pelintas, 10)
    : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>
          {editing ? <><IconEdit size={16} /> Edit Halte #{editing}</> : <><IconPlus size={16} /> Tambah Halte Baru</>}
        </h3>
        <span style={{
          background: "#dbeafe", color: "#1e3a8a", padding: "4px 10px",
          borderRadius: 999, fontSize: ".8rem", display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <IconBarChart size={12} /> Rute: <b>{ruteList.length}</b> · Halte: <b>{halteList.length}</b>
        </span>
        <RefreshButton onClick={reload} loading={loading} />
      </div>

      <ErrorBox error={error} onRetry={reload} />

      <form onSubmit={onSubmit} style={{ background: "white", padding: 16, borderRadius: 8, marginTop: 12, marginBottom: 16 }}>
        {/* Pilih rute DULU supaya picker tahu restriksi */}
        <div style={{ marginBottom: 10 }}>
          <label><b>Rute</b> ({ruteList.length} tersedia)</label>
          <select style={{ width: "100%", padding: 6 }}
            value={form.id_rute_pelintas}
            onChange={(e) => setForm({ ...form, id_rute_pelintas: e.target.value })}>
            <option value="">— Tanpa rute (bebas klik di mana saja) —</option>
            {ruteList.map((r) => (
              <option key={r.id_rute} value={r.id_rute}>
                {r.kode_trayek} — {r.nama_trayek}
              </option>
            ))}
          </select>
        </div>

        <HaltePicker
          value={coords}
          onChange={setCoords}
          ruteFc={ruteFc}
          restrictToRuteId={restrictToRuteId}
          height={360}
        />

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="full">
            <label>Nama Halte</label>
            <input style={{ width: "100%", padding: 6 }} required
              value={form.nama_halte}
              onChange={(e) => setForm({ ...form, nama_halte: e.target.value })} />
          </div>
          <div>
            <label>Kondisi</label>
            <select style={{ width: "100%", padding: 6 }}
              value={form.kondisi_fisik}
              onChange={(e) => setForm({ ...form, kondisi_fisik: e.target.value })}>
              <option value="Beroperasi">Beroperasi</option>
              <option value="Tidak Beroperasi">Tidak Beroperasi</option>
            </select>
          </div>
          <div className="full">
            <label>Keterangan</label>
            <textarea rows={2} style={{ width: "100%", padding: 6 }}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
          </div>
        </div>

        <button type="submit"
          style={{ background: "#1e3a8a", color: "white", padding: "8px 14px", border: 0, borderRadius: 6, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {editing ? <><IconEdit size={14} /> Simpan Perubahan</> : <><IconPlus size={14} /> Tambah Halte</>}
        </button>
        {editing && (
          <button type="button" onClick={onCancel}
            style={{ marginLeft: 8, background: "#6b7280", color: "white", padding: "8px 14px", border: 0, borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconXCircle size={14} /> Batal
          </button>
        )}
      </form>

      <h3>Daftar Halte ({halteList.length})</h3>
      {halteList.length === 0 ? (
        <div style={{
          background: "#fef3c7", color: "#92400e", padding: 12, borderRadius: 8,
          fontSize: ".85rem", display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <IconAlert size={16} />
          <span>Tabel halte kosong. Klik <b>Refresh</b> atau jalankan migrasi/seeder backend.</span>
        </div>
      ) : (
        <table>
          <thead>
            <tr><th>ID</th><th>Nama</th><th>Rute</th><th>Kondisi</th><th>Koord</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {halteList.map((h) => (
              <tr key={h.id_halte}>
                <td>{h.id_halte}</td>
                <td>{h.nama_halte}</td>
                <td>{h.kode_trayek || <em style={{ color: "#9ca3af" }}>—</em>}</td>
                <td><span className={`badge badge-${(h.kondisi_fisik || "").toLowerCase().replace(/\s+/g, "-")}`}>{h.kondisi_fisik}</span></td>
                <td style={{ fontFamily: "monospace", fontSize: ".75rem" }}>
                  {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}
                </td>
                <td>
                  <div className="actions">
                    <button onClick={() => onEdit(h)} style={{ background: "#2563eb", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <IconEdit size={12} /> Edit
                    </button>
                    <button onClick={() => onDelete(h.id_halte)} style={{ background: "#dc2626", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <IconTrash size={12} /> Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

// ============================================================
// CRUD RUTE — multi-waypoint snap-to-road + Edit mode
// ============================================================
function RuteCrud({ onChanged }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [snapping, setSnapping]   = useState(false);
  const [snapResult, setSnapResult] = useState(null);

  const empty = { kode_trayek: "", nama_trayek: "", warna_peta: "#3388ff" };
  const [form, setForm]     = useState(empty);
  const [picker, setPicker] = useState(null);
  const [editing, setEditing] = useState(null);                  // id_rute | null
  const [refLineString, setRefLineString] = useState(null);      // geometri existing (mode edit)

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
      // Mode edit: geometri opsional
      const payload = { ...form };
      if (picker?.lineString) payload.geometri_jalur = picker.lineString;
      try {
        await api.updateRute(editing, payload);
        onCancel();
        await reload();
        onChanged?.();
      } catch (err) { alert(err.message); }
    } else {
      // Mode create: geometri wajib
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

  async function onSnapAll() {
    if (!confirm(
      "Re-snap geometri SELURUH rute via OSRM?\n\n" +
      "Memanggil OSRM untuk setiap rute (sekitar 1 detik/rute) dan UPDATE kolom " +
      "geometri_jalur agar mengikuti jalan raya. Tidak menghapus data."
    )) return;
    setSnapping(true);
    setSnapResult(null);
    try {
      const result = await api.snapAllRute();
      setSnapResult(result);
      await reload();
      onChanged?.();
    } catch (err) {
      alert("Gagal: " + err.message);
    } finally {
      setSnapping(false);
    }
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
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>
          {isEdit
            ? <><IconEdit size={16} /> Edit Rute #{editing}</>
            : <><IconPlus size={16} /> Tambah Rute Baru</>}
        </h3>
        <span style={{
          background: "#dbeafe", color: "#1e3a8a", padding: "4px 10px",
          borderRadius: 999, fontSize: ".8rem", display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <IconBarChart size={12} /> Rute tersedia: <b>{list.length}</b>
        </span>
        <RefreshButton onClick={reload} loading={loading} />
        <button type="button" onClick={onSnapAll} disabled={snapping}
          style={{
            background: snapping ? "#9ca3af" : "#7c3aed", color: "white", border: 0,
            padding: "6px 12px", borderRadius: 6, fontSize: ".85rem",
            display: "inline-flex", alignItems: "center", gap: 5,
            cursor: snapping ? "wait" : "pointer",
          }}>
          {snapping ? <IconLoader size={14} /> : <IconWand size={14} />}
          {snapping ? "Memanggil OSRM..." : "Re-snap Semua Rute via OSRM"}
        </button>
      </div>

      <ErrorBox error={error} onRetry={reload} />

      {snapResult && (
        <div style={{
          background: "#dcfce7", color: "#166534", padding: 12, borderRadius: 8,
          marginTop: 12, fontSize: ".85rem",
        }}>
          <b style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <IconCheckCircle size={14} /> Re-snap selesai:
          </b>{" "}
          {snapResult.sukses} / {snapResult.total} rute berhasil disnap ke jalan raya.
        </div>
      )}

      <form onSubmit={onSubmit} style={{ background: "white", padding: 16, borderRadius: 8, marginTop: 12, marginBottom: 16 }}>
        <RutePicker
          value={picker}
          onChange={setPicker}
          onReset={() => setPicker(null)}
          referenceLineString={refLineString}
          height={420}
        />

        {panjangKmEstimasi && (
          <div style={{ margin: "8px 0", fontSize: ".85rem", color: "#1e3a8a", display: "flex", alignItems: "center", gap: 6 }}>
            <IconRuler size={14} /> Panjang rute baru: <b>{panjangKmEstimasi} km</b> ·
            {" "}<b>{picker.lineString.coordinates.length}</b> titik geometri ·
            {" "}<b>{picker.waypoints?.length || 0}</b> waypoint
          </div>
        )}

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div>
            <label>Kode Trayek</label>
            <input required maxLength={10} style={{ width: "100%", padding: 6 }}
              placeholder="K05" value={form.kode_trayek}
              onChange={(e) => setForm({ ...form, kode_trayek: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label>Warna Highlight</label>
            <input type="color" style={{ width: "100%", padding: 2, height: 34 }}
              value={form.warna_peta}
              onChange={(e) => setForm({ ...form, warna_peta: e.target.value })} />
          </div>
          <div className="full">
            <label>Nama Trayek</label>
            <input required maxLength={150} style={{ width: "100%", padding: 6 }}
              placeholder="Rute 05 (Awal - Akhir)" value={form.nama_trayek}
              onChange={(e) => setForm({ ...form, nama_trayek: e.target.value })} />
          </div>
        </div>

        <button type="submit"
          disabled={!isEdit && !picker?.lineString}
          style={{
            background: (isEdit || picker?.lineString) ? "#1e3a8a" : "#9ca3af",
            color: "white", padding: "8px 14px", border: 0, borderRadius: 6, fontWeight: 600,
            cursor: (isEdit || picker?.lineString) ? "pointer" : "not-allowed",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          {isEdit
            ? <><IconEdit size={14} /> Simpan Perubahan</>
            : <><IconPlus size={14} /> Simpan Rute Baru</>}
        </button>
        {isEdit && (
          <button type="button" onClick={onCancel}
            style={{ marginLeft: 8, background: "#6b7280", color: "white", padding: "8px 14px", border: 0, borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconXCircle size={14} /> Batal
          </button>
        )}
      </form>

      <h3>Daftar Rute ({list.length})</h3>
      {list.length === 0 ? (
        <div style={{
          background: "#fef3c7", color: "#92400e", padding: 12, borderRadius: 8,
          fontSize: ".85rem", display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <IconAlert size={16} />
          <span>Tabel rute kosong. Klik <b>Refresh</b> atau jalankan migrasi/seeder backend.</span>
        </div>
      ) : (
        <table>
          <thead>
            <tr><th>ID</th><th>Kode</th><th>Nama Trayek</th><th>Panjang</th><th>Warna</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id_rute} style={editing === r.id_rute ? { background: "#dbeafe" } : {}}>
                <td>{r.id_rute}</td>
                <td><b>{r.kode_trayek}</b></td>
                <td>{r.nama_trayek}</td>
                <td>{r.panjang_km != null ? `${r.panjang_km} km` : "—"}</td>
                <td>
                  <span style={{ display: "inline-block", width: 24, height: 12, background: r.warna_peta, borderRadius: 3 }} />
                  <span style={{ marginLeft: 6, fontFamily: "monospace", fontSize: ".75rem" }}>{r.warna_peta}</span>
                </td>
                <td>
                  <div className="actions">
                    <button onClick={() => onEdit(r)} style={{ background: "#2563eb", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <IconEdit size={12} /> Edit
                    </button>
                    <button onClick={() => onDelete(r.id_rute)} style={{ background: "#dc2626", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <IconTrash size={12} /> Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
