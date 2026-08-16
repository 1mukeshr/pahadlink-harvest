import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/css/style.css'
import './assets/css/responsive.css'
import { loadRuntimeConfig } from './config'
import { bootstrapTheme } from './utils/themeColors'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            color: '#7a1028',
            maxWidth: 640,
            margin: '40px auto',
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>PahadLink failed to load</h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#FFF6EC',
              border: '1px solid #F0D8B4',
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
            }}
          >
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function hideBootLoader() {
  const boot = document.getElementById('boot-loader')
  if (!boot || boot.classList.contains('is-done')) return

  const started = Number(boot.dataset.started || Date.now())
  const minVisibleMs = 420
  const elapsed = Date.now() - started
  const wait = Math.max(0, minVisibleMs - elapsed)

  window.setTimeout(() => {
    boot.classList.add('is-done')
    boot.setAttribute('aria-busy', 'false')

    window.setTimeout(() => {
      boot.remove()
    }, 300)
  }, wait)
}

const rootEl = document.getElementById('root')
if (rootEl) {
  const boot = document.getElementById('boot-loader')
  if (boot) boot.dataset.started = String(Date.now())

  loadRuntimeConfig()
    .catch(() => {})
    .finally(() => {
      bootstrapTheme()
      createRoot(rootEl).render(
        <StrictMode>
          <RootErrorBoundary>
            <App />
          </RootErrorBoundary>
        </StrictMode>
      )

      requestAnimationFrame(() => {
        requestAnimationFrame(hideBootLoader)
      })
    })
} else {
  document.body.innerHTML =
    '<p style="padding:24px;font-family:system-ui">Missing #root element.</p>'
}
