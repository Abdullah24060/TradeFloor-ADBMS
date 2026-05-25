import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/'); setMenuOpen(false) }
  const close = () => setMenuOpen(false)

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const navLinks = [
    { to: '/market', label: 'Market Radar' },
    { to: '/orders', label: 'My Orders' },
    { to: '/trades', label: 'My Trades' },
    { to: '/items',  label: 'Browse Items' },
  ]

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,8,18,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div className="page-wrap flex items-center justify-between" style={{ height: 60 }}>

          {/* Brand */}
          <Link to="/" onClick={close} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
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

          {/* Desktop nav links */}
          {isLoggedIn && (
            <div className="nav-links-desktop flex gap-2" style={{ gap: 4 }}>
              {navLinks.map(({ to, label }) => (
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
                {/* Avatar + name — desktop only */}
                <Link to="/dashboard" onClick={close} className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
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
                <button className="btn btn-ghost btn-sm nav-links-desktop" onClick={handleLogout}>
                  Sign Out
                </button>

                {/* Hamburger button — mobile only */}
                <button
                  className="nav-hamburger btn btn-ghost btn-sm"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="Toggle menu"
                  style={{ fontSize: 20, padding: '4px 8px' }}
                >
                  {menuOpen ? '✕' : '☰'}
                </button>
              </>
            ) : (
              <>
                <Link to="/login"    className="btn btn-ghost btn-sm">Log In</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
              </>
            )}
          </div>

        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && isLoggedIn && (
        <div className="nav-mobile-menu">
          {/* User info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 12px' }}>
            <div style={{
              width: 36, height: 36, flexShrink: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: 'var(--accent-light)',
            }}>{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rep: {user?.reputation ?? 0}</div>
            </div>
          </div>

          <div className="nav-mobile-divider" />

          {navLinks.map(({ to, label }) => (
            <Link
              key={to} to={to}
              className={isActive(to) ? 'active-link' : ''}
              onClick={close}
            >{label}</Link>
          ))}

          <div className="nav-mobile-divider" />

          <Link to="/dashboard" onClick={close}>Dashboard</Link>
          <button onClick={handleLogout} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '11px 14px', textAlign: 'left', borderRadius: 'var(--radius-sm)',
            fontSize: 15, fontWeight: 500, color: 'var(--red)', fontFamily: 'Inter, sans-serif',
            transition: 'var(--trans)',
          }}>Sign Out</button>
        </div>
      )}
    </>
  )
}
