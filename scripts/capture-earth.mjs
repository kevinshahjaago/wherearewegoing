/**
 * Earth animation capture script.
 *
 * Usage:
 *   npm run capture            — runs against http://localhost:3000/capture
 *   CAPTURE_URL=http://... npm run capture
 *
 * Requires:
 *   - Next.js dev server running: npm run dev
 *   - puppeteer + ffmpeg-static installed (npm install --save-dev puppeteer ffmpeg-static)
 *
 * Outputs:
 *   public/earth-loop.mp4   — H.264, ~3-5MB, suitable for social embeds
 *   public/earth-loop.gif   — palette-optimised, ~2-3MB, suitable for sharing
 *   public/og-image.png     — 1200×630 static frame at peak beauty
 */

import puppeteer from 'puppeteer'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ffmpegBin = require('ffmpeg-static')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const FRAMES_DIR = path.join('/tmp', 'earth-capture-frames')
const CAPTURE_URL = process.env.CAPTURE_URL ?? 'http://localhost:3000/capture'

// 6 seconds at 30fps
const FPS = 30
const DURATION_S = 6
const CAPTURED_FRAMES = FPS * DURATION_S // 180
const INTERNAL_STEPS_PER_FRAME = 2 // advances animation 2 ticks per captured frame
const SIZE = 800

const OUT_MP4 = path.join(ROOT, 'public', 'earth-loop.mp4')
const OUT_GIF = path.join(ROOT, 'public', 'earth-loop.gif')
const OUT_OG = path.join(ROOT, 'public', 'og-image.png')

function ffmpeg(...args) {
  execFileSync(ffmpegBin, args, { stdio: 'inherit' })
}

async function main() {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true })
  fs.mkdirSync(FRAMES_DIR, { recursive: true })

  console.log('🌍  Launching headless browser...')
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${SIZE},${SIZE}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 })

  console.log(`🌐  Opening ${CAPTURE_URL} ...`)
  await page.goto(CAPTURE_URL, { waitUntil: 'networkidle0', timeout: 30_000 })

  // Wait for the capture API + coastlines to be ready
  console.log('⏳  Waiting for earth to initialise...')
  await page.waitForFunction('window.__earthCapture?.ready === true', { timeout: 20_000 })
  // Extra pause to let coastlines finish rendering
  await new Promise((r) => setTimeout(r, 1000))

  console.log(`📸  Capturing ${CAPTURED_FRAMES} frames (${DURATION_S}s @ ${FPS}fps)...`)

  for (let i = 0; i < CAPTURED_FRAMES; i++) {
    await page.evaluate((n) => window.__earthCapture.step(n), INTERNAL_STEPS_PER_FRAME)

    const dataUrl = await page.evaluate(() => window.__earthCapture.getDataURL())
    const base64 = dataUrl.slice('data:image/png;base64,'.length)
    const framePath = path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.png`)
    fs.writeFileSync(framePath, Buffer.from(base64, 'base64'))

    if (i % 30 === 0) console.log(`    ${i + 1}/${CAPTURED_FRAMES}`)
  }

  await browser.close()
  console.log('✅  All frames captured.\n')

  // ── MP4 ──────────────────────────────────────────────────────────────────
  console.log('🎬  Encoding MP4...')
  ffmpeg(
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    path.join(FRAMES_DIR, 'frame-%04d.png'),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    '-movflags',
    '+faststart',
    '-vf',
    `scale=${SIZE}:${SIZE},fade=in:0:15:color=black,fade=out:${CAPTURED_FRAMES - 15}:15:color=black`,
    OUT_MP4
  )

  // ── GIF ──────────────────────────────────────────────────────────────────
  // Two-pass palette generation for maximum quality and minimum size.
  // Fade in/out applied so the loop has no visible jump.
  console.log('🎞️   Encoding GIF (this takes ~30s)...')
  const palette = path.join('/tmp', 'earth-palette.png')
  const fadeFilter = `fade=in:0:15:color=black,fade=out:${CAPTURED_FRAMES - 15}:15:color=black`

  ffmpeg(
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    path.join(FRAMES_DIR, 'frame-%04d.png'),
    '-vf',
    `${fadeFilter},palettegen=stats_mode=diff`,
    palette
  )

  ffmpeg(
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    path.join(FRAMES_DIR, 'frame-%04d.png'),
    '-i',
    palette,
    '-filter_complex',
    `[0:v]${fadeFilter}[faded];[faded][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    OUT_GIF
  )

  // ── OG image ─────────────────────────────────────────────────────────────
  // Frame 90 = 3s in, all 10 new lights have appeared, earth at peak beauty.
  console.log('🖼️   Generating OG image (1200×630)...')
  const ogSource = path.join(FRAMES_DIR, `frame-${String(90).padStart(4, '0')}.png`)
  ffmpeg(
    '-y',
    '-i',
    ogSource,
    '-vf',
    'scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630',
    OUT_OG
  )

  // ── Summary ───────────────────────────────────────────────────────────────
  const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(1)
  console.log('\n✨  Done!')
  console.log(`   MP4  ${OUT_MP4}  (${mb(OUT_MP4)} MB)`)
  console.log(`   GIF  ${OUT_GIF}  (${mb(OUT_GIF)} MB)`)
  console.log(`   OG   ${OUT_OG}`)

  const gifMB = parseFloat(mb(OUT_GIF))
  const mp4MB = parseFloat(mb(OUT_MP4))

  if (gifMB > 3) {
    console.log(`\n⚠️   GIF is ${gifMB}MB (target < 3MB). Re-encode at lower resolution:`)
    console.log(`    npx ffmpeg -y -i "${OUT_GIF}" -vf "scale=600:600" "${OUT_GIF}"`)
  }
  if (mp4MB > 5) {
    console.log(`\n⚠️   MP4 is ${mp4MB}MB (target < 5MB). Re-encode with higher CRF:`)
    console.log(`    npx ffmpeg -y -i "${OUT_MP4}" -c:v libx264 -crf 28 "${OUT_MP4}"`)
  }
}

main().catch((err) => {
  console.error('\n❌  Capture failed:', err.message)
  process.exit(1)
})
