/**
 * Matte one PNG in a process of its own.
 *
 * onnxruntime and libvips fight over their bundled GLib on Windows and take
 * the process down with an access violation, so this worker must never import
 * sharp — the caller in `cutout.mjs` spawns it and swaps buffers via files.
 *
 * Usage: node scripts/lib/matte-worker.mjs <in.png> <out.png>
 */
import fs from 'node:fs'
import { removeBackground } from '@imgly/background-removal-node'

const [input, output] = process.argv.slice(2)

const blob = await removeBackground(
  new Blob([fs.readFileSync(input)], { type: 'image/png' }),
  { output: { format: 'image/png', quality: 0.92 } },
)

fs.writeFileSync(output, Buffer.from(await blob.arrayBuffer()))
