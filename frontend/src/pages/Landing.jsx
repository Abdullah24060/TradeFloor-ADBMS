import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  {
    icon: '📊',
    title: 'Live Order Book',
    desc: 'See every bid and ask in real time. Know the fair price before you trade — complete market transparency.',
  },
  {
    icon: '⚡',
    title: 'Instant Matching',
    desc: 'Our PostgreSQL matching engine finds your counterpart in milliseconds using exchange-grade concurrency control.',
  },
  {
    icon: '🔐',
    title: 'Secure Settlement',
    desc: 'Physical meetup + cryptographic 6-digit release code ensures no trade completes without both sides agreeing.',
  },
  {
    icon: '⭐',
    title: 'Reputation System',
    desc: 'Every completed trade builds your reputation. Tamper-proof — anchored in the database, not the app.',
  },
]

const CATEGORIES = [
  { label: 'Textbooks', icon: '📚', color: '#7c6af7' },
  { label: 'Tickets',   icon: '🎟️', color: '#f472b6' },
  { label: 'Electronics', icon: '💻', color: '#34d399' },
  { label: 'Services',  icon: '🤝', color: '#fbbf24' },
]

export default function Landing() {
  const { isLoggedIn } = useAuth()

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────── */}
      <section style={{
        minHeight: '88vh',
        display: 'flex', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow blobs */}
        <div style={{
          position: 'absolute', top: '10%', left: '50%',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(124,106,247,0.12) 0%, transparent 70%)',
          transform: 'translateX(-50%)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '-100px',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="page-wrap fade-up" style={{ width: '100%', paddingTop: 80, paddingBottom: 80 }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(124,106,247,0.1)',
            border: '1px solid rgba(124,106,247,0.25)',
            borderRadius: 20, padding: '6px 14px',
            marginBottom: 28,
          }}>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-light)' }}>
              ITU Lahore Campus Exchange
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, maxWidth: 720, lineHeight: 1.05, marginBottom: 24 }}>
            The Campus Market
            <br />
            <span style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light), #c084fc)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              You Deserve
            </span>
          </h1>

          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 560, lineHeight: 1.7, marginBottom: 40 }}>
            TradeFloor brings exchange-grade price discovery to ITU campus trade.
            Textbooks, tickets, electronics, and services — all at fair market prices,
            matched instantly, settled safely.
          </p>

          <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
            {isLoggedIn ? (
              <>
                <Link to="/market" className="btn btn-primary btn-lg">Explore Market Radar</Link>
                <Link to="/dashboard" className="btn btn-secondary btn-lg">Dashboard</Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">Start Trading Free</Link>
                <Link to="/login" className="btn btn-secondary btn-lg">Sign In</Link>
              </>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-6" style={{ marginTop: 60, flexWrap: 'wrap' }}>
            {[
              { value: 'SERIALIZABLE', label: 'Isolation Level' },
              { value: 'SKIP LOCKED', label: 'Concurrency Mode' },
              { value: 'pgcrypto', label: 'Release Codes' },
              { value: 'Append-only', label: 'Trade Ledger' },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-light)', fontFamily: 'Outfit, sans-serif' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ────────────────────────────────── */}
      <section style={{ padding: '60px 0', background: 'var(--bg-surface)' }}>
        <div className="page-wrap">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 32 }}>What's Trading Right Now</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
              Four categories. One marketplace. All at market price.
            </p>
          </div>
          <div className="grid-4">
            {CATEGORIES.map(({ label, icon, color }) => (
              <Link key={label} to="/items" style={{ textDecoration: 'none' }}>
                <div className="card" style={{
                  textAlign: 'center', padding: 32, cursor: 'pointer',
                  borderColor: 'var(--border-subtle)',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color, fontFamily: 'Outfit, sans-serif' }}>{label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section style={{ padding: '80px 0' }}>
        <div className="page-wrap">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 36 }}>Exchange-Grade Technology</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 10, fontSize: 16 }}>
              Every feature is backed by advanced database engineering — not application hacks.
            </p>
          </div>
          <div className="grid-2">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="card" style={{ display: 'flex', gap: 20 }}>
                <div style={{
                  fontSize: 28, width: 52, height: 52, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-elevated)', borderRadius: 12,
                }}>{icon}</div>
                <div>
                  <h3 style={{ fontSize: 17, marginBottom: 8 }}>{title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────── */}
      <section style={{ padding: '60px 0 80px', background: 'var(--bg-surface)' }}>
        <div className="page-wrap">
          <h2 style={{ textAlign: 'center', fontSize: 32, marginBottom: 48 }}>How Physical Settlement Works</h2>
          <div style={{ display: 'flex', gap: 0, position: 'relative', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { n: '1', text: 'Buyer places a limit BUY order' },
              { n: '2', text: 'Matching engine finds a compatible SELL' },
              { n: '3', text: 'Buyer receives a secret 6-digit Release Code' },
              { n: '4', text: 'Both parties meet on campus, cash changes hands' },
              { n: '5', text: 'Buyer gives code to seller → trade completes → rep +1' },
            ].map(({ n, text }, i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ textAlign: 'center', width: 180, padding: '0 8px' }}>
                  <div style={{
                    width: 44, height: 44, margin: '0 auto 12px',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 16, color: '#fff',
                  }}>{n}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</p>
                </div>
                {i < 4 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 20, padding: '0 4px' }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer style={{
        padding: '24px 0',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          TradeFloor — ADBMS Project, ITU Lahore · Built with PostgreSQL + FastAPI + React
        </p>
      </footer>
    </div>
  )
}
