import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

// ── Validation helpers ─────────────────────────────────────────
const DEGREE_PREFIXES = ['BS', 'MS', 'PhD', 'BE', 'BBA', 'MBA', 'MPhil', 'BDS', 'MBBS', 'BEd', 'MEd']
const DEGREE_REGEX = /^(BS|MS|PhD|BE|BBA|MBA|MPhil|BDS|MBBS|BEd|MEd)\s+\S.{1,60}$/
const BATCH_REGEX = /^[A-Z]{2,8}-20(1[0-9]|2[0-9]|3[0-5])$/

function validateDegree(v) {
  v = v.trim()
  if (!v) return 'Degree is required.'
  if (!DEGREE_REGEX.test(v)) {
    return `Must start with a level prefix (${DEGREE_PREFIXES.slice(0,5).join(', ')}...) followed by the subject. e.g. "BS Computer Science"`
  }
  return ''
}

function validateBatch(v) {
  v = v.trim().toUpperCase()
  if (!v) return 'Batch is required.'
  if (!BATCH_REGEX.test(v)) {
    return 'Format: LETTERS-YEAR  e.g. BSAI-2024 · MSCS-2025 · PhD-2026'
  }
  return ''
}

// ── Field wrapper — MUST be defined outside Register.
//    If defined inside, React creates a new component type every render
//    and unmounts/remounts the input, losing all but the last character.
function Field({ id, label, hint, children, error }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', batch: '', degree: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading]  = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess]  = useState('')

  const update = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    // Clear field error on change
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Full name is required.'
    if (!form.email.toLowerCase().endsWith('@itu.edu.pk'))
      errs.email = 'Only @itu.edu.pk addresses are allowed.'
    if (form.password.length < 8)
      errs.password = 'Password must be at least 8 characters.'
    const degErr = validateDegree(form.degree)
    if (degErr) errs.degree = degErr
    const batErr = validateBatch(form.batch)
    if (batErr) errs.batch = batErr
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    try {
      await api.post('/users/register', {
        ...form,
        batch: form.batch.trim().toUpperCase(),
        degree: form.degree.trim(),
      })
      setSuccess('Registration successful! Check your @itu.edu.pk inbox to verify your account.')
      setForm({ name: '', email: '', password: '', batch: '', degree: '' })
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Registration failed. Please try again.')
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
      <div className="card-glass fade-up" style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'Outfit, sans-serif',
          }}>T</div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Join TradeFloor</h1>
          <p className="text-secondary text-sm">ITU Lahore students only</p>
        </div>

        {apiError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{apiError}</div>}

        {success ? (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 20 }}>{success}</div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field id="reg-name" label="Full Name" error={errors.name}>
              <input
                id="reg-name" name="name" type="text"
                placeholder="Muhammad Abdullah"
                value={form.name} onChange={update}
                style={{ borderColor: errors.name ? 'var(--red)' : undefined }}
              />
            </Field>

            <Field id="reg-email" label="ITU Email" error={errors.email}>
              <input
                id="reg-email" name="email" type="email"
                placeholder="bsXXXXXX@itu.edu.pk"
                value={form.email} onChange={update}
                style={{ borderColor: errors.email ? 'var(--red)' : undefined }}
              />
            </Field>

            <Field
              id="reg-degree" label="Degree Programme"
              hint={`e.g. BS Artificial Intelligence · MS Computer Science · PhD Mathematics`}
              error={errors.degree}
            >
              <input
                id="reg-degree" name="degree" type="text"
                placeholder="BS Artificial Intelligence"
                value={form.degree} onChange={update}
                style={{ borderColor: errors.degree ? 'var(--red)' : undefined }}
              />
            </Field>

            <Field
              id="reg-batch" label="Batch"
              hint="Format: PROGRAMME-YEAR  e.g. BSAI-2024 · MSCS-2025 · PhD-2026"
              error={errors.batch}
            >
              <input
                id="reg-batch" name="batch" type="text"
                placeholder="BSAI-2024"
                value={form.batch}
                onChange={e => update({ target: { name: 'batch', value: e.target.value.toUpperCase() } })}
                style={{ borderColor: errors.batch ? 'var(--red)' : undefined, letterSpacing: '0.04em' }}
              />
            </Field>

            <Field id="reg-pass" label="Password" error={errors.password}>
              <input
                id="reg-pass" name="password" type="password"
                placeholder="Min. 8 characters"
                value={form.password} onChange={update}
                style={{ borderColor: errors.password ? 'var(--red)' : undefined }}
              />
            </Field>

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
        )}

        <div className="divider" />
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" className="text-accent">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
