import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function MyTrades() {
  const [tab, setTab] = useState('pending')   // 'pending' | 'history'
  const [pending, setPending]   = useState([])
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [confirmState, setConfirmState] = useState({})  // { [tradeId]: {code, loading, error, success} }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [pRes, hRes] = await Promise.all([
        api.get('/trades/pending'),
        api.get('/trades/history'),
      ])
      setPending(pRes.data)
      setHistory(hRes.data)
    } catch (e) {
      setError('Failed to load trades.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleConfirm = async (tradeId) => {
    const state = confirmState[tradeId] || {}
    if (!state.code?.trim() || state.code.length !== 6) {
      setConfirmState(prev => ({...prev, [tradeId]: {...state, error: 'Enter the exact 6-digit code.'}}))
      return
    }
    setConfirmState(prev => ({...prev, [tradeId]: {...state, loading: true, error: ''}}))
    try {
      await api.post(`/trades/${tradeId}/confirm`, { release_code: state.code })
      setConfirmState(prev => ({...prev, [tradeId]: {...state, loading: false, success: 'Trade confirmed! Reputation awarded.'}}))
      load()
    } catch (err) {
      setConfirmState(prev => ({...prev, [tradeId]: {
        ...state, loading: false,
        error: err.response?.data?.detail || 'Confirmation failed.',
      }}))
    }
  }

  const trades = tab === 'pending' ? pending : history

  if (loading) return (
    <div className="page-wrap" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )

  return (
    <div className="page-wrap fade-up" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <div className="page-header">
        <h1>My Trades</h1>
        <p>Manage pending settlements and view your completed trade history.</p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending Settlement {pending.length > 0 && <span className="badge-count">{pending.length}</span>}
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          Completed Trades {history.length > 0 && <span className="badge-count">{history.length}</span>}
        </button>
      </div>

      {trades.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {tab === 'pending' ? '⏳' : '📋'}
          </div>
          <h3 style={{ fontSize: 17, marginBottom: 8 }}>
            {tab === 'pending' ? 'No pending trades' : 'No completed trades yet'}
          </h3>
          <p className="text-muted text-sm">
            {tab === 'pending'
              ? 'When your buy/sell orders get matched, trades will appear here.'
              : 'Completed trades will be shown here after settlement.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {trades.map(trade => {
            const isPending = trade.status === 'PENDING'
            const isBuyer   = !!trade.release_code
            const cs = confirmState[trade.id] || {}

            return (
              <div key={trade.id} className="card fade-up" style={{
                borderLeft: `4px solid ${isPending ? 'var(--accent)' : 'var(--green)'}`,
              }}>
                {/* Trade Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>Trade #{trade.id}</span>
                      {trade.item_name && (
                        <span style={{
                          background: 'var(--accent-dim)', color: 'var(--accent-light)',
                          fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                        }}>
                          {trade.item_name}
                        </span>
                      )}
                      <span className={`status-badge ${isPending ? 'status-active' : 'status-filled'}`}>
                        {trade.status}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                        color: isBuyer ? 'var(--green)' : 'var(--accent)',
                        background: isBuyer ? 'var(--green-bg)' : 'var(--accent-dim)',
                        padding: '3px 8px', borderRadius: 12,
                      }}>
                        YOU ARE {isBuyer ? 'BUYER' : 'SELLER'}
                      </span>
                    </div>
                    {/* Counterparty */}
                    {trade.counterparty_name && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                        {isBuyer ? 'Seller' : 'Buyer'}:{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>{trade.counterparty_name}</strong>
                        {trade.counterparty_degree && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                            · {trade.counterparty_degree}
                          </span>
                        )}
                        {trade.counterparty_batch && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                            ({trade.counterparty_batch})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)', fontFamily: 'Outfit, sans-serif' }}>
                      PKR {Number(trade.price).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Qty: {trade.quantity}
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="flex gap-4" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, flexWrap: 'wrap' }}>
                  <span>Matched: {new Date(trade.matched_at).toLocaleString()}</span>
                  {trade.completed_at && (
                    <span>Completed: {new Date(trade.completed_at).toLocaleString()}</span>
                  )}
                </div>

                {/* Pending settlement area */}
                {isPending && (
                  <div>
                    {isBuyer ? (
                      /* BUYER: show release code */
                      <div style={{
                        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 20,
                        borderTop: '1px solid var(--border)',
                      }}>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                          <strong>Your Release Code</strong> — Share this with{' '}
                          <strong>{trade.counterparty_name || 'the seller'}</strong>{' '}
                          only AFTER you have received the item physically and paid them:
                        </p>
                        <div className="release-code-box">{trade.release_code}</div>
                        <div style={{
                          marginTop: 14, padding: '10px 14px', borderRadius: 8,
                          background: 'rgba(251,188,4,0.08)', border: '1px solid rgba(251,188,4,0.2)',
                          fontSize: 12, color: '#fbbc04',
                        }}>
                          ⚠ Do NOT share this code until you have physically received the item. Once the seller enters it, the trade is final.
                        </div>
                      </div>
                    ) : (
                      /* SELLER: enter code form */
                      <div style={{
                        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 20,
                        borderTop: '1px solid var(--border)',
                      }}>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                          After handing the item to{' '}
                          <strong>{trade.counterparty_name || 'the buyer'}</strong>{' '}
                          and receiving payment, ask them for the 6-digit code to complete the trade:
                        </p>

                        {cs.success ? (
                          <div className="alert alert-success">{cs.success}</div>
                        ) : (
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: 160, margin: 0 }}>
                              <label style={{ fontSize: 12 }}>Release Code (6 digits)</label>
                              <input
                                type="text" maxLength={6} pattern="[0-9]{6}"
                                placeholder="e.g. 047391"
                                value={cs.code || ''}
                                onChange={e => setConfirmState(prev => ({
                                  ...prev, [trade.id]: { ...(prev[trade.id] || {}), code: e.target.value.replace(/\D/g, '').slice(0,6) }
                                }))}
                                style={{ letterSpacing: '0.2em', fontFamily: 'monospace', fontSize: 18, textAlign: 'center' }}
                              />
                            </div>
                            <button
                              className="btn btn-primary"
                              onClick={() => handleConfirm(trade.id)}
                              disabled={cs.loading}
                              style={{ height: 42 }}
                            >
                              {cs.loading ? <span className="spinner" /> : 'Confirm Trade'}
                            </button>
                          </div>
                        )}
                        {cs.error && <div className="alert alert-error" style={{ marginTop: 10 }}>{cs.error}</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
