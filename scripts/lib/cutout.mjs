/**
 * Shared pack-cutout machinery for the banner builders.
 *
 * Lifts a product off its studio backdrop with ML matting, then scrubs pale
 * edge fringe, the leftover floor strip and the milky shadow veil so the pack
 * can be dropped straight onto artwork.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '../..')
const PRODUCTS = path.join(ROOT, 'src/assets/images/products')
const CUTOUT_CACHE = path.join(ROOT, 'scripts/.cutout-cache')
const MATTE_WORKER = path.join(import.meta.dirname, 'matte-worker.mjs')

export const product = (name) => path.join(PRODUCTS, `pack-${name}.webp`)

/**
 * Per-photo cutout overrides. ML removes the studio wall; crops drop props
 * that cling on (vase, floor card) and trimBottom scrapes residual floor fringe.
 */
export const CUTOUT_TUNING = {
  'organic-gift-box': {
    // Drop the left vase / hanging card without chopping the open lid.
    crop: [0.1, 0.02, 0.82, 0.9],
    trimBottom: 0.05,
  },
  'festival-hamper': {
    crop: [0.1, 0.02, 0.8, 0.93],
    trimBottom: 0.05,
  },
  'bal-mithai': { trimBottom: 0.03 },
  singori: { trimBottom: 0.03 },
  'raw-honey': { trimBottom: 0.03 },
  'buransh-squash': { trimBottom: 0.025 },
  'pahadi-rajma': { trimBottom: 0.02 },
  'mandua-flour': { trimBottom: 0.02 },
  'red-rice': { trimBottom: 0.02 },
  'pahadi-pichodi': { trimBottom: 0.025 },
  // Matting reads the white mount and the white Aipan linework as backdrop and
  // punches them out, so the enclosed area has to be sealed back up.
  'aipan-art': { trimBottom: 0.03, fillHoles: true },
}

function cacheKey(src, { crop = null, trimBottom = 0.02, fillHoles = false } = {}) {
  const st = fs.statSync(src)
  return [
    path.basename(src, path.extname(src)),
    st.mtimeMs,
    st.size,
    crop ? crop.map((n) => n.toFixed(3)).join('x') : 'full',
    String(trimBottom),
    fillHoles ? 'filled' : 'raw',
  ].join('_')
}

/**
 * Matting has to happen in a child process: onnxruntime and the libvips behind
 * sharp load conflicting copies of GLib, and loading both in one process kills
 * it with an access violation once matting starts.
 */
