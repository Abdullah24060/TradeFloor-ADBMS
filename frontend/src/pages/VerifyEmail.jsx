import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../api/axios'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('loading') // loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); setMessage('No verification token found in the link.'); return }

    api.get(`/users/verify-email/${token}`)
      .then((res) => { setStatus('success'); setMessage(res.data.message) })
      .catch((err) => { setStatus('error'); setMessage(err.response?.data?.detail || 'Verification failed.') })
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div className="card-glass fade-up" style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: 48 }}>
        {status === 'loading' && (
          <>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 20px', borderWidth: 3 }} />
            <h2>Verifying your email…</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 52, marginBottom: 20 }}>✅</div>
            <h2 style={{ marginBottom: 12 }}>Email Verified!</h2>
            <p className="text-secondary" style={{ marginBottom: 28 }}>{message}</p>
            <Link to="/login" className="btn btn-primary">Sign In Now</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 52, marginBottom: 20 }}>❌</div>
            <h2 style={{ marginBottom: 12 }}>Verification Failed</h2>
            <p className="text-secondary" style={{ marginBottom: 28 }}>{message}</p>
            <Link to="/register" className="btn btn-secondary">Register Again</Link>
          </>
        )}
      </div>
    </div>
  )
}
