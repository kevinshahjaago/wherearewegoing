'use client'

// Canvas capture page — used by scripts/capture-earth.mjs to record the earth animation.
// Renders at 800×800 with no UI, controlled frame stepping via window.__earthCapture.
// NOT intended for end-user access.

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    __earthCapture: {
      step: (n?: number) => void
      getDataURL: () => string
      ready: boolean
    }
  }
}

const W = 800
const H = 800

const THEME_HUES = [15, 35, 55, 130, 170, 210, 240, 280, 310]
const MISSION_HUES = [15, 35, 55, 35, 15, 55, 310, 280]

// Add a new light at these internal frame numbers (10 lights over 360 internal frames)
const LIGHT_SCHEDULE = [10, 46, 82, 118, 154, 190, 226, 262, 298, 334]

export default function CaptureCanvas() {
  const starsRef = useRef<HTMLCanvasElement>(null)
  const earthRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const starsCanvas = starsRef.current!
    const earthCanvas = earthRef.current!
    starsCanvas.width = W
    starsCanvas.height = H
    earthCanvas.width = W
    earthCanvas.height = H

    const cx = W / 2
    const cy = H / 2
    const eR = W * 0.36

    let earthRot = Math.PI / 2
    let glowT = 0
    let internalFrame = 0
    let coastlines: [number, number][][] = []

    type Light = {
      th: number
      ph2: number
      r: number
      missionHue: number
      a: number
      ta: number
      p: number
      sp: number
      grow: boolean
    }

    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.1,
      a: 0.1 + Math.random() * 0.45,
      ph: Math.random() * Math.PI * 2,
      sp: 0.003 + Math.random() * 0.009,
    }))

    const lights: Light[] = []

    // Pre-seed 40 lights to represent existing contributions
    for (let i = 0; i < 40; i++) {
      lights.push({
        th: Math.random() * Math.PI * 2,
        ph2: Math.acos(2 * Math.random() - 1),
        r: 1.5 + Math.random() * 3,
        missionHue: MISSION_HUES[Math.floor(Math.random() * MISSION_HUES.length)],
        a: 0.3 + Math.random() * 0.6,
        ta: 0.3 + Math.random() * 0.6,
        p: Math.random() * Math.PI * 2,
        sp: 0.005 + Math.random() * 0.015,
        grow: false,
      })
    }

    let earthFill = 0.32

    function addLight() {
      const hue = THEME_HUES[Math.floor(Math.random() * THEME_HUES.length)]
      lights.push({
        th: Math.random() * Math.PI * 2,
        ph2: Math.acos(2 * Math.random() - 1),
        r: 1.5 + Math.random() * 3,
        missionHue: hue,
        a: 0,
        ta: 0.4 + Math.random() * 0.6,
        p: Math.random() * Math.PI * 2,
        sp: 0.005 + Math.random() * 0.015,
        grow: true,
      })
      earthFill = Math.min(1, earthFill + 0.009)
    }

    function drawStars() {
      const ctx = starsCanvas.getContext('2d')!
      ctx.clearRect(0, 0, W, H)
      for (const st of stars) {
        st.ph += st.sp
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240,230,210,${st.a * (0.6 + 0.4 * Math.sin(st.ph))})`
        ctx.fill()
      }
    }

    function drawEarth() {
      const ctx = earthCanvas.getContext('2d')!
      ctx.clearRect(0, 0, W, H)
      earthRot -= 0.0007
      glowT += 0.011
      const R = eR

      // Outer atmospheric glow
      const gi = 0.06 + earthFill * 0.07 + 0.012 * Math.sin(glowT)
      const og = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.4)
      og.addColorStop(0, `rgba(80,140,210,${gi * 0.9})`)
      og.addColorStop(0.4, `rgba(50,110,180,${gi * 0.5})`)
      og.addColorStop(0.75, `rgba(30,70,140,${gi * 0.2})`)
      og.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.4, 0, Math.PI * 2)
      ctx.fillStyle = og
      ctx.fill()

      // Warm amber tint (mission mode)
      const tintA = 0.055 + 0.018 * Math.sin(glowT * 0.7)
      const tg = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 1.05)
      tg.addColorStop(0, `hsla(38,58%,52%,${tintA})`)
      tg.addColorStop(0.55, `hsla(38,48%,44%,${tintA * 0.45})`)
      tg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2)
      ctx.fillStyle = tg
      ctx.fill()

      // Earth body
      const bg = ctx.createRadialGradient(cx - R * 0.22, cy - R * 0.18, R * 0.04, cx, cy, R)
      bg.addColorStop(0, '#0e2040')
      bg.addColorStop(0.45, '#081830')
      bg.addColorStop(0.8, '#050f20')
      bg.addColorStop(1, '#020810')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = bg
      ctx.fill()

      // Interior land-mass shadow blobs
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()
      for (const l of [
        { ox: -0.28, oy: -0.1, rx: 0.26, ry: 0.19 },
        { ox: 0.12, oy: -0.22, rx: 0.17, ry: 0.26 },
        { ox: 0.24, oy: 0.16, rx: 0.19, ry: 0.17 },
        { ox: -0.08, oy: 0.26, rx: 0.2, ry: 0.13 },
        { ox: -0.32, oy: 0.22, rx: 0.11, ry: 0.09 },
      ]) {
        const lx = cx + l.ox * R
        const ly = cy + l.oy * R
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, l.rx * R)
        lg.addColorStop(0, 'rgba(14,18,30,0.55)')
        lg.addColorStop(1, 'rgba(14,18,30,0)')
        ctx.beginPath()
        ctx.ellipse(lx, ly, l.rx * R, l.ry * R, earthRot * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = lg
        ctx.fill()
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.99, 0, Math.PI * 2)
      ctx.clip()

      // Geographic grid
      ctx.lineWidth = 0.35
      ctx.strokeStyle = 'rgba(80,130,210,0.08)'
      for (const ph2 of [Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3]) {
        ctx.beginPath()
        let started = false
        for (let i = 0; i <= 120; i++) {
          const rt = (i / 120) * Math.PI * 2 + earthRot
          if (Math.sin(ph2) * Math.sin(rt) < -0.05) {
            started = false
            continue
          }
          const px = cx - R * Math.sin(ph2) * Math.cos(rt)
          const py = cy - R * Math.cos(ph2)
          if (!started) {
            ctx.moveTo(px, py)
            started = true
          } else {
            ctx.lineTo(px, py)
          }
        }
        ctx.stroke()
      }

      // Coastlines (Natural Earth 50m)
      ctx.lineWidth = 0.8
      ctx.strokeStyle = 'rgba(140,190,255,0.28)'
      for (const seg of coastlines) {
        ctx.beginPath()
        let csStarted = false
        for (const [lat, lng] of seg) {
          const cth = (lng * Math.PI) / 180
          const cph2 = ((90 - lat) * Math.PI) / 180
          const crt = cth + earthRot
          const csp = Math.sin(cph2)
          const cpx = cx - R * csp * Math.cos(crt)
          const cpy = cy - R * Math.cos(cph2)
          const cdepth = csp * Math.sin(crt)
          if (cdepth < -0.05) {
            csStarted = false
            continue
          }
          if (!csStarted) {
            ctx.moveTo(cpx, cpy)
            csStarted = true
          } else {
            ctx.lineTo(cpx, cpy)
          }
        }
        ctx.stroke()
      }

      // Contribution lights
      for (const l of lights) {
        l.p += l.sp
        if (l.grow) {
          l.a = Math.min(l.ta, l.a + 0.025)
          if (l.a >= l.ta) l.grow = false
        }
        const rt = l.th + earthRot
        const sp = Math.sin(l.ph2)
        const px = cx - R * sp * Math.cos(rt)
        const py = cy - R * Math.cos(l.ph2)
        const depth = sp * Math.sin(rt)
        if (depth < -0.08) continue
        const vis = (depth + 0.08) / 1.08
        const pulse = 0.72 + 0.28 * Math.sin(l.p)
        const alpha = l.a * vis * pulse
        const rad = l.r * (0.55 + 0.45 * vis)
        const gr = ctx.createRadialGradient(px, py, 0, px, py, rad * 2.8)
        gr.addColorStop(0, `hsla(${l.missionHue},65%,68%,${alpha})`)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(px, py, rad * 2.8, 0, Math.PI * 2)
        ctx.fillStyle = gr
        ctx.fill()
      }

      ctx.restore()

      // Edge darkening
      const ev = ctx.createRadialGradient(cx, cy, R * 0.87, cx, cy, R)
      ev.addColorStop(0, 'rgba(0,0,0,0)')
      ev.addColorStop(0.65, 'rgba(8,12,22,0.28)')
      ev.addColorStop(1, 'rgba(4,6,14,0.88)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = ev
      ctx.fill()

      // Atmospheric rim
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(80,150,240,${0.18 + 0.05 * Math.sin(glowT * 0.6)})`
      ctx.lineWidth = R * 0.022
      ctx.stroke()
    }

    function step(n = 1) {
      for (let i = 0; i < n; i++) {
        if (LIGHT_SCHEDULE.includes(internalFrame)) addLight()
        drawStars()
        drawEarth()
        internalFrame++
      }
    }

    function getDataURL() {
      const composite = document.createElement('canvas')
      composite.width = W
      composite.height = H
      const ctx = composite.getContext('2d')!
      ctx.drawImage(starsCanvas, 0, 0)
      ctx.drawImage(earthCanvas, 0, 0)
      return composite.toDataURL('image/png')
    }

    // Load coastlines then mark ready — Puppeteer waits on window.__earthCapture.ready
    import('@/lib/coastlines').then(({ COASTLINES }) => {
      coastlines = COASTLINES
      drawStars()
      drawEarth()
      window.__earthCapture = { step, getDataURL, ready: true }
    })
  }, [])

  return (
    <div
      id="capture-root"
      style={{
        width: W,
        height: H,
        position: 'relative',
        background: '#06060e',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={starsRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      />
      <canvas
        ref={earthRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      />
    </div>
  )
}
