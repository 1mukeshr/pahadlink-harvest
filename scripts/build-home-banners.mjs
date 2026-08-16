/**
 * Compose the 2:1 home hero banners.
 *
 * The backdrop plates in `scripts/plates` are shot empty on purpose: the packs
 * are the real product photos, cut out and dropped in, so every banner carries
 * the actual PahadLink label instead of a redrawn one.
 *
 * The left half stays clear because the hero overlays its copy and CTA there.
 *
 * Usage: npm run banners:home
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { CUTOUT_TUNING, contactShadow, cutout, product } from './lib/cutout.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const PLATES = path.join(ROOT, 'scripts/plates')
const OUT = path.join(ROOT, 'src/assets/images/home-banner')

const W = 1000
const H = 500

/**
 * `baseline` is where a pack meets the table in the finished frame and `x` is
 * the centre of the pack, both tuned per plate against its own table edge.
 */
const BANNERS = [
  {
    id: 'honey-forest',
    plate: 'bg-honey',
    baseline: 476,
    packs: [{ name: 'raw-honey', height: 386, x: 742 }],
  },
  {
    id: 'organic-harvest',
    plate: 'bg-organic',
    baseline: 452,
    packs: [{ name: 'pahadi-rajma', height: 358, x: 726 }],
  },
  {
    id: 'festive-sweets',
    plate: 'bg-sweets',
    baseline: 474,
    packs: [{ name: 'bal-mithai', height: 310, x: 742 }],
  },
]

/** Studio packs are lit brighter than the plates, so cool them into the scene. */
const PACK_GRADE = { brightness: 0.94, saturation: 1.04 }

async function preparePack({ name, height, x }) {
  const cut = await sharp(await cutout(product(name), CUTOUT_TUNING[name]))
    .trim({ threshold: 8 })
    .toBuffer()
  const meta = await sharp(cut).metadata()
  const width = Math.round((meta.width * height) / meta.height)

  const buffer = await sharp(cut)
    .resize(width, height)
    .modulate(PACK_GRADE)
    .png()
    .toBuffer()

  return { buffer, width, height, left: Math.round(x - width / 2) }
}

async function buildBanner(spec) {
  const plate = await sharp(path.join(PLATES, `${spec.plate}.webp`))
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .toBuffer()

  const layers = []

  for (const pack of spec.packs) {
    const { buffer, width, height, left } = await preparePack(pack)
    const shadowW = Math.round(width * 1.25)
    const shadowH = Math.round(height * 0.16)

    layers.push({
      input: await contactShadow(shadowW, shadowH),
      left: Math.round(pack.x - shadowW / 2),
      top: Math.round(spec.baseline - shadowH / 2),
    })
    layers.push({ input: buffer, left, top: spec.baseline - height })
  }

  const out = path.join(OUT, `${spec.id}.webp`)
  await sharp(plate).composite(layers).webp({ quality: 86, effort: 6 }).toFile(out)

  const kb = (fs.statSync(out).size / 1024).toFixed(0)
  console.log(`${spec.id}.webp — ${spec.packs.length} pack(s), ${kb}KB`)
}

fs.mkdirSync(OUT, { recursive: true })
for (const banner of BANNERS) {
  await buildBanner(banner)
}
console.log(`\ndone — ${W}x${H} (2:1) in ${path.relative(ROOT, OUT)}`)
