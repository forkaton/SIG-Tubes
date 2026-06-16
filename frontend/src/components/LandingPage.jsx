import { useState } from "react";
import { api } from "../api.js";
import {
  IconLock, IconUser, IconChevronRight,
  IconLoader, IconAlert, IconEye, IconEyeOff
} from "./Icons.jsx";

export default function LandingPage({ onEnterUser, onEnterAdmin }) {
  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
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
      <div className="landing-bg-blob blob-1" />
      <div className="landing-bg-blob blob-2" />

      <div className="landing-card landing-split" style={{ maxWidth: "900px", width: "95%", padding: 0, overflow: "hidden" }}>
        
        {/* Panel Kiri - Publik */}
        <div style={{ flex: 1, padding: "50px 40px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", background: "rgba(var(--accent-rgb, 30,58,138), 0.03)", borderRight: "1px solid var(--border-color)" }}>
          
          <img src="/withtextblue.png" alt="Trans Metro Pekanbaru" className="logo-light" style={{ width: "220px", height: "auto", marginBottom: "24px" }} />
          <img src="/withtextorange.png" alt="Trans Metro Pekanbaru" className="logo-dark" style={{ width: "220px", height: "auto", marginBottom: "24px" }} />
          
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: "1.6", marginBottom: "32px", maxWidth: "300px" }}>
            Sistem Informasi Geografis Rute &amp; Halte Angkutan Umum Kota Pekanbaru.
          </p>
          
          <button className="btn-explore" onClick={onEnterUser} style={{ padding: "16px 28px", fontSize: "1.05rem", borderRadius: "14px", width: "100%", maxWidth: "280px", justifyContent: "center", boxShadow: "0 8px 24px rgba(30,58,138,0.2)" }}>
            Akses Peta Publik
            <IconChevronRight size={18} />
          </button>
        </div>

        {/* Panel Kanan - Admin */}
        <div style={{ flex: 1, padding: "50px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>Admin Panel</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "28px" }}>Login untuk mengelola operasional halte dan rute bus.</p>

          <form onSubmit={handleLogin} className="login-form">
            {error && (
              <div className="login-error" style={{ padding: "10px 14px", borderRadius: "10px", background: "#fee2e2", color: "#991b1b", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", marginBottom: "16px" }}>
                <IconAlert size={14} /> {error}
              </div>
            )}
            
            <div className="input-group" style={{ marginBottom: "16px" }}>
              <IconUser size={15} />
              <input
                type="text"
                placeholder="Username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ background: "var(--bg-primary)", padding: "14px 14px 14px 44px", borderRadius: "12px" }}
              />
            </div>
            
            <div className="input-group" style={{ marginBottom: "28px" }}>
              <IconLock size={15} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ background: "var(--bg-primary)", padding: "14px 44px 14px 44px", borderRadius: "12px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "transparent", border: "none",
                  color: "var(--text-secondary)", cursor: "pointer",
                  padding: 0, display: "flex", position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)"
                }}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
            
            <button type="submit" disabled={loading} className="btn-explore" style={{ width: "100%", justifyContent: "center", padding: "14px 24px", borderRadius: "12px", background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-inner-sm)" }}>
              {loading
                ? <><IconLoader size={15} className="spin" /> Memverifikasi...</>
                : "Login Administrator"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

