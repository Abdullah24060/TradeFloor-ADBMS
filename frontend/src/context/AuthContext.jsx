import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tf_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('tf_token') || null)

  const login = useCallback(async (email, password) => {
    const res = await api.post('/users/login', { email, password })
    const { access_token } = res.data
    localStorage.setItem('tf_token', access_token)
    setToken(access_token)
    // fetch profile
    const profile = await api.get('/users/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    localStorage.setItem('tf_user', JSON.stringify(profile.data))
    setUser(profile.data)
    return profile.data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('tf_token')
    localStorage.removeItem('tf_user')
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/users/me')
      localStorage.setItem('tf_user', JSON.stringify(res.data))
      setUser(res.data)
    } catch { /* ignore */ }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
