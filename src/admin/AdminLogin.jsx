import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { UserIcon, LockIcon, EyeIcon, EyeOffIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { ROUTES, ROLES, resolvePostAuthPath, homePathForRole } from '../config'
import logo from '../assets/images/logo.png'
import './admin.css'

function resolveReturnPath(from) {
  if (!from) return ''
  if (typeof from === 'string') return from
  if (typeof from === 'object' && from.pathname) {
    return `${from.pathname}${from.search || ''}${from.hash || ''}`
  }
  return ''
}

/**
 * Separate ops portal login (admin + seller) — never the shop login/register.
 */
export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, user, loading } = useAuth()
  const [form, setForm] = useState({
    username: '',
    password: '',
    remember: true,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const from = resolveReturnPath(location.state?.from)
  const isStaff =
    user?.role === ROLES.ADMIN || user?.role === ROLES.SELLER

  // Customers stay on the shop — this login is ops-only.
  if (!loading && isAuthenticated && user?.role === ROLES.CUSTOMER) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  if (!loading && isAuthenticated && isStaff) {
    const dest = resolvePostAuthPath(user, from || homePathForRole(user))
    return <Navigate to={dest} replace />
  }

  const onChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setSubmitting(true)
    try {
      const nextUser = await login({
        username: form.username,
        password: form.password,
        remember: form.remember,
        scope: 'ops',
      })
      if (
        nextUser?.role !== ROLES.ADMIN &&
        nextUser?.role !== ROLES.SELLER
      ) {
        setMessage(
          'Staff access only. Customer accounts sign in on the shop at /login.'
        )
        return
      }
      const path = resolvePostAuthPath(nextUser, from || homePathForRole(nextUser))
      navigate(path, { replace: true })
    } catch (err) {
      setMessage(err.message || 'Could not sign in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-app admin-login">
      <div className="admin-login__shell">
        <div className="admin-login__card">
          <header className="admin-login__head">
            <img src={logo} alt="" className="admin-login__logo" />
            <p className="admin-login__eyebrow">Admin portal</p>
            <h1>Sign in</h1>
            <p className="admin-login__lead">
              Separate staff login for admin and sellers. Shop customers use the
              storefront login.
            </p>
          </header>

          <form className="admin-login__form" onSubmit={onSubmit} noValidate>
            {message ? (
              <p className="admin-login__alert" role="alert">
                {message}{' '}
                {message.includes('Customer accounts') ? (
                  <Link to={ROUTES.LOGIN}>Go to shop login</Link>
                ) : null}
              </p>
            ) : null}

            <div className="admin-login__field">
              <label htmlFor="admin-username">Username or email</label>
              <div className="admin-login__input">
                <UserIcon size={16} aria-hidden="true" />
                <input
                  id="admin-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={form.username}
                  onChange={onChange}
                  required
                  placeholder="admin"
                />
              </div>
            </div>

            <div className="admin-login__field">
              <label htmlFor="admin-password">Password</label>
              <div className="admin-login__input">
                <LockIcon size={16} aria-hidden="true" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={onChange}
                  required
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="admin-login__eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOffIcon size={16} />
                  ) : (
                    <EyeIcon size={16} />
                  )}
                </button>
              </div>
            </div>

            <label className="admin-login__remember">
              <input
                type="checkbox"
                name="remember"
                checked={form.remember}
                onChange={onChange}
              />
              <span>Keep me signed in</span>
            </label>

            <button
              type="submit"
              className="admin-login__submit"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in to portal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
