import { useState } from "react";
import { api } from "../api.js";
import { IconBus, IconLock, IconUser, IconChevronRight, IconLoader, IconAlert, IconEye, IconEyeOff } from "./Icons.jsx";

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
      <div className="landing-card">
        <div className="landing-header">
          <div className="landing-logo">
            <IconBus size={48} color="var(--accent-color)" />
          </div>
          <h1>WebGIS Trans Metro</h1>
          <p>Sistem Informasi Rute & Halte Angkutan Umum Kota Pekanbaru</p>
        </div>

        <div className="landing-split">
          {/* User Section */}
          <div className="landing-user">
            <h2>Eksplorasi Publik</h2>
            <p>Lihat rute, cari halte terdekat, dan rencanakan perjalanan Anda mengelilingi Pekanbaru.</p>
            <button className="btn-explore" onClick={onEnterUser}>
              Try WebGIS Trans Metro Now! <IconChevronRight size={18} />
            </button>
          </div>

          <div className="landing-divider"></div>

          {/* Admin Section */}
          <div className="landing-admin">
            <h2>Admin Panel</h2>
            <p>Login untuk mengelola data operasional rute dan halte.</p>
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
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
