import { useLayoutEffect } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ScrollToTop, RouteProgress } from './components/layout'
import AppRoutes from './routes/AppRoutes'

const ROUTER_BASENAME = (() => {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return base && base !== '/' ? base : undefined
})()

/** Old bookmarked /#/admin URLs → /admin (no hash). */
function LegacyHashRedirect() {
  const navigate = useNavigate()

  useLayoutEffect(() => {
    const { hash } = window.location
    if (!hash.startsWith('#/')) return

    const raw = hash.slice(1) || '/'
    const qIndex = raw.indexOf('?')
    const nextPath = (qIndex >= 0 ? raw.slice(0, qIndex) : raw) || '/'
    const nextSearch = qIndex >= 0 ? raw.slice(qIndex) : ''

    navigate({ pathname: nextPath, search: nextSearch }, { replace: true })

    const base = ROUTER_BASENAME || ''
    window.history.replaceState(null, '', `${base}${nextPath}${nextSearch}`)
  }, [navigate])

  return null
}

function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AuthProvider>
        <LegacyHashRedirect />
        <ScrollToTop />
        <RouteProgress />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
