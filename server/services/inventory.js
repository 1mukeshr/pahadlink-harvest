import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCatalogProduct } from './catalog.js'
import { STOCK_DEFAULTS as DEFAULTS } from '../../shared/inventoryDefaults.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../data')
const STORE_PATH = join(DATA_DIR, 'inventory.json')

function isCatalogProduct(productId) {
  return Boolean(getCatalogProduct(productId))
}

function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, `${JSON.stringify(DEFAULTS, null, 2)}\n`)
  }
}

function readStore() {
  ensureStore()
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, 'utf8'))
    return raw && typeof raw === 'object' ? raw : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeStore(data) {
  ensureStore()
  writeFileSync(STORE_PATH, `${JSON.stringify(data, null, 2)}\n`)
}

export function getStock(productId, size) {
  const store = readStore()
  const entry = store[productId] || DEFAULTS[productId]
  if (!entry) return 0
  if (entry.stockBySize && size && Object.prototype.hasOwnProperty.call(entry.stockBySize, size)) {
    return Math.max(0, Number(entry.stockBySize[size]) || 0)
  }
  if (typeof entry.stock === 'number') return Math.max(0, entry.stock)
  // Sized product without matching size → out of stock (do not invent 999)
  if (entry.stockBySize) return 0
  return 0
}

export function getInventorySnapshot() {
  const store = readStore()
  // Drop removed products that may linger in inventory.json / old DEFAULTS
  let dirty = false
  for (const id of Object.keys(store)) {
    if (!isCatalogProduct(id)) {
      delete store[id]
      dirty = true
    }
  }
  if (dirty) writeStore(store)

  const ids = new Set(
    [...Object.keys(DEFAULTS), ...Object.keys(store)].filter(isCatalogProduct),
  )
  const items = []
  for (const id of ids) {
    const entry = store[id] || DEFAULTS[id] || { stock: 0 }
    let stock = typeof entry.stock === 'number' ? entry.stock : null
    const stockBySize =
      entry.stockBySize && typeof entry.stockBySize === 'object'
        ? entry.stockBySize
        : null
    if (stock == null && stockBySize) {
      stock = Object.values(stockBySize).reduce(
        (sum, n) => sum + Math.max(0, Number(n) || 0),
        0
      )
    }
    items.push({
      productId: id,
      stock: stock == null ? 0 : stock,
      stockBySize,
    })
  }
  return items.sort((a, b) => a.productId.localeCompare(b.productId))
}

/**
 * Decrement stock for order line items.
 * Returns { ok, message?, shortages? }
 */
export function decrementStock(items) {
  if (!Array.isArray(items) || !items.length) {
    return { ok: true }
  }

  const store = readStore()
  const shortages = []

  for (const item of items) {
    const productId = String(item.productId || '').trim()
    if (!productId) continue
    const qty = Math.max(1, Number(item.quantity) || 1)
    const size = item.size ? String(item.size) : ''
    const entry = store[productId] || structuredClone(DEFAULTS[productId])
    if (!entry) {
      shortages.push({ productId, size: size || null, need: qty, available: 0 })
      continue
    }

    if (entry.stockBySize && size && Object.prototype.hasOwnProperty.call(entry.stockBySize, size)) {
      const available = Math.max(0, Number(entry.stockBySize[size]) || 0)
      if (available < qty) {
        shortages.push({ productId, size, need: qty, available })
        continue
      }
      entry.stockBySize[size] = available - qty
    } else if (typeof entry.stock === 'number') {
      if (entry.stock < qty) {
        shortages.push({ productId, size: size || null, need: qty, available: entry.stock })
        continue
      }
      entry.stock -= qty
    } else {
      shortages.push({ productId, size: size || null, need: qty, available: 0 })
      continue
    }

    store[productId] = entry
  }

  if (shortages.length) {
    return { ok: false, message: 'Insufficient stock for one or more items', shortages }
  }

  writeStore(store)
  return { ok: true }
}

export function restoreStock(items) {
  if (!Array.isArray(items) || !items.length) return { ok: true }
  const store = readStore()

  for (const item of items) {
    const productId = String(item.productId || '').trim()
    if (!productId) continue
    const qty = Math.max(1, Number(item.quantity) || 1)
    const size = item.size ? String(item.size) : ''
    const entry = store[productId] || structuredClone(DEFAULTS[productId] || { stock: 0 })

    if (entry.stockBySize && size && Object.prototype.hasOwnProperty.call(entry.stockBySize, size)) {
      entry.stockBySize[size] = Math.max(0, Number(entry.stockBySize[size]) || 0) + qty
    } else if (typeof entry.stock === 'number') {
      entry.stock = Math.max(0, entry.stock) + qty
    } else {
      entry.stock = qty
    }
    store[productId] = entry
  }

  writeStore(store)
  return { ok: true }
}

/**
 * Admin: set absolute stock for a product (plain stock or one size).
 * payload: { stock?: number } or { size: string, stock: number }
 */
export function setProductStock(productId, { stock, size } = {}) {
  const id = String(productId || '').trim()
  if (!id || !isCatalogProduct(id)) {
    return { ok: false, message: 'Unknown product' }
  }
  const qty = Math.max(0, Math.floor(Number(stock)))
  if (!Number.isFinite(qty)) {
    return { ok: false, message: 'Stock must be a number' }
  }

  const store = readStore()
  const entry = store[id] || structuredClone(DEFAULTS[id] || { stock: 0 })

  const sizeKey = size ? String(size) : ''
  if (sizeKey) {
    if (!entry.stockBySize || typeof entry.stockBySize !== 'object') {
      entry.stockBySize = {}
    }
    entry.stockBySize[sizeKey] = qty
    delete entry.stock
  } else if (entry.stockBySize && typeof entry.stockBySize === 'object') {
    return {
      ok: false,
      message: 'This product uses sizes — update a size, not plain stock',
    }
  } else {
    entry.stock = qty
  }

  store[id] = entry
  writeStore(store)
  return {
    ok: true,
    item: getInventorySnapshot().find((x) => x.productId === id),
  }
}