function mlMatte(inputPng) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pahadlink-matte-'))
  const src = path.join(dir, 'in.png')
  const dest = path.join(dir, 'out.png')

  try {
    fs.writeFileSync(src, inputPng)
    execFileSync(process.execPath, [MATTE_WORKER, src, dest], { stdio: 'ignore' })
    return fs.readFileSync(dest)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export async function cutout(src, { crop = null, trimBottom = 0.02, fillHoles = false } = {}) {
  fs.mkdirSync(CUTOUT_CACHE, { recursive: true })
  const key = cacheKey(src, { crop, trimBottom, fillHoles })
  const cached = path.join(CUTOUT_CACHE, key + '.png')
  if (fs.existsSync(cached)) return fs.readFileSync(cached)

  let pipeline = sharp(src)
  if (crop) {
    const meta = await sharp(src).metadata()
    const [cx, cy, cw, ch] = crop
    pipeline = sharp(src).extract({
      left: Math.max(0, Math.round(cx * meta.width)),
      top: Math.max(0, Math.round(cy * meta.height)),
      width: Math.max(1, Math.round(cw * meta.width)),
      height: Math.max(1, Math.round(ch * meta.height)),
    })
  }

  const prepared = await pipeline.png().toBuffer()
  const matted = mlMatte(prepared)
  const { data, info } = await sharp(matted)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info

  if (fillHoles) {
    // The matte re-tints what it thinks is background, so the photo's own
    // colours have to come back before any hole can be sealed with them.
    const source = await sharp(prepared)
      .resize(w, h, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer()
    for (let idx = 0; idx < w * h; idx += 1) {
      data[idx * 4] = source[idx * 3]
      data[idx * 4 + 1] = source[idx * 3 + 1]
      data[idx * 4 + 2] = source[idx * 3 + 2]
    }
  }

  // Drop near-white / parchment fringe that still clings to matte edges.
  const isPale = (i) => {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lum = r * 0.299 + g * 0.587 + b * 0.114
    const sat = max === 0 ? 0 : (max - min) / max
    return lum > 170 && sat < 0.28
  }

  /*
   * Only pixels sitting on the matte boundary may be scrubbed. Pale areas that
   * belong to the product — a white mount inside a frame, cream packaging —
   * are enclosed by opaque pixels and must survive untouched.
   */
  for (let pass = 0; pass < 2; pass += 1) {
    const kill = []
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const idx = y * w + x
        const i = idx * 4
        if (data[i + 3] < 12) continue
        if (!isPale(i)) continue
        let border = false
        const neighbours = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]
        for (const [nx, ny] of neighbours) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            border = true
            break
          }
          if (data[(ny * w + nx) * 4 + 3] < 12) {
            border = true
            break
          }
        }
        if (border) kill.push(i)
      }
    }
    if (!kill.length) break
    for (const i of kill) data[i + 3] = 0
  }

  /*
   * Matting a framed picture punches through the white mount and the white
   * linework, because both read as backdrop. Only transparency that reaches
   * the image border is really backdrop, so everything walled in by the object
   * is sealed back to solid. Pixels touching the outside keep their alpha, or
   * the silhouette would lose its anti-aliased edge.
   */
  if (fillHoles) {
    const outside = new Uint8Array(w * h)
    const stack = []

    const seed = (x, y) => {
      const idx = y * w + x
      if (outside[idx] || data[idx * 4 + 3] > 24) return
      outside[idx] = 1
      stack.push(idx)
    }

    for (let x = 0; x < w; x += 1) {
      seed(x, 0)
      seed(x, h - 1)
    }
    for (let y = 0; y < h; y += 1) {
      seed(0, y)
      seed(w - 1, y)
    }

    while (stack.length) {
      const idx = stack.pop()
      const x = idx % w
      const y = (idx / w) | 0
      if (x + 1 < w) seed(x + 1, y)
      if (x > 0) seed(x - 1, y)
      if (y + 1 < h) seed(x, y + 1)
      if (y > 0) seed(x, y - 1)
    }

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const idx = y * w + x
        if (outside[idx] || data[idx * 4 + 3] === 255) continue
        let nearEdge = false
        for (let dy = -2; dy <= 2 && !nearEdge; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            if (outside[ny * w + nx]) {
              nearEdge = true
              break
            }
          }
        }
        if (!nearEdge) data[idx * 4 + 3] = 255
      }
    }
  }

  if (trimBottom > 0) {
    const y0 = Math.max(0, h - Math.round(h * trimBottom))
    for (let y = y0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4
        if (isPale(i) || data[i + 3] < 40) data[i + 3] = 0
      }
    }
  }

  /*
   * The matte keeps a veil of low alpha where the studio shadow used to be,
   * which reads as a milky ghost blob on the green. Stretch the alpha ramp so
   * that veil disappears while real anti-aliased edges keep their gradient.
   */
  for (let idx = 0; idx < w * h; idx += 1) {
    const a = data[idx * 4 + 3]
    if (a === 0 || a === 255) continue
    data[idx * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (a - 96) / 128)))
  }

  // Stray flecks of prop or floor survive as tiny islands; keep only real mass.
  {
    const seen = new Uint8Array(w * h)
    const islands = []
    let largest = 0

    for (let start = 0; start < w * h; start += 1) {
      if (seen[start] || data[start * 4 + 3] < 12) continue
      const stack = [start]
      const island = []
      seen[start] = 1

      while (stack.length) {
        const idx = stack.pop()
        island.push(idx)
        const x = idx % w
        const y = (idx / w) | 0
        const neighbours = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]
        for (const [nx, ny] of neighbours) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const n = ny * w + nx
          if (seen[n] || data[n * 4 + 3] < 12) continue
          seen[n] = 1
          stack.push(n)
        }
      }

      islands.push(island)
      if (island.length > largest) largest = island.length
    }

    for (const island of islands) {
      if (island.length >= largest * 0.06) continue
      for (const idx of island) data[idx * 4 + 3] = 0
    }
  }

  const out = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer()
  fs.writeFileSync(cached, out)
  return out
}

/** Soft elliptical contact shadow so a cut-out pack still sits on a surface. */
export function contactShadow(width, height) {
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="s"><stop offset="0%" stop-color="#01180F" stop-opacity="0.32"/><stop offset="55%" stop-color="#01180F" stop-opacity="0.12"/><stop offset="100%" stop-color="#01180F" stop-opacity="0"/></radialGradient></defs><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="url(#s)"/></svg>`,
    ),
  )
    .png()
    .toBuffer()
}
