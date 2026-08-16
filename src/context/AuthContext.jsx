import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import {
  STORAGE,
  ROLES,
  getAuthScope,
  getAuthScopeFromWindow,
} from '../config'
import {
  fetchMe,
  loginUser,
  registerUser,
  googleLogin as googleLoginApi,
} from '../services/authService'
import { signInWithGoogleFirebase, signOutFirebase } from '../services/firebaseGoogleAuth'

const AuthContext = createContext(null)

function keysForScope(scope) {
  return scope === 'ops'
    ? { token: STORAGE.OPS_TOKEN, user: STORAGE.OPS_USER }
    : { token: STORAGE.TOKEN, user: STORAGE.USER }
}

function readStore(scope, preferLocal = true) {
  const keys = keysForScope(scope)
  if (preferLocal) {
    const token = localStorage.getItem(keys.token)
    if (token) {
      try {
        const raw = localStorage.getItem(keys.user)
        return { token, user: raw ? JSON.parse(raw) : null, remember: true }
      } catch {
        return { token, user: null, remember: true }
      }
    }
  }
  const token = sessionStorage.getItem(keys.token)
  if (!token) return { token: null, user: null, remember: true }
  try {
    const raw = sessionStorage.getItem(keys.user)
    return { token, user: raw ? JSON.parse(raw) : null, remember: false }
  } catch {
    return { token, user: null, remember: false }
  }
}

function writeStore(scope, token, user, remember) {
  const keys = keysForScope(scope)
  const store = remember ? localStorage : sessionStorage
  const other = remember ? sessionStorage : localStorage
  other.removeItem(keys.token)
  other.removeItem(keys.user)
  store.setItem(keys.token, token)
  store.setItem(keys.user, JSON.stringify(user))
}

function clearStore(scope) {
  const keys = keysForScope(scope)
  localStorage.removeItem(keys.token)
  localStorage.removeItem(keys.user)
  sessionStorage.removeItem(keys.token)
  sessionStorage.removeItem(keys.user)
}

function bootScope(scope) {
  const initial = readStore(scope, true)
  if (initial.token) return initial
  return readStore(scope, false)
}

/**
 * One-time: if an old shared session held a staff user in the shop jar,
 * move it into the ops jar so portal login stays separate.
 */
function migrateLegacyStaffSession() {
  const shop = bootScope('shop')
  const role = shop.user?.role
  if (role !== ROLES.ADMIN && role !== ROLES.SELLER) return
  const ops = bootScope('ops')
  if (!ops.token && shop.token) {
    writeStore('ops', shop.token, shop.user, shop.remember !== false)
  }
  clearStore('shop')
}

