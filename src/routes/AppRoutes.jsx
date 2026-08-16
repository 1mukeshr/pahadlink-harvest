/**
 * Single app route tree (BrowserRouter) — ops + storefront.
 * Keeps sidebar/admin Outlet navigation stable (no competing <Routes> shells).
 */
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth'
import PageLoader from '../components/layout/PageLoader'
import PageTransition from '../components/layout/PageTransition'
import {
  Header,
  CartDrawer,
  WishlistDrawer,
  MobileBottomNav,
} from '../components/layout'
import SupportChat from '../components/support/SupportChat'
import ThemePicker from '../components/theme/ThemePicker'
import { ShopProvider } from '../context/ShopContext'
import { useAuth } from '../context/AuthContext'
import {
  ROLES,
  ROUTES,
  homePathForRole,
  isOpsPlatformPath,
  isStaffAllowedStorefrontPath,
} from '../config'

const AdminLogin = lazy(() => import('../admin/AdminLogin'))
const AdminPortal = lazy(() => import('../admin/AdminPortal'))
const AdminPage = lazy(() => import('../admin/AdminPage'))
const AdminOrdersPage = lazy(() => import('../admin/AdminOrdersPage'))
const AdminInventoryPage = lazy(() => import('../admin/AdminInventoryPage'))
const LeadsPage = lazy(() => import('../admin/LeadsPage'))
const SellerPage = lazy(() => import('../admin/SellerPage'))

const Home = lazy(() => import('../pages/Home'))
const Login = lazy(() => import('../pages/auth/Login'))
const Register = lazy(() => import('../pages/auth/Register'))
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'))
const Shop = lazy(() => import('../pages/shop/Shop'))
const CategoryPage = lazy(() => import('../pages/shop/Category'))
const ProductDetail = lazy(() => import('../pages/shop/ProductDetail'))
const Cart = lazy(() => import('../pages/shop/Cart'))
const Checkout = lazy(() => import('../pages/shop/Checkout'))
const AccountPage = lazy(() =>
  import('../pages/account/AccountPages').then((m) => ({ default: m.AccountPage }))
)
const OrdersPage = lazy(() =>
  import('../pages/account/AccountPages').then((m) => ({ default: m.OrdersPage }))
)
const Contact = lazy(() => import('../pages/Contact'))
const About = lazy(() => import('../pages/About'))
const PrivacyPage = lazy(() =>
  import('../pages/legal/LegalPage').then((m) => ({ default: m.PrivacyPage }))
)
const TermsPage = lazy(() =>
  import('../pages/legal/LegalPage').then((m) => ({ default: m.TermsPage }))
)
const NotFound = lazy(() => import('../pages/NotFound'))

function ShellMarker() {
  const { pathname } = useLocation()
  const isOps = isOpsPlatformPath(pathname)

  useEffect(() => {
    const shell = isOps ? 'ops' : 'storefront'
    document.documentElement.dataset.shell = shell
    document.body.dataset.shell = shell
    return () => {
      delete document.documentElement.dataset.shell
      delete document.body.dataset.shell
    }
  }, [isOps])

  return null
}

function StaffStorefrontGuard({ children }) {
  const { pathname } = useLocation()
  const { user, isAuthenticated, loading } = useAuth()

  const role = user?.role
  const isStaff = role === ROLES.ADMIN || role === ROLES.SELLER
  const onAllowedPath = isStaffAllowedStorefrontPath(pathname)

  if (loading && isStaff && !onAllowedPath) {
    return <PageLoader label="Opening your desk" />
  }

  if (!loading && isAuthenticated && isStaff && !onAllowedPath) {
    return <Navigate to={homePathForRole(user)} replace />
  }

  return children
}

function StorefrontLayout() {
  return (
    <div className="storefront-root" data-portal="storefront">
      <ShopProvider>
        <StaffStorefrontGuard>
          <Header />
          <Suspense fallback={<PageLoader />}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </Suspense>
          <CartDrawer />
          <WishlistDrawer />
          <MobileBottomNav />
          <ThemePicker />
          <SupportChat />
        </StaffStorefrontGuard>
      </ShopProvider>
    </div>
  )
}

function OpsFrame({ children }) {
  return (
    <div className="ops-root" data-portal="ops">
      {children}
    </div>
  )
}

export default function AppRoutes() {
  return (
    <>
      <ShellMarker />
      <Routes>
        <Route
          path={ROUTES.ADMIN_LOGIN}
          element={
            <OpsFrame>
              <Suspense fallback={<PageLoader label="Opening portal" />}>
                <AdminLogin />
              </Suspense>
            </OpsFrame>
          }
        />

        <Route
          path={ROUTES.ADMIN}
          element={
            <OpsFrame>
              <ProtectedRoute roles={['admin']}>
                <AdminPortal />
              </ProtectedRoute>
            </OpsFrame>
          }
        >
          <Route index element={<AdminPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="*" element={<Navigate to={ROUTES.ADMIN} replace />} />
        </Route>

        <Route
          path={ROUTES.SELLER}
          element={
            <OpsFrame>
              <ProtectedRoute roles={['seller', 'admin']}>
                <SellerPage />
              </ProtectedRoute>
            </OpsFrame>
          }
        />

        <Route element={<StorefrontLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/category/:id" element={<CategoryPage />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/bag" element={<Cart />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout/cart" element={<Cart />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute intent="checkout">
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
