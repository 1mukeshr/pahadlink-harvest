import { useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { UserIcon, MailIcon, GoogleIcon } from '../../components/icons'
import AuthLayout from '../../components/auth/AuthLayout'
import PasswordField from '../../components/auth/PasswordField'
import { useAuth } from '../../context/AuthContext'
import {
  ROUTES,
  ROLES,
  homePathForRole,
  postCheckoutLoginState,
  resolvePostAuthPath,
} from '../../config'
import { PASSWORD_MIN_LENGTH } from '@pahadlink/shared/constants'

function resolveReturnPath(from) {
  if (!from) return ''
  if (typeof from === 'string') return from
  if (typeof from === 'object' && from.pathname) {
    return `${from.pathname}${from.search || ''}${from.hash || ''}`
  }
  return ''
}

const Register = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    register,
    loginWithGoogle,
    logout,
    setError,
    isAuthenticated,
    user,
    loading,
  } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    terms: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const from = resolveReturnPath(location.state?.from)
  const intent = location.state?.intent
  const isCheckoutIntent =
    intent === 'checkout' || from.startsWith(ROUTES.CHECKOUT)

  // Already signed in → leave the form (staff → desk, customer → home/return path).
  if (!loading && isAuthenticated && user) {
    if (user.role === ROLES.ADMIN || user.role === ROLES.SELLER) {
      return <Navigate to={homePathForRole(user)} replace />
    }
    const path = resolvePostAuthPath(user, from, intent)
    return (
      <Navigate
        to={path}
        replace
        state={
          isCheckoutIntent && path === ROUTES.HOME
            ? postCheckoutLoginState()
            : undefined
        }
      />
    )
  }

  const onChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const goAfterAuth = (user) => {
    const path = resolvePostAuthPath(user, from, intent)
    navigate(path, {
      replace: true,
      state:
        isCheckoutIntent && path === ROUTES.HOME
          ? postCheckoutLoginState()
          : undefined,
    })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setError?.(null)

    if (!form.terms) {
      setMessage('Please accept the Terms & Conditions')
      return
    }

    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    const password = form.password

    if (!name) {
      setMessage('Please enter your full name')
      return
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Please enter a valid email address')
      return
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      return
    }

    setSubmitting(true)
    try {
      const user = await register({ name, email, password })
      if (!user?.id && !user?.email) {
        throw new Error('Account created but session is missing. Please sign in.')
      }
      goAfterAuth(user)
    } catch (err) {
      const text = err?.message || 'Registration failed. Please try again.'
      setMessage(text)
      setError?.(text)
    } finally {
      setSubmitting(false)
    }
  }

  const onGoogle = async () => {
    setMessage('')
    setSubmitting(true)
    try {
      const nextUser = await loginWithGoogle()
      if (
        nextUser?.role === ROLES.ADMIN ||
        nextUser?.role === ROLES.SELLER
      ) {
        logout()
        setMessage(
          nextUser.role === ROLES.ADMIN
            ? 'Admin accounts sign in at the Admin Portal only — open /admin/login.'
            : 'Seller accounts sign in at the Admin Portal only — open /admin/login.'
        )
        return
      }
      goAfterAuth(nextUser)
    } catch (err) {
      setMessage(err.message || 'Google sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Create your account">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {message ? (
          <p className="auth-alert auth-alert--error" role="alert">
            {message}{' '}
            {message.includes('Admin Portal') ? (
              <Link to={ROUTES.ADMIN_LOGIN}>Go to admin login</Link>
            ) : null}
          </p>
        ) : null}

        <div className="form-field">
          <div className="input-wrapper">
            <UserIcon className="input-icon" size={18} />
            <input
              type="text"
              placeholder=" "
              id="name"
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={onChange}
              required
              disabled={submitting}
            />
            <label htmlFor="name">Full name</label>
          </div>
        </div>

        <div className="form-field">
          <div className="input-wrapper">
            <MailIcon className="input-icon" size={18} />
            <input
              type="email"
              placeholder=" "
              id="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={onChange}
              required
              disabled={submitting}
            />
            <label htmlFor="email">Email</label>
          </div>
        </div>

        <PasswordField
          id="reg-password"
          name="password"
          label="Password"
          placeholder=" "
          autoComplete="new-password"
          value={form.password}
          onChange={onChange}
          minLength={PASSWORD_MIN_LENGTH}
          disabled={submitting}
        />

        <label className="remember-me terms-check">
          <input
            type="checkbox"
            name="terms"
            checked={form.terms}
            onChange={onChange}
            disabled={submitting}
          />
          <span>
            I agree to the{' '}
            <Link
              to={ROUTES.TERMS}
              onClick={(e) => e.stopPropagation()}
            >
              Terms &amp; Conditions
            </Link>
          </span>
        </label>

        <button className="btn-submit" type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>

        <div className="divider">
          <span>or continue with</span>
        </div>

        <button
          className="btn-google"
          type="button"
          onClick={onGoogle}
          disabled={submitting}
        >
          <GoogleIcon />
          Sign up with Google
        </button>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link
            to={ROUTES.LOGIN}
            state={{ from, intent: location.state?.intent }}
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default Register
