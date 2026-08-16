/**
 * Default stock by productId.
 * Live inventory is owned by the backend (server/data/inventory.json).
 * Frontend uses these only as offline fallback until GET /orders/stock loads.
 */

export const STOCK_DEFAULTS = {
  'pahadi-rajma': { stock: 40 },
  'raw-honey': { stock: 28 },
  'mandua-flour': { stock: 32 },
  'gahat-dal': { stock: 30 },
  'red-rice': { stockBySize: { '1 kg': 18, '2 kg': 8, '5 kg': 0 } },
  'bal-mithai': { stockBySize: { '250g': 14, '500g': 0 } },
  singori: { stockBySize: { '250g': 16, '500g': 9 } },
  'buransh-squash': { stock: 22 },
  'pahadi-topi': { stock: 0 },
  'pahadi-pichodi': { stock: 12 },
  'ringaal-basket': { stockBySize: { Medium: 7, Large: 0 } },
  'aipan-art': { stockBySize: { Small: 10, Medium: 6 } },
  jhangora: { stock: 26 },
  'festival-hamper': { stockBySize: { Standard: 9, Premium: 0 } },
  'organic-gift-box': { stockBySize: { 'Box of 4': 12, 'Box of 6': 2 } },
}
