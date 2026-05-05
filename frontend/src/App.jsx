import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar      from './components/Navbar'
import Landing     from './pages/Landing'
import Register    from './pages/Register'
import Login       from './pages/Login'
import VerifyEmail from './pages/VerifyEmail'
import Dashboard   from './pages/Dashboard'
import MarketRadar from './pages/MarketRadar'
import MyOrders    from './pages/MyOrders'
import MyTrades    from './pages/MyTrades'
import BrowseItems from './pages/BrowseItems'

// Guard: redirect to /login if not authenticated
function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"          element={<Landing />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/verify"    element={<VerifyEmail />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/market"    element={<MarketRadar />} />
        <Route path="/items"     element={<BrowseItems />} />
        <Route path="/orders"    element={<PrivateRoute><MyOrders /></PrivateRoute>} />
        <Route path="/trades"    element={<PrivateRoute><MyTrades /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
