import { useState } from "react";
import { api } from "../api.js";
import { IconBus, IconLock, IconUser, IconChevronRight, IconLoader, IconAlert, IconEye, IconEyeOff, IconMapPin, IconRoute } from "./Icons.jsx";

const STATS = [
  { value: "7", label: "Koridor Aktif" },
  { value: "50+", label: "Titik Halte" },
  { value: "112", label: "KM Jaringan" },
];

export default function LandingPage({ onEnterUser, onEnterAdmin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login(username, password);
      onEnterAdmin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-container">
      {/* Animated background blobs */}
      <div className="landing-bg-blob blob-1" />
      <div className="landing-bg-blob blob-2" />
      <div className="landing-bg-blob blob-3" />

      <div className="landing-card">
        {/* ── Header ── */}
        <div className="landing-header">
          <div className="landing-logo">
            <IconBus size={36} color="white" />
          </div>
          <div className="landing-badge">Trans Metro Pekanbaru</div>
          <h1>WebGIS<br /><span className="landing-title-accent">Angkutan Umum</span></h1>
          <p>Sistem Informasi Geografis Rute &amp; Halte Kota Pekanbaru</p>

          {/* Stats row */}
          <div className="landing-stats">
            {STATS.map((s) => (
              <div key={s.label} className="landing-stat-item">
                <span className="landing-stat-value">{s.value}</span>
                <span className="landing-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Split content ── */}
        <div className="landing-split">
          {/* User Section */}
          <div className="landing-user">
            <div className="landing-section-icon">
              <IconMapPin size={22} color="var(--accent-color)" />
            </div>
            <h2>Eksplorasi Publik</h2>
            <p>Temukan rute, cari halte terdekat, dan rencanakan perjalanan Anda menggunakan Trans Metro Pekanbaru secara interaktif.</p>
            <ul className="landing-feature-list">
              <li>🗺️ Peta interaktif rute bus</li>
              <li>📍 Cari halte dalam radius tertentu</li>
              <li>🧭 Perencanaan perjalanan A→B</li>
            </ul>
            <button className="btn-explore" onClick={onEnterUser}>
              <span>Mulai Eksplorasi</span>
              <IconChevronRight size={18} />
            </button>
          </div>

          <div className="landing-divider" />

          {/* Admin Section */}
          <div className="landing-admin">
            <div className="landing-section-icon">
              <IconRoute size={22} color="var(--accent-color)" />
            </div>
            <h2>Admin Panel</h2>
            <p>Kelola data operasional rute dan halte Trans Metro Pekanbaru.</p>
            <form onSubmit={handleLogin} className="login-form">
              {error && (
                <div className="login-error">
                  <IconAlert size={14} /> {error}
                </div>
              )}
              <div className="input-group">
                <IconUser size={16} />
                <input
                  type="text"
                  placeholder="Username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="input-group">
                <IconLock size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 0, display: "flex" }}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
              <button type="submit" disabled={loading} className="btn-login">
                {loading ? <><IconLoader size={16} /> Memverifikasi...</> : "Login Admin"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
