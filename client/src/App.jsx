import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import History from './pages/History.jsx';
import Memories from './pages/Memories.jsx';
import Admin from './pages/Admin.jsx';

const NAV = [
  { to: '/', label: 'Pradžia', end: true },
  { to: '/history', label: 'Istorija' },
  { to: '/memories', label: 'Prisiminimai' },
  { to: '/admin', label: 'Administravimas' },
];

export default function App() {
  // Keying the page container by pathname remounts it on navigation, replaying the
  // page-enter animation for every route change.
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">
          <span className="sprout" aria-hidden="true">🌱</span> Mažylio naujienos
        </h1>
        <nav className="app-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <div key={location.pathname} className="page-enter">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/memories" element={<Memories />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </main>

      <footer className="app-footer">
        Sukurta su meile, dar prieš tau atvykstant. <span className="beating" aria-hidden="true">💛</span>
      </footer>
    </div>
  );
}
