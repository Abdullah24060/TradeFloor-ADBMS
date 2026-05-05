import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  { value: 'textbook',    label: 'Textbook',     emoji: '📚', hint: 'Course books, notes, reference materials' },
  { value: 'ticket',      label: 'Ticket',        emoji: '🎟️', hint: 'Event passes, sports day, gala, concerts' },
  { value: 'electronics', label: 'Electronics',   emoji: '🔌', hint: 'Chargers, cables, gadgets, accessories' },
  { value: 'service',     label: 'Service',       emoji: '🤝', hint: 'Tutoring, proofreading, any skill-based help' },
  { value: 'other',       label: 'Other',         emoji: '📦', hint: 'Anything else — shoes, clothes, food, stationery' },
]

const CAT_COLOR = {
  textbook: 'var(--accent-light)',
  ticket: '#f472b6',
  electronics: 'var(--green)',
  service: 'var(--yellow)',
  other: 'var(--text-muted)',
}

export default function BrowseItems() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newItem, setNewItem]       = useState({ name: '', description: '', category: 'textbook' })
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  const load = useCallback(() => {
    api.get('/market/items').then(r => setItems(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [])

  const filtered = items.filter(i => {
    const matchCat    = filter === 'all' || i.category === filter
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
                        (i.description || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError(''); setCreateSuccess(''); setCreating(true)
    try {
      const created = await api.post('/market/items', newItem)
      setCreateSuccess(`"${created.data.name}" added! Click "View Market" on it to start trading.`)
      setNewItem({ name: '', description: '', category: 'textbook' })
      load()
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Failed to create item.')
    } finally {
      setCreating(false)
    }
  }

  const selectedCatInfo = CATEGORIES.find(c => c.value === newItem.category)

  return (
    <div className="page-wrap fade-up" style={{ paddingTop: 32, paddingBottom: 64 }}>
      {/* Header */}
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1>Browse Items</h1>
            <p>All tradeable items on campus — click any to open its live order book</p>
          </div>
          {isLoggedIn && (
            <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setCreateSuccess('') }}>
              {showCreate ? '✕ Cancel' : '+ List New Item'}
            </button>
          )}
        </div>
      </div>

      {/* ── Create Item Form ── */}
      {showCreate && (
        <div className="card fade-up" style={{ marginBottom: 28, border: '1px solid var(--accent)' }}>
          <h3 style={{ marginBottom: 4 }}>List a New Item</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
            Anyone on campus will be able to place buy/sell orders on this item.
          </p>

          {createError   && <div className="alert alert-error"   style={{ marginBottom: 14 }}>{createError}</div>}
          {createSuccess && <div className="alert alert-success" style={{ marginBottom: 14 }}>{createSuccess}</div>}

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2">
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  placeholder="e.g. Calculus by Stewart 8th Ed"
                  required maxLength={200}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Be specific — this is what buyers will search for.
                </span>
              </div>

              <div className="form-group">
                <label>Category *</label>
                {/* Category picker — visual cards instead of dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <select
                    value={newItem.category}
                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                    required
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                  {selectedCatInfo && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {selectedCatInfo.emoji} {selectedCatInfo.hint}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Description (optional but recommended)</label>
              <textarea
                value={newItem.description}
                onChange={e => setNewItem({...newItem, description: e.target.value})}
                placeholder="Condition, edition, what's included, any special notes..."
                rows={2}
                style={{ resize: 'vertical', minHeight: 60 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Tip: mention condition, brand, size, edition — anything that helps buyers decide.
              </span>
            </div>

            <div className="flex gap-3">
              <button className="btn btn-primary" type="submit" disabled={creating}>
                {creating ? <span className="spinner" /> : 'Add to Marketplace'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>

          {/* Category explanation panel */}
          <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Category guide
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {CATEGORIES.map(c => (
                <div key={c.value} style={{
                  fontSize: 12, padding: '6px 12px', borderRadius: 20,
                  background: `${CAT_COLOR[c.value]}14`,
                  color: CAT_COLOR[c.value],
                  border: `1px solid ${CAT_COLOR[c.value]}30`,
                }}>
                  {c.emoji} <strong>{c.label}</strong> — {c.hint}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              📦 Can't find a matching category? Use <strong style={{ color: 'var(--text-secondary)' }}>Other</strong> — it covers everything from clothes and shoes to stationery and food items.
            </p>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ maxWidth: 240 }}
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}>All</button>
        {CATEGORIES.map(c => (
          <button key={c.value}
            className={`btn btn-sm ${filter === c.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(c.value)}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No items found</h3>
          <p>
            {search
              ? `No results for "${search}" — try a different search.`
              : 'No items in this category yet. Be the first to list one!'}
          </p>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map(item => (
            <div key={item.id} className="card" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              onClick={() => navigate(`/market?item_id=${item.id}`)}>

              <div style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: CAT_COLOR[item.category],
                background: `${CAT_COLOR[item.category]}18`,
                marginBottom: 12, alignSelf: 'flex-start',
              }}>
                {CATEGORIES.find(c => c.value === item.category)?.emoji} {item.category}
              </div>

              <h3 style={{ fontSize: 16, marginBottom: 8, lineHeight: 1.4 }}>{item.name}</h3>

              {item.description && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5, flex: 1 }}>
                  {item.description.length > 90 ? item.description.slice(0, 90) + '…' : item.description}
                </p>
              )}

              <div className="flex justify-between items-center" style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{item.id}</span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={ev => { ev.stopPropagation(); navigate(`/market?item_id=${item.id}`) }}
                >
                  View Market →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
