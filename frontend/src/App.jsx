import { useEffect, useState } from "react";
import MapView from "./components/MapView.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import { api } from "./api.js";
import { IconMenu, IconX, IconSun, IconMoon } from "./components/Icons.jsx";

export default function App() {
  const [view, setView]               = useState("map");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme]             = useState(() => {
    // Load theme dari localStorage atau default ke dark
    return localStorage.getItem("theme") || "light";
  });

  // Apply theme ke document
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

  // Pencarian radius via klik peta
  const [radius, setRadius]               = useState(500);
  const [radiusResult, setRadiusResult]   = useState(null);   // { lat, lng, radius, halte }

  async function reload() {
    // Load 3 endpoint INDEPENDEN — kalau satu gagal, sisanya tetap dimuat
    const [rRes, rfRes, hfRes] = await Promise.allSettled([
      api.listRute(), api.ruteGeojsonAll(), api.halteGeojson(),
    ]);

    if (rRes.status === "fulfilled") {
      const r = rRes.value;
      console.log("[App] /rute returned", r.length, "rute");
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

    if (rfRes.status === "fulfilled") {
      console.log("[App] /rute/geojson:", rfRes.value.features?.length, "features");
      setRuteFc(rfRes.value);
    } else {
      console.error("[App] /rute/geojson gagal:", rfRes.reason);
    }

    if (hfRes.status === "fulfilled") {
      console.log("[App] /halte/geojson:", hfRes.value.features?.length, "features");
      setHalteFc(hfRes.value);
    } else {
      console.error("[App] /halte/geojson gagal:", hfRes.reason);
    }
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

  /** Dipanggil saat user klik di peta utama (atau pakai GPS) */
  async function searchRadiusAt({ lat, lng }) {
    try {
      const halte = await api.halteRadius(lat, lng, radius);
      setRadiusResult({ lat, lng, radius, halte });
    } catch (err) {
      alert("Gagal ambil halte radius: " + err.message);
    }
  }

  /** Re-search saat slider radius berubah, tapi titik sudah ada */
  function changeRadius(newR) {
    setRadius(newR);
    if (radiusResult) searchRadiusAt({ lat: radiusResult.lat, lng: radiusResult.lng });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>WebGIS Trans Metro Pekanbaru <span className="tag">SIG ITERA</span></h1>
        </div>
        <nav className="nav">
          <button className={view === "map" ? "active" : ""}   onClick={() => setView("map")}>Peta</button>
          <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>Admin CRUD</button>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <IconSun size={20} /> : <IconMoon size={20} />}
          </button>
        </nav>
      </header>

      {view === "map" ? (
        <div className="body">
          {/* Overlay untuk menutup sidebar di mobile */}
          <div 
            className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />
          
          <Sidebar
            className={sidebarOpen ? 'open' : ''}
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
          />

          {/* Mobile toggle button */}
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
              onMapClick={searchRadiusAt}
              theme={theme}
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
