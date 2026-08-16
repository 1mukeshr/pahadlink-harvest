import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '../config'
import { useAuth } from '../context/AuthContext'
import { LogOutIcon, SearchIcon } from '../components/icons/Icons'
import { AdminChromeProvider, useAdminChrome } from './adminChrome'
import logo from '../assets/images/logo.png'
import './admin.css'

const BASE = import.meta.env.BASE_URL || '/'
const FAVICON_PNG = `${BASE}favicon-32.png`
const FAVICON_ICO = `${BASE}favicon.ico`

function initialsFrom(name, email) {
  const source = String(name || email || 'P').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

function AdminTopbarSearch() {
  const { headerSearch } = useAdminChrome()

  return (
    <div className="admin-topbar__search">
      {headerSearch ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            headerSearch.onSubmit?.(event)
          }}
          role="search"
        >
          <label className="admin-toolbar__search">
            <span className="admin-toolbar__search-ico" aria-hidden="true">
              <SearchIcon size={16} />
            </span>
            <input
              type="search"
              placeholder={headerSearch.placeholder}
              value={headerSearch.value}
              onChange={headerSearch.onChange}
              aria-label={headerSearch.ariaLabel}
            />
            {headerSearch.value ? (
              <button
                type="button"
                className="admin-toolbar__clear"
                onClick={headerSearch.onClear}
                aria-label="Clear search"
                title="Clear"
              >
                ×
              </button>
            ) : null}
          </label>
        </form>
      ) : null}
    </div>
  )
}

