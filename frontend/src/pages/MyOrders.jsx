import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function MyOrders() {
  const [orders, setOrders]   = useState([])
  const [items, setItems]     = useState({})
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)
  const [filter, setFilter]   = useState('ALL')

  useEffect(() => {
    Promise.all([api.get('/orders'), api.get('/market/items')]).then(([ordRes, itemRes]) => {
      setOrders(ordRes.data)
      const map = {}
      itemRes.data.forEach(i => { map[i.id] = i.name })
      setItems(map)
    }).finally(() => setLoading(false))
  }, [])

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order?')) return
    setCancelling(orderId)
    try {
      await api.delete(`/orders/${orderId}`)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' } : o))
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not cancel order.')
    } finally {
      setCancelling(null)
    }
  }

  const shown = filter === 'ALL' ? orders : orders.filter(o => o.status === filter)

  const STATUS_FILTERS = ['ALL', 'ACTIVE', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'EXPIRED']

  return (
    <div className="page-wrap fade-up" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <div className="page-header">
        <h1>My Orders</h1>
        <p>All your limit orders and their current status</p>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><span className="spinner" style={{ width:36,height:36 }} /></div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No orders</h3>
          <p>Place your first order from the Market Radar page</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Type</th>
                <th>Price (PKR)</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Placed</th>
                <th>Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(o => (
                <tr key={o.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{o.id}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{items[o.item_id] || `Item #${o.item_id}`}</td>
                  <td><span className={`badge badge-${o.order_type.toLowerCase()}`}>{o.order_type}</span></td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {Number(o.price).toLocaleString()}
                  </td>
                  <td>{o.quantity}</td>
                  <td>
                    <span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(o.expires_at).toLocaleDateString()}
                  </td>
                  <td>
                    {o.status === 'ACTIVE' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleCancel(o.id)}
                        disabled={cancelling === o.id}
                      >
                        {cancelling === o.id ? <span className="spinner" style={{width:14,height:14}} /> : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
