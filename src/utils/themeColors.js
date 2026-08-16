import { STORAGE } from '../config'

const BRAND_GREEN = '#0A4F33'
const BRAND_GREEN_DARK = '#083D28'
const BRAND_GREEN_LIGHT = '#2E8B57'

const BRAND_ORANGE = '#FF9800'
const BRAND_ORANGE_DARK = '#EF6C00'
const BRAND_ORANGE_LIGHT = '#FFB300'

export const DEFAULT_THEME = {
  primary: BRAND_ORANGE,
  secondary: BRAND_GREEN,
}

/** Primaries from earlier palettes get migrated back to the logo colours. */
const LEGACY_PRIMARIES = ['#E62978', BRAND_GREEN]

const WHITE = { r: 255, g: 255, b: 255 }
const BLACK = { r: 0, g: 0, b: 0 }

export function normalizeHex(value = '') {
  let hex = String(value).trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(hex)) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-f]{6}$/.test(hex)) return null
  return `#${hex.toUpperCase()}`
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const n = parseInt(normalized.slice(1), 16)
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  }
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`
}

function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

function lighten(hex, amount = 0.16) {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHex(mix(rgb, WHITE, amount)) : hex
}

function darken(hex, amount = 0.16) {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHex(mix(rgb, BLACK, amount)) : hex
}

function softBg(hex, amount = 0.9) {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHex(mix(rgb, WHITE, amount)) : '#ffffff'
}

function glow(hex, alpha = 0.2) {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function gradient(from, mid, to) {
  return `linear-gradient(135deg, ${from} 0%, ${mid} 55%, ${to} 100%)`
}

function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 1
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Darkens a hex until it reaches roughly 4:1 against white, so it works as body text. */
function readableInk(hex) {
  let ink = hex
  for (let i = 0; i < 12 && 1.05 / (luminance(ink) + 0.05) < 4; i += 1) {
    ink = darken(ink, 0.08)
  }
  return ink
}

function buildThemeVars(theme = DEFAULT_THEME) {
  const primary = normalizeHex(theme.primary) || DEFAULT_THEME.primary
  const secondary = normalizeHex(theme.secondary) || DEFAULT_THEME.secondary

  const isBrandOrange = primary === BRAND_ORANGE
  const primaryLight = isBrandOrange ? BRAND_ORANGE_LIGHT : lighten(primary, 0.18)
  const primaryDark = isBrandOrange ? BRAND_ORANGE_DARK : darken(primary, 0.16)
  const isBrandGreen = secondary === BRAND_GREEN
  const secondaryLight = isBrandGreen ? BRAND_GREEN_LIGHT : lighten(secondary, 0.18)
  const secondaryDark = isBrandGreen ? BRAND_GREEN_DARK : darken(secondary, 0.16)

  return {
    '--brand-orange': primary,
    '--brand-orange-dark': primaryDark,
    '--brand-orange-light': primaryLight,
    '--brand-green': secondary,
    '--brand-green-dark': secondaryDark,
    '--brand-green-light': secondaryLight,
    '--primary': primary,
    '--primary-light': primaryLight,
    '--primary-dark': primaryDark,
    '--primary-ink': isBrandOrange ? '#C25E00' : readableInk(primary),
    '--primary-soft': softBg(primary, 0.92),
    '--primary-soft-mid': softBg(primary, 0.82),
    '--primary-border': lighten(primary, 0.5),
    '--primary-glow': glow(primary, 0.28),
    '--primary-gradient': gradient(primaryLight, primary, primaryDark),
    '--primary-gradient-hover': isBrandOrange
      ? gradient(BRAND_ORANGE, '#F57C00', '#E65100')
      : gradient(primary, primaryDark, darken(primaryDark, 0.22)),
    '--border-focus': primary,
    '--secondary': secondary,
    '--secondary-light': secondaryLight,
    '--secondary-dark': secondaryDark,
    '--secondary-glow': glow(secondary, 0.18),
    '--secondary-soft': softBg(secondary, 0.9),
    '--secondary-gradient': gradient(secondaryLight, secondary, secondaryDark),
    '--secondary-gradient-hover': gradient(secondary, secondaryDark, darken(secondaryDark, 0.22)),
    // Buttons take the secondary (green) fill; primary stays the accent colour.
    '--btn-gradient': gradient(secondaryLight, secondary, secondaryDark),
    '--btn-gradient-hover': gradient(secondary, secondaryDark, darken(secondaryDark, 0.22)),
    '--btn-glow': glow(secondary, 0.3),
    '--accent-gradient': gradient(primaryLight, primary, primaryDark),
    '--accent-gradient-hover': isBrandOrange
      ? gradient(BRAND_ORANGE, '#F57C00', '#E65100')
      : gradient(primary, primaryDark, darken(primaryDark, 0.22)),
    '--success': secondary,
    '--success-bg': softBg(secondary, 0.9),
  }
}

function applyTheme(theme = DEFAULT_THEME) {
  const next = {
    primary: normalizeHex(theme.primary) || DEFAULT_THEME.primary,
    secondary: normalizeHex(theme.secondary) || DEFAULT_THEME.secondary,
  }
  const root = document.documentElement
  const vars = buildThemeVars(next)
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) metaTheme.setAttribute('content', next.secondary)

  return next
}

export function readStoredTheme() {
  try {
    const raw = localStorage.getItem(STORAGE.THEME)
    if (!raw) return { ...DEFAULT_THEME }
    const parsed = JSON.parse(raw)
    const primary = normalizeHex(parsed?.primary) || DEFAULT_THEME.primary
    if (LEGACY_PRIMARIES.includes(primary)) return { ...DEFAULT_THEME }
    return {
      primary,
      secondary: normalizeHex(parsed?.secondary) || DEFAULT_THEME.secondary,
    }
  } catch {
    return { ...DEFAULT_THEME }
  }
}

export function saveTheme(theme) {
  const next = applyTheme(theme)
  try {
    localStorage.setItem(STORAGE.THEME, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  return next
}

export function resetTheme() {
  try {
    localStorage.removeItem(STORAGE.THEME)
  } catch {
    /* ignore */
  }
  return applyTheme(DEFAULT_THEME)
}

/** Apply saved theme before first paint (call from main.jsx). */
export function bootstrapTheme() {
  return applyTheme(readStoredTheme())
}
