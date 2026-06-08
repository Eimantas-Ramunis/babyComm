import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import History from './pages/History.jsx';
import Memories from './pages/Memories.jsx';
import Admin from './pages/Admin.jsx';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/history', label: 'History' },
  { to: '/memories', label: 'Memories' },
  { to: '/admin', label: 'Admin' },
];

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">🌱 Tiny Bean Updates</h1>
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/memories" element={<Memories />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>

      <footer className="app-footer">Made with love, before you arrive. 💛</footer>
    </div>
  );
}
