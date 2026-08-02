import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { isLoggedIn, logout } from './api/client';
import LiveFeed from './pages/LiveFeed';
import Investigate from './pages/Investigate';
import Settings from './pages/Settings';
import Login from './pages/Login';

function Nav() {
  return (
    <nav className="bg-gray-900 text-white px-6 py-3 flex items-center gap-6">
      <span className="font-bold text-indigo-400 mr-4">⚡ Gateway</span>
      {[
        { to: '/', label: 'Live Feed' },
        { to: '/investigate', label: 'Investigate' },
        { to: '/settings', label: 'Settings' },
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `text-sm ${isActive ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'}`
          }
        >
          {label}
        </NavLink>
      ))}
      <button
        onClick={() => { logout(); window.location.href = '/login'; }}
        className="ml-auto text-sm text-gray-400 hover:text-white"
      >
        Logout
      </button>
    </nav>
  );
}

function Protected({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <Protected>
              <div className="min-h-screen bg-gray-950 text-gray-100">
                <Nav />
                <div className="p-6">
                  <Routes>
                    <Route path="/" element={<LiveFeed />} />
                    <Route path="/investigate" element={<Investigate />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </div>
              </div>
            </Protected>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
