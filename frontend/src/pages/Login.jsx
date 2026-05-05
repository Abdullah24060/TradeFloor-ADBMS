import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.08) 0%, transparent 60%)',
    }}>
      <div className="card-glass fade-up" style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'Outfit, sans-serif',
          }}>T</div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Welcome Back</h1>
          <p className="text-secondary text-sm">Sign in to your TradeFloor account</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label htmlFor="login-email">ITU Email</label>
            <input
              id="login-email" name="email" type="email"
              placeholder="bsXXXXXX@itu.edu.pk"
              value={form.email} onChange={update} required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-pass">Password</label>
            <input
              id="login-pass" name="password" type="password"
              placeholder="Your password"
              value={form.password} onChange={update} required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <div className="divider" />
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          New to TradeFloor?{' '}
          <Link to="/register" className="text-accent">Create account</Link>
        </p>
      </div>
    </div>
  )
}
