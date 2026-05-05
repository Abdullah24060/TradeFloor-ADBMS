import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => { logout(); navigate('/') }

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(8,8,18,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div className="page-wrap flex items-center justify-between" style={{ height: 60 }}>
        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#fff',
            fontFamily: 'Outfit, sans-serif',
          }}>T</div>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>
            TradeFloor
          </span>
        </Link>

        {/* Nav links */}
        {isLoggedIn && (
          <div className="flex gap-2" style={{ gap: 4 }}>
            {[
              { to: '/market', label: 'Market Radar' },
              { to: '/orders', label: 'My Orders' },
              { to: '/trades', label: 'My Trades' },
              { to: '/items', label: 'Browse Items' },
            ].map(({ to, label }) => (
              <Link key={to} to={to} style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 500,
                color: isActive(to) ? 'var(--accent-light)' : 'var(--text-secondary)',
                background: isActive(to) ? 'rgba(124,106,247,0.12)' : 'transparent',
                textDecoration: 'none',
                transition: 'var(--trans)',
              }}>{label}</Link>
            ))}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <div style={{
                  width: 32, height: 32,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'var(--accent-light)',
                }}>{user?.name?.[0]?.toUpperCase() || 'U'}</div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {user?.name?.split(' ')[0]}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Rep: {user?.reputation ?? 0}
                  </div>
                </div>
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
