'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'

// Mirrors the theme hues in lib/services/hue.ts — kept here as a plain constant
// so this client component never imports the server-only Anthropic SDK.
const THEME_HUES = [15, 35, 55, 130, 170, 210, 240, 280, 310]

export type EarthCanvasHandle = {
  addLights: (n: number, geo?: { lat: number; lng: number }, hue?: number) => void
  flash: () => void
}

type Star = { x: number; y: number; r: number; a: number; ph: number; sp: number }
type Light = {
  th: number
  ph2: number
  r: number
  hue: number
  a: number
  ta: number
  p: number
  sp: number
  grow: boolean
}
type AnimState = {
  W: number
  H: number
  eR: number
  cx: number
  cy: number
  stars: Star[]
  lights: Light[]
  earthFill: number
  earthRot: number
  glowT: number
  rafId: number
  reducedMotion: boolean
}

export default function EarthCanvas({
  ref,
  earthFill: initialFill = 0.36,
  contributionCount = 0,
}: {
  ref?: Ref<EarthCanvasHandle>
  earthFill?: number
  contributionCount?: number
}) {
  const starsRef = useRef<HTMLCanvasElement>(null)
  const earthRef = useRef<HTMLCanvasElement>(null)
  const flashEl = useRef<HTMLDivElement>(null)
  const anim = useRef<AnimState>({
    W: 0,
    H: 0,
    eR: 0,
    cx: 0,
    cy: 0,
    stars: [],
    lights: [],
    earthFill: initialFill,
    earthRot: 0,
    glowT: 0,
    rafId: 0,
    reducedMotion: false,
  })

  useImperativeHandle(ref, () => ({
    addLights(n: number, geo?: { lat: number; lng: number }, hue?: number) {
      const s = anim.current
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          const th = geo ? (geo.lng * Math.PI) / 180 - s.earthRot : Math.random() * Math.PI * 2
          const ph2 = geo ? ((90 - geo.lat) * Math.PI) / 180 : Math.acos(2 * Math.random() - 1)
          const lightHue = hue ?? THEME_HUES[Math.floor(Math.random() * THEME_HUES.length)]
          s.lights.push({
            th,
            ph2,
            r: 1.5 + Math.random() * 3,
            hue: lightHue,
            a: 0,
            ta: 0.3 + Math.random() * 0.7,
            p: Math.random() * Math.PI * 2,
            sp: 0.005 + Math.random() * 0.015,
            grow: true,
          })
        }, i * 140)
      }
      s.earthFill = Math.min(1, s.earthFill + 0.012)
    },
    flash() {
      const el = flashEl.current
      if (!el) return
      el.style.opacity = '1'
      setTimeout(() => {
        el.style.opacity = '0'
      }, 350)
    },
  }))

  useEffect(() => {
    const s = anim.current
    s.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      const W = window.innerWidth,
        H = window.innerHeight
      s.W = W
      s.H = H
      s.cx = W / 2
      // Shift earth slightly above center so text/button have room below without overlap
      s.cy = H * 0.43
      s.eR = Math.min(W, H) * 0.22
      const sC = starsRef.current,
        eC = earthRef.current
      if (sC) {
        sC.width = W
        sC.height = H
      }
      if (eC) {
        eC.width = W
        eC.height = H
      }
    }

    function initStars() {
      s.stars = Array.from({ length: 260 }, () => ({
        x: Math.random() * s.W,
        y: Math.random() * s.H,
        r: Math.random() * 1.1,
        a: 0.1 + Math.random() * 0.45,
        ph: Math.random() * Math.PI * 2,
        sp: 0.003 + Math.random() * 0.009,
      }))
    }

    function seedLights() {
      s.lights = []
      const count = Math.max(12, Math.floor(s.earthFill * 370))
      const isAmbient = s.earthFill === 0
      for (let i = 0; i < count; i++) {
        s.lights.push({
          th: Math.random() * Math.PI * 2,
          ph2: Math.acos(2 * Math.random() - 1),
          r: 1.5 + Math.random() * 3,
          hue: THEME_HUES[Math.floor(Math.random() * THEME_HUES.length)],
          a: isAmbient ? 0.1 + Math.random() * 0.15 : 0.3 + Math.random() * 0.7,
          ta: isAmbient ? 0.1 + Math.random() * 0.15 : 0.3 + Math.random() * 0.7,
          p: Math.random() * Math.PI * 2,
          sp: 0.005 + Math.random() * 0.015,
          grow: false,
        })
      }
    }

    function drawStars() {
      const sC = starsRef.current
      if (!sC) return
      const ctx = sC.getContext('2d')!
      ctx.clearRect(0, 0, s.W, s.H)
      for (const st of s.stars) {
        if (!s.reducedMotion) st.ph += st.sp
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240,230,210,${st.a * (0.6 + 0.4 * Math.sin(st.ph))})`
        ctx.fill()
      }
    }

    function drawEarth() {
      const eC = earthRef.current
      if (!eC) return
      const ctx = eC.getContext('2d')!
      ctx.clearRect(0, 0, s.W, s.H)
      s.earthRot += s.reducedMotion ? 0.0001 : 0.0007
      if (!s.reducedMotion) s.glowT += 0.011
      const R = s.eR,
        { cx, cy } = s

      const gi = 0.06 + s.earthFill * 0.07 + 0.012 * Math.sin(s.glowT)
      const og = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.4)
      og.addColorStop(0, `rgba(201,168,76,${gi})`)
      og.addColorStop(0.6, `rgba(122,156,126,${gi * 0.3})`)
      og.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.4, 0, Math.PI * 2)
      ctx.fillStyle = og
      ctx.fill()

      const bg = ctx.createRadialGradient(cx - R * 0.22, cy - R * 0.18, R * 0.04, cx, cy, R)
      bg.addColorStop(0, '#181d2c')
      bg.addColorStop(0.45, '#0d0f1e')
      bg.addColorStop(0.8, '#080a14')
      bg.addColorStop(1, '#040508')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = bg
      ctx.fill()

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
        const lx = cx + l.ox * R,
          ly = cy + l.oy * R
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, l.rx * R)
        lg.addColorStop(0, 'rgba(14,18,30,0.55)')
        lg.addColorStop(1, 'rgba(14,18,30,0)')
        ctx.beginPath()
        ctx.ellipse(lx, ly, l.rx * R, l.ry * R, s.earthRot * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = lg
        ctx.fill()
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.99, 0, Math.PI * 2)
      ctx.clip()
      for (const l of s.lights) {
        if (!s.reducedMotion) l.p += l.sp
        if (l.grow) {
          l.a = Math.min(l.ta, l.a + 0.025)
          if (l.a >= l.ta) l.grow = false
        }
        const rt = l.th + s.earthRot,
          sp = Math.sin(l.ph2)
        const px = cx + R * sp * Math.cos(rt),
          py = cy + R * Math.cos(l.ph2)
        const depth = sp * Math.sin(rt)
        if (depth < -0.08) continue
        const vis = (depth + 0.08) / 1.08
        const pulse = s.reducedMotion ? 1 : 0.72 + 0.28 * Math.sin(l.p)
        const alpha = l.a * vis * pulse,
          rad = l.r * (0.55 + 0.45 * vis)
        const gr = ctx.createRadialGradient(px, py, 0, px, py, rad * 2.8)
        gr.addColorStop(0, `hsla(${l.hue},65%,68%,${alpha})`)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(px, py, rad * 2.8, 0, Math.PI * 2)
        ctx.fillStyle = gr
        ctx.fill()
      }
      ctx.restore()

      const ev = ctx.createRadialGradient(cx, cy, R * 0.87, cx, cy, R)
      ev.addColorStop(0, 'rgba(0,0,0,0)')
      ev.addColorStop(0.65, 'rgba(8,12,22,0.28)')
      ev.addColorStop(1, 'rgba(4,6,14,0.88)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = ev
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(155,190,210,${0.1 + 0.03 * Math.sin(s.glowT * 0.6)})`
      ctx.lineWidth = R * 0.022
      ctx.stroke()
    }

    function loop() {
      drawStars()
      drawEarth()
      s.rafId = requestAnimationFrame(loop)
    }

    resize()
    initStars()
    seedLights()
    loop()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(s.rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    anim.current.earthFill = initialFill
  }, [initialFill])

  function handleClick(e: React.MouseEvent) {
    const s = anim.current
    const dx = e.clientX - s.cx,
      dy = e.clientY - s.cy
    if (Math.sqrt(dx * dx + dy * dy) < s.eR * 1.15) {
      const el = flashEl.current
      if (!el) return
      el.style.opacity = '1'
      setTimeout(() => {
        el.style.opacity = '0'
      }, 350)
    }
  }

  const label = `Earth visualization with ${contributionCount.toLocaleString()} contribution${contributionCount !== 1 ? 's' : ''}`

  return (
    <>
      <canvas
        ref={starsRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      />
      <canvas
        ref={earthRef}
        role="img"
        aria-label={label}
        aria-describedby="earth-desc"
        onClick={handleClick}
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
      />
      <p id="earth-desc" className="sr-only">
        A visualization of collective human intentions. Each light represents one person&apos;s
        contribution.
      </p>
      <div
        ref={flashEl}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(201,168,76,0.13) 0%, transparent 65%)',
          pointerEvents: 'none',
          zIndex: 5,
          opacity: 0,
          transition: 'opacity 0.2s ease',
        }}
      />
    </>
  )
}