function AdminLayoutShell({ children, mode = 'admin' }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)

  const displayName = user?.name || user?.username || 'Account'
  const displayEmail = user?.email || user?.username || 'Signed in'

  const go = (to) => (event) => {
    event.preventDefault()
    setNavOpen(false)
    setAccountOpen(false)
    if (
      location.pathname === to &&
      !location.search &&
      !location.hash
    ) {
      return
    }
    navigate(to)
  }

  const linkClass = (to, { end = false } = {}) => {
    const active = end
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`)
    return `admin-nav__link${active ? ' is-active' : ''}`
  }

  useEffect(() => {
    const prevTitle = document.title
    document.title =
      mode === 'admin'
        ? 'PahadLink Admin'
        : isAdmin
          ? 'PahadLink Admin · Sellers desk'
          : 'PahadLink Seller'

    const iconLinks = [
      ...document.querySelectorAll("link[rel='icon']"),
      ...document.querySelectorAll("link[rel='shortcut icon']"),
    ]
    const prev = iconLinks.map((el) => ({
      el,
      href: el.getAttribute('href'),
      type: el.getAttribute('type'),
    }))

    iconLinks.forEach((el) => {
      const isPng = (el.getAttribute('type') || '').includes('png')
      el.setAttribute('href', isPng ? FAVICON_PNG : FAVICON_ICO)
    })

    return () => {
      document.title = prevTitle
      prev.forEach(({ el, href }) => {
        if (href) el.setAttribute('href', href)
      })
    }
  }, [mode, isAdmin])

  useEffect(() => {
    setNavOpen(false)
    setAccountOpen(false)
  }, [mode, location.pathname, location.search])

  useEffect(() => {
    if (!accountOpen) return undefined

    const onPointerDown = (event) => {
      if (!accountRef.current?.contains(event.target)) {
        setAccountOpen(false)
      }
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setAccountOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  const onLogout = () => {
    setAccountOpen(false)
    logout()
    navigate(ROUTES.ADMIN_LOGIN, { replace: true })
  }

  return (
    <div className="admin-app" data-admin-mode={mode}>
      <div className={`admin-shell${navOpen ? ' is-nav-open' : ''}`}>
        {navOpen && (
          <button
            type="button"
            className="admin-nav-backdrop"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          />
        )}

        <aside className="admin-nav" id="admin-nav" aria-label="Admin navigation">
          <p className="admin-nav__section">Workspace</p>
          <nav className="admin-nav__links">
            {isAdmin && (
              <a
                href={ROUTES.ADMIN}
                className={linkClass(ROUTES.ADMIN, { end: true })}
                onClick={go(ROUTES.ADMIN)}
              >
                <span className="admin-nav__ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M4 19V9l4 3 4-7 4 5 4-3v12H4Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 19h16"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                Dashboard
              </a>
            )}
            {isAdmin && (
              <a
                href={ROUTES.ADMIN_ORDERS}
                className={linkClass(ROUTES.ADMIN_ORDERS, { end: true })}
                onClick={go(ROUTES.ADMIN_ORDERS)}
              >
                <span className="admin-nav__ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M7 4h10l1 3H6l1-3Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 7h12v11.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18.5V7Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M9 11h6M9 15h4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                Orders
              </a>
            )}
            {isAdmin && (
              <a
                href={ROUTES.ADMIN_INVENTORY}
                className={linkClass(ROUTES.ADMIN_INVENTORY, { end: true })}
                onClick={go(ROUTES.ADMIN_INVENTORY)}
              >
                <span className="admin-nav__ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 12v9M4 7.5l8 4.5 8-4.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Inventory
              </a>
            )}
            {isAdmin && (
              <a
                href={ROUTES.ADMIN_LEADS}
                className={linkClass(ROUTES.ADMIN_LEADS, { end: true })}
                onClick={go(ROUTES.ADMIN_LEADS)}
              >
                <span className="admin-nav__ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="9"
                      cy="7"
                      r="3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35M16.5 3.7a3.5 3.5 0 0 1 0 6.6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                Leads
              </a>
            )}
            <a
              href={ROUTES.SELLER}
              className={linkClass(ROUTES.SELLER, { end: true })}
              onClick={go(ROUTES.SELLER)}
            >
              <span className="admin-nav__ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M4 7h16l-1.2 12.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 7Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
              Sellers desk
            </a>
          </nav>
        </aside>

        <div className="admin-workspace">
          <header className="admin-topbar">
            <div className="admin-topbar__left">
              <button
                type="button"
                className="admin-topbar__menu"
                aria-expanded={navOpen}
                aria-controls="admin-nav"
                onClick={() => setNavOpen((o) => !o)}
              >
                <span />
                <span />
                <span />
                <span className="visually-hidden">Menu</span>
              </button>

              <div className="admin-topbar__brand">
                <img src={logo} alt="PahadLink" className="admin-topbar__logo" />
              </div>
            </div>

            <AdminTopbarSearch />

            <div className="admin-topbar__account" ref={accountRef}>
              <button
                type="button"
                className={`admin-topbar__trigger${accountOpen ? ' is-open' : ''}`}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                aria-label={`Account menu for ${displayName}`}
                onClick={() => setAccountOpen((open) => !open)}
              >
                <span className="admin-topbar__avatar" aria-hidden="true">
                  {initialsFrom(user?.name, user?.email || user?.username)}
                </span>
              </button>

              {accountOpen ? (
                <div className="admin-topbar__menu-panel" role="menu">
                  <div className="admin-topbar__menu-head">
                    <span className="admin-topbar__avatar" aria-hidden="true">
                      {initialsFrom(user?.name, user?.email || user?.username)}
                    </span>
                    <div>
                      <strong>{displayName}</strong>
                      <em>{displayEmail}</em>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-topbar__menu-item admin-topbar__menu-item--danger"
                    role="menuitem"
                    onClick={onLogout}
                  >
                    <LogOutIcon size={18} />
                    <span>Log out</span>
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <div className="admin-main">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout({ children, mode = 'admin' }) {
  return (
    <AdminChromeProvider>
      <AdminLayoutShell mode={mode}>{children}</AdminLayoutShell>
    </AdminChromeProvider>
  )
}
