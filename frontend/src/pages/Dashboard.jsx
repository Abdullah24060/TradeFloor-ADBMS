import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth()
  const [orders, setOrders]   = useState([])
  const [trades, setTrades]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/orders'),
      api.get('/trades/pending'),
      refreshUser(),
    ]).then(([ordRes, tradeRes]) => {
      setOrders(ordRes.data)
      setTrades(tradeRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const activeOrders    = orders.filter(o => o.status === 'ACTIVE').length
  const pendingTrades   = trades.length
  const completedOrders = orders.filter(o => o.status === 'FILLED').length

  return (
    <div className="page-wrap fade-up" style={{ paddingTop: 32, paddingBottom: 64 }}>
      {/* Header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, <span className="text-accent">{user?.name}</span></p>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        <StatCard label="Reputation" value={user?.reputation ?? 0} sub="Completed trades" color="var(--accent-light)" />
        <StatCard label="Active Orders" value={loading ? '—' : activeOrders} sub="In the book" color="var(--blue)" />
        <StatCard label="Pending Trades" value={loading ? '—' : pendingTrades} sub="Awaiting meetup" color="var(--yellow)" />
        <StatCard label="Completed" value={loading ? '—' : completedOrders} sub="Filled orders" color="var(--green)" />
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Quick Actions</h2>
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          <Link to="/market" className="btn btn-primary">View Market Radar</Link>
          <Link to="/items" className="btn btn-secondary">Browse Items</Link>
          <Link to="/orders" className="btn btn-secondary">My Orders</Link>
          <Link to="/trades" className="btn btn-secondary">My Trades</Link>
        </div>
      </div>

      {/* Pending Trades Alert */}
      {pendingTrades > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 24, fontSize: 14 }}>
          You have <strong>{pendingTrades}</strong> pending trade{pendingTrades > 1 ? 's' : ''} awaiting physical settlement.{' '}
          <Link to="/trades" style={{ color: 'var(--yellow)', fontWeight: 600 }}>View trades →</Link>
        </div>
      )}

      <div className="grid-2">
        {/* Recent Orders */}
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16 }}>Recent Orders</h3>
            <Link to="/orders" style={{ fontSize: 13, color: 'var(--accent-light)' }}>View all</Link>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>No orders yet. <Link to="/market">Start trading!</Link></p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.slice(0, 5).map(o => (
                <div key={o.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <div>
                    <span className={`badge badge-${o.order_type.toLowerCase()}`} style={{ marginRight: 8 }}>
                      {o.order_type}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Order #{o.id}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>PKR {Number(o.price).toLocaleString()}</div>
                    <span className={`badge badge-${o.status.toLowerCase()}`} style={{ marginTop: 4 }}>
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Trades */}
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16 }}>Pending Trades</h3>
            <Link to="/trades" style={{ fontSize: 13, color: 'var(--accent-light)' }}>View all</Link>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></div>
          ) : trades.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>No pending trades right now.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {trades.slice(0, 5).map(t => (
                <div key={t.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <div>
                    <span className="badge badge-pending" style={{ marginRight: 8 }}>PENDING</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Trade #{t.id}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>PKR {Number(t.price).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
