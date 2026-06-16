import { useEffect, useState } from "react";
import MapView from "./components/MapView.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import LandingPage from "./components/LandingPage.jsx";
import { api, setToken } from "./api.js";
import { IconMenu, IconX, IconSun, IconMoon, IconLogOut } from "./components/Icons.jsx";

export default function App() {
  const [view, setView]               = useState("landing");
  const [isAdmin, setIsAdmin]         = useState(!!localStorage.getItem("admin_token"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme]             = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  // Data master
  const [ruteList, setRuteList]       = useState([]);
  const [halteFc, setHalteFc]         = useState({ type: "FeatureCollection", features: [] });
  const [ruteFc, setRuteFc]           = useState({ type: "FeatureCollection", features: [] });

  // Filter & toggle layer
  const [selectedRute, setSelectedRute]   = useState(new Set());
  const [showRute, setShowRute]           = useState(true);
  const [showHalte, setShowHalte]         = useState(true);
  const [showRusak, setShowRusak]         = useState(true);

  // Mode interaksi peta: "radius" (cari halte) atau "trip" (rute A->B)
  const [mode, setMode] = useState("radius");

  // Pencarian radius via klik peta
  const [radius, setRadius]               = useState(500);
  const [radiusResult, setRadiusResult]   = useState(null);

  // Trip planner A->B
  const [tripA, setTripA]           = useState(null);  // { lat, lng }
  const [tripB, setTripB]           = useState(null);
  const [tripResult, setTripResult] = useState(null);
  const [tripLoading, setTripLoading] = useState(false);
  
  // Pan to position
  const [panToPos, setPanToPos] = useState(null);

  async function reload() {
    const [rRes, rfRes, hfRes] = await Promise.allSettled([
      api.listRute(), api.ruteGeojsonAll(), api.halteGeojson(),
    ]);

    if (rRes.status === "fulfilled") {
      const r = rRes.value;
      setRuteList(r);
      setSelectedRute((prev) => {
        if (prev.size === 0) return new Set(r.map((x) => x.id_rute));
        const next = new Set(prev);
        r.forEach((x) => next.add(x.id_rute));
        return next;
      });
    } else {
      console.error("[App] /rute gagal:", rRes.reason);
    }
    if (rfRes.status === "fulfilled") setRuteFc(rfRes.value);
    else console.error("[App] /rute/geojson gagal:", rfRes.reason);
    if (hfRes.status === "fulfilled") setHalteFc(hfRes.value);
    else console.error("[App] /halte/geojson gagal:", hfRes.reason);
  }

  useEffect(() => { reload(); }, []);

  function toggleRute(id) {
    setSelectedRute((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(checked) {
    setSelectedRute(checked ? new Set(ruteList.map((r) => r.id_rute)) : new Set());
  }

  // ===== Radius =====
  async function searchRadiusAt({ lat, lng }) {
    try {
      const halte = await api.halteRadius(lat, lng, radius);
      setRadiusResult({ lat, lng, radius, halte });
    } catch (err) {
      alert("Gagal ambil halte radius: " + err.message);
    }
  }

  function changeRadius(newR) {
    setRadius(newR);
    if (radiusResult) searchRadiusAt({ lat: radiusResult.lat, lng: radiusResult.lng });
  }

  // ===== Trip A->B =====
  async function planTripTo({ lat, lng }) {
    setTripLoading(true);
    try {
      const res = await api.planTrip(tripA.lat, tripA.lng, lat, lng);
      setTripResult(res);
    } catch (err) {
      alert("Gagal menghitung rute: " + err.message);
      setTripB(null);
    } finally {
      setTripLoading(false);
    }
  }

  function resetTrip() {
    setTripA(null); setTripB(null); setTripResult(null);
  }

  /** Klik peta utama — perilaku tergantung mode aktif */
  function handleMapClick({ lat, lng }) {
    if (mode === "trip") {
      if (!tripA || (tripA && tripB)) {
        setTripA({ lat, lng });
        setTripB(null);
        setTripResult(null);
      } else {
        setTripB({ lat, lng });
        planTripTo({ lat, lng });
      }
    } else {
      searchRadiusAt({ lat, lng });
    }
  }

  function changeMode(newMode) {
    setMode(newMode);
    // Bersihkan state mode lain agar peta tidak tumpang tindih
    if (newMode === "trip") { setRadiusResult(null); }
    else { resetTrip(); }
  }

  function handleLogout() {
    setToken(null);
    setIsAdmin(false);
    setView("landing");
  }

  if (view === "landing") {
    return (
      <LandingPage 
        onEnterUser={() => setView("map")} 
        onEnterAdmin={() => { setIsAdmin(true); setView("admin"); }} 
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <h1>
            <span className="live-dot" title="Sistem Aktif" />
            WebGIS Trans Metro
            <span className="tag">SIG ITERA</span>
          </h1>
        </div>
        <nav className="nav">
          <button className={view === "map" ? "active" : ""}   onClick={() => setView("map")}>Peta</button>
          {!isAdmin && (
            <button onClick={() => setView("landing")} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', color: 'var(--accent-color)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600 }}>
              Login Admin
            </button>
          )}
          {isAdmin && (
            <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>Admin Panel</button>
          )}
          {isAdmin && (
            <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', color: '#ef4444', padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
              <IconLogOut size={16} /> Logout
            </button>
          )}
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <IconSun size={20} /> : <IconMoon size={20} />}
          </button>
        </nav>
      </header>

      {view === "map" ? (
        <div className="body">
          <div
            className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          <Sidebar
            className={sidebarOpen ? 'open' : ''}
            mode={mode}              onChangeMode={changeMode}
            ruteList={ruteList}
            selectedRute={selectedRute}
            onToggleRute={toggleRute}
            onToggleAll={toggleAll}
            showRute={showRute}     onToggleShowRute={setShowRute}
            showHalte={showHalte}   onToggleShowHalte={setShowHalte}
            showRusak={showRusak}   onToggleRusak={setShowRusak}
            radius={radius}         onChangeRadius={changeRadius}
            onPickFromGPS={searchRadiusAt}
            radiusResult={radiusResult}
            onClearRadius={() => setRadiusResult(null)}
            tripA={tripA}           tripB={tripB}
            tripResult={tripResult} tripLoading={tripLoading}
            onResetTrip={resetTrip}
            onHalteClick={(h) => setPanToPos({ lat: h.lat || h.latitude, lng: h.lng || h.longitude, zoom: 17, t: Date.now() })}
          />

          <button
            className="mobile-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <IconX size={24} /> : <IconMenu size={24} />}
          </button>

          <div className="map-area">
            <MapView
              ruteFc={ruteFc}
              halteFc={halteFc}
              selectedRute={selectedRute}
              showHalte={showHalte}
              showRute={showRute}
              showRusak={showRusak}
              radiusResult={radiusResult}
              onMapClick={handleMapClick}
              mode={mode}
              tripA={tripA}
              tripB={tripB}
              tripResult={tripResult}
              theme={theme}
              panToPos={panToPos}
            />
            <div className="legend">
              <h3>Legenda Halte</h3>
              <div className="item"><span className="dot" style={{ background: "#16a34a" }} /> Beroperasi</div>
              <div className="item"><span className="dot" style={{ background: "#dc2626" }} /> Tidak Beroperasi</div>
              <div className="item"><span className="dot" style={{ background: "#1e3a8a" }} /> Titik Pencarian</div>
            </div>
          </div>
        </div>
      ) : (
        <AdminPanel ruteList={ruteList} onChanged={reload} />
      )}
    </div>
  );
}
