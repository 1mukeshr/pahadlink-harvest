import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROUTES, homePathForRole, isOpsPlatformPath } from '../../config'
import PageLoader from '../layout/PageLoader'

/** Redirect guests to login; optionally require specific roles */
const ProtectedRoute = ({ children, roles, intent }) => {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <PageLoader label="Checking your account" />
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`
    const resolvedIntent =
      intent ||
      (location.pathname.startsWith('/checkout') ? 'checkout' : 'auth')

    // Ops desk (admin / seller) always uses the separate portal login.
    const needsOpsLogin =
      isOpsPlatformPath(location.pathname) ||
      (Array.isArray(roles) &&
        roles.some((r) => r === 'admin' || r === 'seller') &&
        !roles.includes('customer'))

    return (
      <Navigate
        to={needsOpsLogin ? ROUTES.ADMIN_LOGIN : ROUTES.LOGIN}
        replace
        state={{ from, intent: resolvedIntent }}
      />
    )
  }

  if (roles?.length && !roles.includes(user?.role)) {
    // Staff land on their desk — never dump them on the customer home
    return <Navigate to={homePathForRole(user)} replace />
  }

  return children
}

export default ProtectedRoute
