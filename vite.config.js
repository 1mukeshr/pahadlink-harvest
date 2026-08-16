import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// GitHub project Pages needs /pahadlink-harvest/; Vercel / custom domain use /
const isVercel = process.env.VERCEL === '1'
const rawBase =
  process.env.VITE_PAGES_BASE ||
  process.env.PAGES_BASE ||
  (isVercel ? '/' : '/pahadlink-harvest/')
const PAGES_BASE = String(rawBase).replace(/\/?$/, '/') || '/'

export default defineConfig(({ command }) => ({
  // Absolute base avoids broken asset URLs on GitHub Pages.
  base: command === 'build' ? PAGES_BASE : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@pahadlink/shared': path.resolve(__dirname, 'shared'),
    },
  },
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    modulePreload: { polyfill: true },
  },
  server: {
    // Bind all NICs so any LAN/Wi‑Fi client can open http://<this-pc-ip>:5173
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Allow phone/other devices on same Wi‑Fi (LAN hostname / IP)
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    allowedHosts: true,
    // Same /api proxy as dev so `npm run preview` works with local API
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
}))
