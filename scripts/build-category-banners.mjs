/**
 * Compose 16:3 category page banners — product photography only.
 *
 * Copy (title / headline / blurb) is NOT baked into the image. It is rendered
 * as HTML overlay from `src/data/siteData.js` so text stays editable without
 * regenerating artwork.
 *
 * Usage: npm run banners:category
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { CUTOUT_TUNING, contactShadow, cutout, product } from './lib/cutout.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const IMAGES = path.join(ROOT, 'src/assets/images')
const OUT = path.join(IMAGES, 'categories/banners')

// 16:3 at 2x, so it stays sharp on retina and downsamples cleanly to 1280x240.
const W = 2560
const H = 480

/** Left zone reserved for HTML overlay copy on the storefront. */
const TEXT_X = 132
const TEXT_CLEARANCE = 96
const TEXT_RESERVE = 1000
/** Green gutter kept clear on the right. */
const RIGHT_MARGIN = 96
/** Air kept under the packs so the row never crowds the banner edge. */
const BOTTOM_MARGIN = 46
/** Packs stand on this line so a mixed row still shares one surface. */
const BASELINE = H - BOTTOM_MARGIN
/**
 * Each pack is fitted to this box, so the row lands on a common height and the
 * air above it stays close to the air below whatever the tallest pack is.
 */
const PRODUCT_H = BASELINE - 42
const PRODUCT_W = 620
/** Clear air between packs, so none of them hides its neighbour. */
const GAP = 13
/** Widest the product row may grow before it would crowd the copy zone. */
const ZONE_W = W - RIGHT_MARGIN - (TEXT_X + TEXT_RESERVE + TEXT_CLEARANCE)

const BANNERS = [
  {
    id: 'organic-food',
    products: ['pahadi-rajma', 'mandua-flour', 'red-rice'],
  },
  {
    id: 'honey-natural',
    products: ['raw-honey', 'buransh-squash'],
  },
  {
    id: 'clothing',
    products: ['pahadi-pichodi'],
  },
  {
    id: 'handicrafts',
    products: ['aipan-art'],
  },
  {
    id: 'snacks-sweets',
    products: ['bal-mithai', 'singori'],
  },
  {
    id: 'gift-hampers',
    products: ['festival-hamper', 'organic-gift-box'],
  },
]

function backgroundSvg(focusX) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#062A1C"/>
      <stop offset="52%" stop-color="#0A4F33"/>
      <stop offset="100%" stop-color="#15633F"/>
    </linearGradient>
    <radialGradient id="warm" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF9800" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#FF9800" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cool" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#2E8B57" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#2E8B57" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <ellipse cx="${focusX}" cy="${H * 0.42}" rx="720" ry="520" fill="url(#warm)"/>
  <ellipse cx="60" cy="${H}" rx="700" ry="420" fill="url(#cool)"/>

  <g fill="none" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="3">
    <path d="M-40 ${H * 0.88} L200 ${H * 0.5} L330 ${H * 0.72} L520 ${H * 0.34} L700 ${H * 0.78} L860 ${H * 0.46} L1080 ${H * 0.9}"/>
    <path d="M420 ${H * 0.96} L640 ${H * 0.6} L790 ${H * 0.82} L980 ${H * 0.44} L1180 ${H * 0.86}"/>
  </g>
</svg>`)
}

async function prepareProducts(names) {
  const items = []

  for (const name of names) {
    const cut = await sharp(await cutout(product(name), CUTOUT_TUNING[name]))
      .trim({ threshold: 8 })
      .toBuffer()
    const meta = await sharp(cut).metadata()
    const scale = Math.min(PRODUCT_H / meta.height, PRODUCT_W / meta.width)
    items.push({ cut, width: meta.width * scale, height: meta.height * scale })
  }

  // Leave the left text zone clear so HTML copy never sits on packs.
  const natural =
    items.reduce((sum, item) => sum + item.width, 0) + GAP * (items.length - 1)
  const fit = Math.min(1, ZONE_W / natural)

  for (const item of items) {
    item.width = Math.max(1, Math.round(item.width * fit))
    item.height = Math.max(1, Math.round(item.height * fit))
    item.buffer = await sharp(item.cut).resize(item.width, item.height).png().toBuffer()
  }

  return items
}

async function buildBanner(spec) {
  const items = await prepareProducts(spec.products)

  const rowWidth =
    items.reduce((sum, item) => sum + item.width, 0) + GAP * (items.length - 1)
  /*
   * A lone pack pinned to the right edge leaves a dead stretch of green next
   * to the copy, so narrow rows drift back toward the middle of the zone. Full
   * rows have no slack to give and stay against the gutter.
   */
  const rowRight = W - RIGHT_MARGIN - Math.round((ZONE_W - rowWidth) * 0.34)
  let x = Math.round(rowRight - rowWidth)

  const focusX = Math.round(rowRight - rowWidth / 2)

  const shadows = []
  const packs = []

  for (const item of items) {
    const shadowW = Math.round(item.width * 0.92)
    const shadowH = 44
    shadows.push({
      input: await contactShadow(shadowW, shadowH),
      left: Math.round(x + (item.width - shadowW) / 2),
      top: Math.round(BASELINE - shadowH / 2),
    })
    packs.push({ input: item.buffer, left: x, top: BASELINE - item.height })
    x += item.width + GAP
  }

  const out = path.join(OUT, `${spec.id}.webp`)
  await sharp(backgroundSvg(focusX))
    .composite([...shadows, ...packs])
    .webp({ quality: 88, effort: 6 })
    .toFile(out)

  console.log(
    `${spec.id}.webp — ${items.length} product(s), row ${Math.round(rowWidth)}px (text via HTML)`,
  )
}

/** `--cutouts [name...]` renders keyed-out packs on green to check for fringing. */
async function debugCutouts(names) {
  const list = names.length ? names : [...new Set(BANNERS.flatMap((b) => b.products))]
  const size = list.length <= 3 ? 720 : 420
  const layers = []
  let x = 16

  for (const name of list) {
    const cut = await sharp(await cutout(product(name), CUTOUT_TUNING[name]))
      .trim({ threshold: 8 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    layers.push({ input: cut, left: x, top: 16 })
    x += size + 12
  }

  const out = path.join(ROOT, '.cutouts.png')
  await sharp({
    create: {
      width: x + 4,
      height: size + 32,
      channels: 4,
      background: { r: 10, g: 79, b: 51, alpha: 1 },
    },
  })
    .composite(layers)
    .png()
    .toFile(out)
  console.log(`wrote ${path.relative(ROOT, out)} — ${list.join(', ')}`)
}

if (process.argv[2] === '--cutouts') {
  await debugCutouts(process.argv.slice(3))
} else {
  fs.mkdirSync(OUT, { recursive: true })
  for (const banner of BANNERS) {
    await buildBanner(banner)
  }
  console.log(`\ndone — ${W}x${H} (16:3) product-only in ${path.relative(ROOT, OUT)}`)
}
