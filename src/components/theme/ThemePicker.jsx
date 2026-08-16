import { useEffect, useId, useRef, useState } from 'react'
import { CloseIcon } from '../icons'
import {
  DEFAULT_THEME,
  normalizeHex,
  readStoredTheme,
  resetTheme,
  saveTheme,
} from '../../utils/themeColors'

const PRESETS = [
  { label: 'PahadLink', primary: '#FF9800', secondary: '#0A4F33' },
  { label: 'Forest first', primary: '#0A4F33', secondary: '#FF9800' },
]

const PaletteIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M12 3a9 9 0 0 0 0 18h.5a2.5 2.5 0 0 0 2.1-3.85 2.5 2.5 0 0 1 2.1-3.85H18a3 3 0 0 0 0-6h-.2A9 9 0 0 0 12 3Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <circle cx="7.5" cy="10" r="1.2" fill="currentColor" />
    <circle cx="10.5" cy="7.2" r="1.2" fill="currentColor" />
    <circle cx="14.2" cy="7.5" r="1.2" fill="currentColor" />
    <circle cx="8.2" cy="13.5" r="1.2" fill="currentColor" />
  </svg>
)

const ThemePicker = () => {
  const panelId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(() => readStoredTheme())

  useEffect(() => {
    if (!open) return undefined

    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const commit = (next) => {
    const saved = saveTheme(next)
    setTheme(saved)
  }

  const onColorChange = (key, value) => {
    const hex = normalizeHex(value)
    if (!hex) {
      setTheme((prev) => ({ ...prev, [key]: value }))
      return
    }
    commit({ ...theme, [key]: hex })
  }

  const onHexBlur = (key, value) => {
    const hex = normalizeHex(value)
    if (!hex) {
      setTheme((prev) => ({ ...prev, [key]: DEFAULT_THEME[key] }))
      commit({ ...theme, [key]: DEFAULT_THEME[key] })
      return
    }
    commit({ ...theme, [key]: hex })
  }

  return (
    <div
      ref={rootRef}
      className={`theme-picker${open ? ' is-open' : ''}`}
    >
      {open && (
        <div
          id={panelId}
          className="theme-picker__panel"
          role="dialog"
          aria-label="Theme colors"
        >
          <header className="theme-picker__head">
            <div>
              <strong>Theme colors</strong>
              <span>Live update across the site</span>
            </div>
            <button
              type="button"
              className="theme-picker__close"
              aria-label="Close theme picker"
              onClick={() => setOpen(false)}
            >
              <CloseIcon size={14} />
            </button>
          </header>

          <div className="theme-picker__fields">
            <label className="theme-picker__field">
              <span>Primary</span>
              <div className="theme-picker__control">
                <input
                  type="color"
                  value={normalizeHex(theme.primary) || DEFAULT_THEME.primary}
                  onChange={(e) => onColorChange('primary', e.target.value)}
                  aria-label="Primary color"
                />
                <input
                  type="text"
                  value={theme.primary}
                  spellCheck={false}
                  maxLength={7}
                  onChange={(e) => onColorChange('primary', e.target.value)}
                  onBlur={(e) => onHexBlur('primary', e.target.value)}
                  aria-label="Primary hex code"
                />
              </div>
            </label>

            <label className="theme-picker__field">
              <span>Secondary</span>
              <div className="theme-picker__control">
                <input
                  type="color"
                  value={
                    normalizeHex(theme.secondary) || DEFAULT_THEME.secondary
                  }
                  onChange={(e) => onColorChange('secondary', e.target.value)}
                  aria-label="Secondary color"
                />
                <input
                  type="text"
                  value={theme.secondary}
                  spellCheck={false}
                  maxLength={7}
                  onChange={(e) => onColorChange('secondary', e.target.value)}
                  onBlur={(e) => onHexBlur('secondary', e.target.value)}
                  aria-label="Secondary hex code"
                />
              </div>
            </label>
          </div>

          <div className="theme-picker__presets" aria-label="Presets">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="theme-picker__preset"
                onClick={() =>
                  commit({
                    primary: preset.primary,
                    secondary: preset.secondary,
                  })
                }
              >
                <i style={{ background: preset.primary }} />
                <i style={{ background: preset.secondary }} />
                <em>{preset.label}</em>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="theme-picker__reset"
            onClick={() => setTheme(resetTheme())}
          >
            Reset to default
          </button>
        </div>
      )}

      <button
        type="button"
        className="theme-picker__launcher"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Close theme colors' : 'Open theme colors'}
        onClick={() => setOpen((v) => !v)}
      >
        <PaletteIcon size={20} />
      </button>
    </div>
  )
}

export default ThemePicker