if (typeof window !== 'undefined') {
  try {
    migrateLegacyStaffSession()
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }) {
  // Scope follows React Router location (AuthProvider sits inside BrowserRouter).
  const { pathname } = useLocation()
  const scope = getAuthScope(pathname)

  const [shopSession, setShopSession] = useState(() => {
    const boot = bootScope('shop')
    return {
      user: boot.user,
      token: boot.token,
      rememberMe: boot.remember !== false,
      loading: Boolean(boot.token),
    }
  })
  const [opsSession, setOpsSession] = useState(() => {
    const boot = bootScope('ops')
    return {
      user: boot.user,
      token: boot.token,
      rememberMe: boot.remember !== false,
      loading: Boolean(boot.token),
    }
  })
  const [error, setError] = useState(null)

  const active = scope === 'ops' ? opsSession : shopSession

  const persistSession = useCallback(
    (nextScope, nextToken, nextUser, options = {}) => {
      const remember = options.remember !== false
      writeStore(nextScope, nextToken, nextUser, remember)
      const patch = {
        token: nextToken,
        user: nextUser,
        rememberMe: remember,
        loading: false,
      }
      if (nextScope === 'ops') setOpsSession((prev) => ({ ...prev, ...patch }))
      else setShopSession((prev) => ({ ...prev, ...patch }))
    },
    []
  )

  const clearSession = useCallback((nextScope) => {
    clearStore(nextScope)
    const patch = {
      token: null,
      user: null,
      loading: false,
    }
    if (nextScope === 'ops') setOpsSession((prev) => ({ ...prev, ...patch }))
    else setShopSession((prev) => ({ ...prev, ...patch }))
  }, [])

  // Validate whichever jar currently has a token.
  useEffect(() => {
    const jars = [
      { scope: 'shop', session: shopSession, setSession: setShopSession },
      { scope: 'ops', session: opsSession, setSession: setOpsSession },
    ]

    let cancelled = false

    jars.forEach(({ scope: jar, session, setSession }) => {
      if (!session.token) {
        if (session.loading) {
          setSession((prev) => ({ ...prev, loading: false }))
        }
        return
      }

      ;(async () => {
        try {
          const me = await fetchMe(session.token)
          if (cancelled) return
          // Staff must not live in the shop jar
          if (
            jar === 'shop' &&
            (me?.role === ROLES.ADMIN || me?.role === ROLES.SELLER)
          ) {
            writeStore('ops', session.token, me, session.rememberMe)
            clearStore('shop')
            setOpsSession((prev) => ({
              ...prev,
              token: session.token,
              user: me,
              rememberMe: session.rememberMe,
              loading: false,
            }))
            setShopSession((prev) => ({
              ...prev,
              token: null,
              user: null,
              loading: false,
            }))
            return
          }
          // Customers must not live in the ops jar
          if (
            jar === 'ops' &&
            me?.role &&
            me.role !== ROLES.ADMIN &&
            me.role !== ROLES.SELLER
          ) {
            clearStore('ops')
            setOpsSession((prev) => ({
              ...prev,
              token: null,
              user: null,
              loading: false,
            }))
            return
          }
          setSession((prev) => ({ ...prev, user: me, loading: false }))
          writeStore(jar, session.token, me, session.rememberMe)
        } catch (err) {
          if (cancelled) return
          const status = err?.status
          const keys = keysForScope(jar)
          const hasCachedUser = Boolean(
            localStorage.getItem(keys.user) || sessionStorage.getItem(keys.user)
          )
          const mustClear =
            status === 401 || status === 403 || !hasCachedUser
          if (mustClear) {
            clearStore(jar)
            setSession((prev) => ({
              ...prev,
              token: null,
              user: null,
              loading: false,
            }))
          } else {
            setSession((prev) => ({ ...prev, loading: false }))
          }
        }
      })()
    })

    return () => {
      cancelled = true
    }
    // Only re-validate when tokens change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSession.token, opsSession.token])

  useEffect(() => {
    const onExpired = (event) => {
      const expiredScope = event?.detail?.scope || getAuthScopeFromWindow()
      clearSession(expiredScope)
      setError(null)
    }
    window.addEventListener('pahadlink:auth-expired', onExpired)
    return () => window.removeEventListener('pahadlink:auth-expired', onExpired)
  }, [clearSession])

  const login = useCallback(
    async (credentials) => {
      setError(null)
      const loginScope =
        credentials.scope === 'ops' || credentials.scope === 'shop'
          ? credentials.scope
          : scope
      const data = await loginUser({
        username: credentials.username?.trim(),
        password: credentials.password,
      })
      const role = data.user?.role
      const isStaff = role === ROLES.ADMIN || role === ROLES.SELLER

      // Keep jars clean: shop login never stores staff; ops login never stores customers.
      if (loginScope === 'shop' && isStaff) {
        return data.user
      }
      if (loginScope === 'ops' && !isStaff) {
        return data.user
      }

      persistSession(loginScope, data.token, data.user, {
        remember: credentials.remember !== false,
      })
      return data.user
    },
    [persistSession, scope]
  )

  const register = useCallback(
    async (payload) => {
      setError(null)
      const data = await registerUser({
        name: payload.name?.trim(),
        email: payload.email?.trim().toLowerCase(),
        username: payload.username?.trim().toLowerCase() || undefined,
        password: payload.password,
      })
      if (!data?.token || !data?.user) {
        throw new Error('Registration failed — no session returned from server')
      }
      persistSession('shop', data.token, data.user, { remember: true })
      return data.user
    },
    [persistSession]
  )

  const loginWithGoogle = useCallback(async () => {
    setError(null)
    const { idToken } = await signInWithGoogleFirebase()
    if (!idToken) {
      throw new Error('Google sign-in did not return a token. Try again.')
    }
    const data = await googleLoginApi(idToken)
    if (!data?.token || !data?.user) {
      throw new Error(
        'Google sign-in failed — account was not saved. Check API/MongoDB and try again.'
      )
    }
    const role = data.user?.role
    if (role === ROLES.ADMIN || role === ROLES.SELLER) {
      // Staff must use the ops portal login — never land in the shop jar.
      return data.user
    }
    persistSession('shop', data.token, data.user, { remember: true })
    return data.user
  }, [persistSession])

  const logout = useCallback(() => {
    clearSession(scope)
    setError(null)
    // Firebase only used for shop Google login
    if (scope === 'shop') void signOutFirebase()
  }, [clearSession, scope])

  const hasRole = useCallback(
    (...roles) => Boolean(active.user && roles.includes(active.user.role)),
    [active.user]
  )

  const value = useMemo(
    () => ({
      user: active.user,
      token: active.token,
      loading: active.loading,
      error,
      setError,
      scope,
      isOps: scope === 'ops',
      isAuthenticated: Boolean(active.user && active.token),
      login,
      register,
      loginWithGoogle,
      logout,
      hasRole,
      isAdmin: active.user?.role === ROLES.ADMIN,
      isSeller: active.user?.role === ROLES.SELLER,
      isCustomer: active.user?.role === ROLES.CUSTOMER,
    }),
    [
      active.user,
      active.token,
      active.loading,
      error,
      scope,
      login,
      register,
      loginWithGoogle,
      logout,
      hasRole,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
