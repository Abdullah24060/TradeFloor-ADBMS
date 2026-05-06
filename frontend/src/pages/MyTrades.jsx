import { useEffect, useState } from 'react'
import api from '../api/axios'

// ── Animated Star Rating Component ────────────────────────────
function StarRating({ value, onChange, readOnly = false }) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => !readOnly && onChange && onChange(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          style={{
            fontSize: readOnly ? 18 : 32,
            cursor: readOnly ? 'default' : 'pointer',
            color: star <= display ? '#f5c518' : 'var(--border)',
            transition: 'color 0.15s ease, transform 0.15s ease',
            transform: !readOnly && star <= hovered ? 'scale(1.25)' : 'scale(1)',
            display: 'inline-block',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title={readOnly ? `${star} star` : `Rate ${star} out of 5`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

// ── Inline Review Form (shown inside completed trade card) ────
function ReviewForm({ trade, isBuyer, onReviewed }) {
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const counterparty = trade.counterparty_name || (isBuyer ? 'the seller' : 'the buyer')

  const submit = async () => {
    if (!rating) { setError('Please select a star rating.'); return }
    setLoading(true); setError('')
    try {
      await api.post('/reviews', {
        trade_id: trade.id,
        rating,
        comment: comment.trim() || null,
      })
      onReviewed(trade.id)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit review.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      marginTop: 16, padding: 20,
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      borderTop: '1px solid var(--border)',
      animation: 'fadeUp 0.3s ease',
    }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        How was your experience trading with <strong>{counterparty}</strong>?
      </p>

      <div style={{ marginBottom: 14 }}>
        <StarRating value={rating} onChange={setRating} />
        {rating > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
            {['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'][rating]}
          </span>
        )}
      </div>

      <textarea
        placeholder="Optional: describe your experience... (max 500 chars)"
        maxLength={500}
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
        style={{
          width: '100%', resize: 'vertical', padding: '10px 12px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
          fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
          marginBottom: 12,
        }}
      />

      {error && <div className="alert alert-error" style={{ marginBottom: 10, fontSize: 13 }}>{error}</div>}

      <button
        className="btn btn-primary"
        onClick={submit}
        disabled={loading || !rating}
        style={{ height: 38, fontSize: 13 }}
      >
        {loading ? <span className="spinner" /> : 'Submit Review'}
      </button>
    </div>
  )
}

// ── Already Reviewed Badge ────────────────────────────────────
function ReviewedBadge() {
  return (
    <div style={{
      marginTop: 16, padding: '12px 16px',
      background: 'rgba(52,211,153,0.08)',
      border: '1px solid rgba(52,211,153,0.25)',
      borderRadius: 'var(--radius-sm)',
      fontSize: 13, color: 'var(--green)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      ✓ You have reviewed this trade.
    </div>
  )
}

// ── Main MyTrades Page ─────────────────────────────────────────
export default function MyTrades() {
  const [tab, setTab] = useState('pending')
  const [pending, setPending]   = useState([])
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [confirmState, setConfirmState] = useState({})
  const [reviewedIds, setReviewedIds]   = useState(new Set())  // trade IDs already reviewed by me

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [pRes, hRes, rRes] = await Promise.all([
        api.get('/trades/pending'),
        api.get('/trades/history'),
        api.get('/reviews/my-submitted'),
      ])
      setPending(pRes.data)
      setHistory(hRes.data)
      setReviewedIds(new Set(rRes.data.map(r => r.trade_id)))
    } catch {
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

  const markReviewed = (tradeId) => {
    setReviewedIds(prev => new Set([...prev, tradeId]))
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
            const alreadyReviewed = reviewedIds.has(trade.id)

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

                {/* ── Review section (only for COMPLETED trades) ── */}
                {!isPending && (
                  alreadyReviewed
                    ? <ReviewedBadge />
                    : <ReviewForm
                        trade={trade}
                        isBuyer={isBuyer}
                        onReviewed={markReviewed}
                      />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
