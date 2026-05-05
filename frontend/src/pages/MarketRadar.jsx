import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const POLL_INTERVAL = 5000

// ── User Profile Popup ───────────────────────────────────────────
function UserProfilePopup({ users, onClose, side }) {
  if (!users) return null
  const color = side === 'BUY' ? 'var(--green)' : 'var(--red)'
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div className="card-glass fade-up" style={{ maxWidth: 420, width: '90%', padding: 28 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17 }}>
            <span style={{ color }}>{side === 'BUY' ? 'Buyers' : 'Sellers'}</span> at this price
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {users.length === 0 ? (
          <p className="text-muted text-sm">No active orders found at this level.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {users.map((u, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                borderLeft: `3px solid ${color}`,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {u.degree || '—'} · {u.batch || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Qty: <strong>{u.quantity}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 2 }}>
                    ★ Rep {u.reputation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Order Book Table (one side) ─────────────────────────────────
function OrderBookTable({ side, rows, itemId, onRowClick }) {
  const isBuy = side === 'BUY'
  const color = isBuy ? 'var(--green)' : 'var(--red)'
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '8px 16px',
        background: isBuy ? 'var(--green-bg)' : 'var(--red-bg)',
        borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
        marginBottom: 2,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color }}>
          {isBuy ? 'Bids (Buy Orders)' : 'Asks (Sell Orders)'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {rows.length} levels · click row to see traders
        </span>
      </div>
      <div className="table-wrap" style={{ borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
        <table>
          <thead>
            <tr>
              <th>Price (PKR)</th>
              <th>Qty</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                  No {isBuy ? 'buyers' : 'sellers'} right now
                </td>
              </tr>
            ) : rows.map((r, i) => (
              <tr key={i}
                style={{
                  background: i === 0 ? `${color}10` : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => onRowClick(r.price, side)}
                title="Click to see who placed this order"
              >
                <td style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? color : 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {Number(r.price).toLocaleString()}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>👁</span>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{r.total_quantity}</td>
                <td style={{ color: 'var(--text-muted)' }}>{r.order_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Market Radar Page ─────────────────────────────────────
export default function MarketRadar() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [items, setItems]   = useState([])
  const [itemId, setItemId] = useState(Number(params.get('item_id')) || null)
  const [radar, setRadar]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [order, setOrder]   = useState({ order_type: 'BUY', price: '', quantity: 1 })
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState('')
  const [placeResult, setPlaceResult] = useState(null)
  const [popup, setPopup]   = useState(null)   // { users: [], side: 'BUY'|'SELL' }
  const [popupLoading, setPopupLoading] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    api.get('/market/items').then(r => {
      setItems(r.data)
      if (!itemId && r.data.length > 0) setItemId(r.data[0].id)
    })
  }, [])

  const fetchRadar = useCallback(async (id) => {
    if (!id) return
    try {
      const res = await api.get(`/market/radar?item_id=${id}`)
      setRadar(res.data)
    } catch { /* ignore poll errors */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!itemId) return
    setLoading(true); setRadar(null); setPlaceResult(null); setPlaceError('')
    setParams({ item_id: itemId })
    fetchRadar(itemId)
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => fetchRadar(itemId), POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [itemId])

  const handleRowClick = async (price, side) => {
    if (!itemId) return
    setPopupLoading(true)
    setPopup({ users: [], side })
    try {
      const res = await api.get('/market/orders-at-price', {
        params: { item_id: itemId, order_type: side, price }
      })
      setPopup({ users: res.data, side })
    } catch {
      setPopup({ users: [], side })
    } finally {
      setPopupLoading(false)
    }
  }

  const handlePlaceOrder = async (e) => {
    e.preventDefault()
    if (!isLoggedIn) { navigate('/login'); return }
    setPlaceError(''); setPlaceResult(null); setPlacing(true)
    try {
      const res = await api.post('/orders', {
        item_id: itemId,
        order_type: order.order_type,
        price: Number(order.price),
        quantity: Number(order.quantity),
      })
      setPlaceResult(res.data)
      fetchRadar(itemId)
    } catch (err) {
      setPlaceError(err.response?.data?.detail || 'Failed to place order.')
    } finally {
      setPlacing(false)
    }
  }

  const chartData = [
    ...(radar?.bids || []).slice(0, 5).reverse().map(r => ({ price: r.price, bid: r.total_quantity })),
    ...(radar?.asks || []).slice(0, 5).map(r => ({ price: r.price, ask: r.total_quantity })),
  ]

  return (
    <div className="page-wrap fade-up" style={{ paddingTop: 32, paddingBottom: 64 }}>
      {/* User popup */}
      {popup && (
        <UserProfilePopup
          users={popupLoading ? null : popup.users}
          side={popup.side}
          onClose={() => setPopup(null)}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2" style={{ gap: 10, marginBottom: 6 }}>
              <span className="live-dot" />
              <h1>Market Radar</h1>
            </div>
            <p>Live order book — refreshes every 5 s · click any row to see traders</p>
          </div>
          {radar && (
            <div style={{ textAlign: 'right' }}>
              {radar.last_trade_price && (
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', fontFamily: 'Outfit, sans-serif' }}>
                  PKR {Number(radar.last_trade_price).toLocaleString()}
                </div>
              )}
              {radar.spread !== null && radar.spread !== undefined && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Spread: PKR {Number(radar.spread).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Item selector */}
      <div className="flex gap-3" style={{ marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Select Item:</label>
        <select value={itemId || ''} onChange={e => setItemId(Number(e.target.value))} style={{ width: 'auto', maxWidth: 360 }}>
          {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
        </select>
      </div>

      {loading && !radar && (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      )}

      {radar && (
        <>
          {/* Order Book */}
          <div className="flex gap-4" style={{ marginBottom: 32, flexWrap: 'wrap' }}>
            <OrderBookTable side="BUY"  rows={radar.bids} itemId={itemId} onRowClick={handleRowClick} />
            <OrderBookTable side="SELL" rows={radar.asks} itemId={itemId} onRowClick={handleRowClick} />
          </div>

          {/* Depth Chart */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 15, marginBottom: 16 }}>Order Depth Chart</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="price" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={v => `PKR ${Number(v).toLocaleString()}`} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={v => `PKR ${Number(v).toLocaleString()}`}
                  />
                  <Bar dataKey="bid" fill="var(--green)" radius={[4,4,0,0]} />
                  <Bar dataKey="ask" fill="var(--red)"   radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Place Order */}
      <div className="card">
        <h3 style={{ fontSize: 17, marginBottom: 20 }}>
          {isLoggedIn ? 'Place a Limit Order' : 'Sign in to Trade'}
        </h3>

        {placeResult && (
          <div className="fade-up" style={{ marginBottom: 20 }}>
            <div className="alert alert-success" style={{ marginBottom: 12 }}>
              Order placed!
              {placeResult.trades?.length > 0
                ? ` Instantly matched ${placeResult.trades.length} trade(s).`
                : ' Your order is now live in the order book.'}
            </div>
            {placeResult.trades?.map(t => t.release_code && (
              <div key={t.id} style={{
                marginTop: 16, textAlign: 'center', padding: 24,
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
              }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Your Release Code for Trade #{t.id} — share with seller <strong>ONLY after</strong> you have received the item and paid:
                </p>
                <div className="release-code-box">{t.release_code}</div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                  Also visible under My Trades → Pending
                </p>
              </div>
            ))}
          </div>
        )}

        {placeError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{placeError}</div>}

        {isLoggedIn ? (
          <form onSubmit={handlePlaceOrder}>
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label>Order Type</label>
                <select value={order.order_type} onChange={e => setOrder({...order, order_type: e.target.value})}>
                  <option value="BUY">BUY — I want to buy</option>
                  <option value="SELL">SELL — I want to sell</option>
                </select>
              </div>
              <div className="form-group">
                <label>Price (PKR)</label>
                <input type="number" min="1" step="1" placeholder="e.g. 1500"
                  value={order.price} onChange={e => setOrder({...order, price: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input type="number" min="1" max="100"
                  value={order.quantity} onChange={e => setOrder({...order, quantity: e.target.value})} required />
              </div>
            </div>

            {/* Explanation */}
            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 13 }}>
              {order.order_type === 'BUY'
                ? 'BUY order: you are willing to pay up to this price. If a seller matches, you get a 6-digit Release Code.'
                : 'SELL order: you are willing to sell at this price. If a buyer matches, meet on campus and collect cash first.'}
            </div>

            <button className="btn btn-primary" type="submit" disabled={placing || !itemId}>
              {placing ? <span className="spinner" /> : `Place ${order.order_type} Order`}
            </button>
          </form>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            <a href="/login" className="text-accent">Sign in</a> to place buy and sell orders.
          </p>
        )}
      </div>
    </div>
  )
}
