/**
 * App settings - change here once
 */
import { MAX_QTY_PER_ITEM_PER_CUSTOMER as SHARED_MAX_QTY } from '@pahadlink/shared/constants'

/** Max units of the same product one customer may buy in one order */
export const MAX_QTY_PER_ITEM_PER_CUSTOMER = SHARED_MAX_QTY

export {
  getApiBaseUrl,
  isHostedStaticApp,
  isLocalAppHost,
  loadRuntimeConfig,
} from './api'

export const STORAGE = {
  TOKEN: 'pahadlink_token',
  USER: 'pahadlink_user',
  /** Separate staff (admin/seller) portal session — never shared with shop login */
  OPS_TOKEN: 'pahadlink_ops_token',
  OPS_USER: 'pahadlink_ops_user',
  CART: 'pahadlink_cart',
  WISHLIST: 'pahadlink_wishlist',
  LOCATION: 'pahadlink_location',
  ADDRESSES: 'pahadlink_addresses',
  THEME: 'pahadlink_theme',
  CHECKOUT_ADDRESS: 'pahadlink_checkout_address',
  REVIEWS: 'pahadlink_reviews',
  PROMO_BAR: 'pahadlink_promo_bar_dismissed',
}

export const ROLES = {
  CUSTOMER: 'customer',
  SELLER: 'seller',
  ADMIN: 'admin',
}

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  CART: '/bag',
  CHECKOUT: '/checkout',
  SHOP: '/shop',
  CATEGORY: '/category/:id',
  PRODUCT: '/product/:id',
  ACCOUNT: '/account',
  ORDERS: '/orders',
  ADMIN: '/admin',
  ADMIN_LOGIN: '/admin/login',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_INVENTORY: '/admin/inventory',
  ADMIN_LEADS: '/admin/leads',
  SELLER: '/seller',
  CONTACT: '/contact',
  ABOUT: '/about',
  PRIVACY: '/privacy',
  TERMS: '/terms',
}

export const productPath = (id) => `/product/${id}`

export const categoryPath = (id, type) => {
  const base = `/category/${id}`
  if (!type) return base
  return `${base}?type=${encodeURIComponent(type)}`
}

export const AUTH_PATHS = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
  ROUTES.ADMIN_LOGIN,
]

/** Admin / seller console paths — always a separate shell from the shop. */
export function isOpsPlatformPath(pathname = '') {
  return (
    pathname === ROUTES.ADMIN ||
    pathname.startsWith(`${ROUTES.ADMIN}/`) ||
    pathname === ROUTES.SELLER ||
    pathname.startsWith(`${ROUTES.SELLER}/`)
  )
}

/** Which auth jar to use for the current URL (shop vs staff portal). */
export function getAuthScope(pathname = '') {
  return isOpsPlatformPath(pathname) ? 'ops' : 'shop'
}

/** Read scope from the current browser URL (works outside React too). */
export function getAuthScopeFromWindow() {
  if (typeof window === 'undefined') return 'shop'

  let pathname = String(window.location.pathname || '/')
  const hash = String(window.location.hash || '')

  // Legacy HashRouter bookmarks only when path is still root: /#/admin
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const pathWithoutBase =
    base && pathname.startsWith(base)
      ? pathname.slice(base.length) || '/'
      : pathname
  if (
    hash.startsWith('#/') &&
    (pathWithoutBase === '/' || pathWithoutBase === '')
  ) {
    pathname = hash.slice(1).split('?')[0] || '/'
  } else {
    pathname = pathWithoutBase
  }

  pathname = pathname.replace(/\/$/, '') || '/'
  return getAuthScope(pathname)
}

/**
 * Password-recovery pages stay reachable for staff; every other storefront
 * URL bounces them back to their desk.
 */
export function isStaffAllowedStorefrontPath(pathname = '') {
  return (
    pathname === ROUTES.FORGOT_PASSWORD ||
    pathname === ROUTES.RESET_PASSWORD
  )
}

/** Default landing path for a signed-in role (ops staff → desk, not storefront). */
export function homePathForRole(user) {
  const role = user?.role
  if (role === ROLES.ADMIN) return ROUTES.ADMIN
  if (role === ROLES.SELLER) return ROUTES.SELLER
  return ROUTES.HOME
}

/**
 * Where to send the user after login/register.
 * Checkout intent → Home first (address must be completed before checkout).
 * Staff go to their desk unless returning to an ops URL.
 */
export function resolvePostAuthPath(user, from, intent) {
  const role = user?.role
  const isStaff = role === ROLES.ADMIN || role === ROLES.SELLER
  const dest =
    typeof from === 'string'
      ? from
      : from?.pathname
        ? `${from.pathname}${from.search || ''}${from.hash || ''}`
        : ''

  // After login from bag/checkout: land on Home and collect address first
  if (intent === 'checkout' || dest.startsWith(ROUTES.CHECKOUT)) {
    if (isStaff) return homePathForRole(user)
    return ROUTES.HOME
  }

  if (isStaff) {
    if (
      (dest.startsWith(ROUTES.ADMIN) && dest !== ROUTES.ADMIN_LOGIN) ||
      dest.startsWith(ROUTES.SELLER)
    ) {
      return dest
    }
    return homePathForRole(user)
  }

  return dest || ROUTES.HOME
}

/** Navigation state after checkout-intent login */
export function postCheckoutLoginState() {
  return {
    needAddress: true,
    resumeCheckout: true,
    checkoutHint:
      'Add your current location and delivery address, then continue to checkout. Mobile number is required on the checkout page before placing the order.',
  }
}

/** Hide header category bar on these pages */
export const HIDE_CATEGORY_NAV_PATHS = [
  ROUTES.CHECKOUT,
  ROUTES.ACCOUNT,
  ROUTES.ADMIN,
  ROUTES.SELLER,
  ROUTES.TERMS,
  ROUTES.PRIVACY,
  ROUTES.CONTACT,
  ROUTES.ABOUT,
]
