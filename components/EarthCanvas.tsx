'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { VisionItem } from '@/lib/services/earth'

const THEME_HUES = [15, 35, 55, 130, 170, 210, 240, 280, 310]
// Seed lights use biased palettes so the mode toggle is visually distinct
const MISSION_SEED_HUES = [15, 35, 55, 35, 15, 55, 310, 280] // warm: fire/love/hope
const VALUES_SEED_HUES = [130, 170, 220, 130, 170, 55, 280, 320] // cool: nature/peace/wisdom

export type EarthMode = 'mission' | 'values'

export type EarthCanvasHandle = {
  addLights: (
    n: number,
    geo?: { lat: number; lng: number },
    missionHue?: number,
    valuesHue?: number
  ) => void
  flash: () => void
  setMode: (mode: EarthMode) => void
  loadVisionLights: (visions: VisionItem[]) => void
  pulseUserLight: (
    geo?: { lat: number; lng: number },
    missionHue?: number,
    valuesHue?: number
  ) => void
  spinToLocation: (geo: { lat: number; lng: number }) => void
}

type Star = { x: number; y: number; r: number; a: number; ph: number; sp: number }
type Light = {
  th: number
  ph2: number
  r: number
  missionHue: number
  valuesHue: number
  a: number
  ta: number
  p: number
  sp: number
  grow: boolean
}
type UserLight = {
  th: number
  ph2: number
  missionHue: number
  valuesHue: number
  phase: number
  elapsed: number
}
type VisionLight = {
  th: number
  ph2: number
  missionHue: number
  vision: VisionItem
  projX: number
  projY: number
  projVisible: boolean
}
type AnimState = {
  W: number
  H: number
  eR: number
  cx: number
  cy: number
  stars: Star[]
  lights: Light[]
  visionLights: VisionLight[]
  userLight: UserLight | null
  earthFill: number
  earthRot: number
  spinTarget: number | null
  glowT: number
  rafId: number
  reducedMotion: boolean
  mode: EarthMode
  coastlines: [number, number][][]
  frameCount: number
  lastRevealFrame: number
  highlightedVisionIdx: number | null
  highlightAge: number
  shownVisionIndices: Set<number>
}

export default function EarthCanvas({
  ref,
  earthFill: initialFill = 0.36,
  contributionCount = 0,
  onLightClick,
  onVisionRevealed,
}: {
  ref?: Ref<EarthCanvasHandle>
  earthFill?: number
  contributionCount?: number
  onLightClick?: (vision: VisionItem | null) => void
  onVisionRevealed?: (vision: VisionItem) => void
}) {
  const starsRef = useRef<HTMLCanvasElement>(null)
  const earthRef = useRef<HTMLCanvasElement>(null)
  const flashEl = useRef<HTMLDivElement>(null)
  const onVisionRevealedRef = useRef(onVisionRevealed)
  useEffect(() => {
    onVisionRevealedRef.current = onVisionRevealed
  }, [onVisionRevealed])
  const anim = useRef<AnimState>({
    W: 0,
    H: 0,
    eR: 0,
    cx: 0,
    cy: 0,
    stars: [],
    lights: [],
    visionLights: [],
    userLight: null,
    earthFill: initialFill,
    earthRot: Math.PI / 2,
    spinTarget: null,
    glowT: 0,
    rafId: 0,
    reducedMotion: false,
    mode: 'mission',
    coastlines: [],
    frameCount: 0,
    lastRevealFrame: 0,
    highlightedVisionIdx: null,
    highlightAge: 0,
    shownVisionIndices: new Set<number>(),
  })

  useImperativeHandle(ref, () => ({
    addLights(
      n: number,
      geo?: { lat: number; lng: number },
      missionHue?: number,
      valuesHue?: number
    ) {
      const s = anim.current
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          const th = geo ? (geo.lng * Math.PI) / 180 - s.earthRot : Math.random() * Math.PI * 2
          const ph2 = geo ? ((90 - geo.lat) * Math.PI) / 180 : Math.acos(2 * Math.random() - 1)
          const mh = missionHue ?? THEME_HUES[Math.floor(Math.random() * THEME_HUES.length)]
          const vh = valuesHue ?? THEME_HUES[Math.floor(Math.random() * THEME_HUES.length)]
          s.lights.push({
            th,
            ph2,
            r: 1.5 + Math.random() * 3,
            missionHue: mh,
            valuesHue: vh,
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
    setMode(mode: EarthMode) {
      anim.current.mode = mode
    },
    loadVisionLights(visions: VisionItem[]) {
      const s = anim.current
      s.visionLights = visions.map((v) => {
        const geo = v.geolocation
        const th = geo ? (geo.lng * Math.PI) / 180 : Math.random() * Math.PI * 2
        const ph2 = geo ? ((90 - geo.lat) * Math.PI) / 180 : Math.acos(2 * Math.random() - 1)
        return {
          th,
          ph2,
          missionHue: v.missionHue,
          vision: v,
          projX: 0,
          projY: 0,
          projVisible: false,
        }
      })
      // Mark index 0 as already shown — Journey displays it immediately on reveal
      s.shownVisionIndices = new Set(visions.length > 0 ? [0] : [])
      s.highlightedVisionIdx = null
      s.highlightAge = 0
      s.lastRevealFrame = s.frameCount
    },
    pulseUserLight(geo?: { lat: number; lng: number }, missionHue?: number, valuesHue?: number) {
      const s = anim.current
      s.spinTarget = null // spin is done; resume normal rotation
      const th = geo ? (geo.lng * Math.PI) / 180 - s.earthRot : Math.random() * Math.PI * 2
      const ph2 = geo ? ((90 - geo.lat) * Math.PI) / 180 : Math.acos(2 * Math.random() - 1)
      const mh = missionHue ?? THEME_HUES[Math.floor(Math.random() * THEME_HUES.length)]
      const vh = valuesHue ?? mh
      s.userLight = { th, ph2, missionHue: mh, valuesHue: vh, phase: 0, elapsed: 0 }
    },
    spinToLocation(geo: { lat: number; lng: number }) {
      const s = anim.current
      if (s.reducedMotion) return
      // To bring longitude to the viewer-facing front: sin(lngRad + earthRot) = 1
      // → lngRad + earthRot = π/2  → target = π/2 - lngRad
      const lngRad = (geo.lng * Math.PI) / 180
      let target = Math.PI / 2 - lngRad
      // Normalise to the equivalent angle closest to current earthRot (shortest arc)
      while (target - s.earthRot > Math.PI) target -= Math.PI * 2
      while (target - s.earthRot < -Math.PI) target += Math.PI * 2
      s.spinTarget = target
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
      s.cy = H * 0.43
      s.eR = Math.min(W, H) * 0.28
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

    function _seedLights() {
      s.lights = []
      const count = Math.max(12, Math.floor(s.earthFill * 370))
      const isAmbient = s.earthFill === 0
      for (let i = 0; i < count; i++) {
        s.lights.push({
          th: Math.random() * Math.PI * 2,
          ph2: Math.acos(2 * Math.random() - 1),
          r: 1.5 + Math.random() * 3,
          missionHue: MISSION_SEED_HUES[Math.floor(Math.random() * MISSION_SEED_HUES.length)],
          valuesHue: VALUES_SEED_HUES[Math.floor(Math.random() * VALUES_SEED_HUES.length)],
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
      if (s.spinTarget !== null) {
        const diff = s.spinTarget - s.earthRot
        if (Math.abs(diff) < 0.006) {
          s.earthRot = s.spinTarget
          s.spinTarget = null
        } else {
          // Ease-out: fast start, decelerates as it approaches the target
          s.earthRot += diff * 0.038
        }
      } else {
        s.earthRot -= s.reducedMotion ? 0.0001 : 0.0007
      }
      if (!s.reducedMotion) s.glowT += 0.011
      const R = s.eR,
        { cx, cy } = s

      const gi = 0.06 + s.earthFill * 0.07 + 0.012 * Math.sin(s.glowT)
      const og = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.4)
      og.addColorStop(0, `rgba(80,140,210,${gi * 0.9})`)
      og.addColorStop(0.4, `rgba(50,110,180,${gi * 0.5})`)
      og.addColorStop(0.75, `rgba(30,70,140,${gi * 0.2})`)
      og.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.4, 0, Math.PI * 2)
      ctx.fillStyle = og
      ctx.fill()

      // Mode tint: warm amber (mission) ↔ sage green (values)
      const tintHue = s.mode === 'mission' ? 38 : 145
      const tintA = 0.055 + 0.018 * Math.sin(s.glowT * 0.7)
      const tg = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 1.05)
      tg.addColorStop(0, `hsla(${tintHue},58%,52%,${tintA})`)
      tg.addColorStop(0.55, `hsla(${tintHue},48%,44%,${tintA * 0.45})`)
      tg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2)
      ctx.fillStyle = tg
      ctx.fill()

      const bg = ctx.createRadialGradient(cx - R * 0.22, cy - R * 0.18, R * 0.04, cx, cy, R)
      bg.addColorStop(0, '#0e2040')
      bg.addColorStop(0.45, '#081830')
      bg.addColorStop(0.8, '#050f20')
      bg.addColorStop(1, '#020810')
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

      // Faint geographic grid — equator + prime meridian as reference lines
      ctx.lineWidth = 0.35
      ctx.strokeStyle = 'rgba(80,130,210,0.08)'
      // Equator (ph2 = π/2) and two latitude bands
      for (const ph2 of [Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3]) {
        ctx.beginPath()
        let gStarted = false
        for (let i = 0; i <= 120; i++) {
          const rt = (i / 120) * Math.PI * 2 + s.earthRot
          if (Math.sin(ph2) * Math.sin(rt) < -0.05) {
            gStarted = false
            continue
          }
          const px = cx - R * Math.sin(ph2) * Math.cos(rt)
          const py = cy - R * Math.cos(ph2)
          if (!gStarted) {
            ctx.moveTo(px, py)
            gStarted = true
          } else {
            ctx.lineTo(px, py)
          }
        }
        ctx.stroke()
      }
      // 4 longitude meridians
      for (let j = 0; j < 4; j++) {
        const lon = (j / 4) * Math.PI * 2
        ctx.beginPath()
        let gStarted = false
        for (let i = 0; i <= 80; i++) {
          const gph2 = (i / 80) * Math.PI
          const rt = lon + s.earthRot
          if (Math.sin(gph2) * Math.sin(rt) < -0.05) {
            gStarted = false
            continue
          }
          const px = cx - R * Math.sin(gph2) * Math.cos(rt)
          const py = cy - R * Math.cos(gph2)
          if (!gStarted) {
            ctx.moveTo(px, py)
            gStarted = true
          } else {
            ctx.lineTo(px, py)
          }
        }
        ctx.stroke()
      }

      // Continent coastlines (Natural Earth 50m, lazy-loaded)
      ctx.lineWidth = 0.8
      ctx.strokeStyle = 'rgba(140,190,255,0.28)'
      for (const seg of s.coastlines) {
        ctx.beginPath()
        let csStarted = false
        for (const [lat, lng] of seg) {
          const cth = (lng * Math.PI) / 180
          const cph2 = ((90 - lat) * Math.PI) / 180
          const crt = cth + s.earthRot
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

      for (const l of s.lights) {
        if (!s.reducedMotion) l.p += l.sp
        if (l.grow) {
          l.a = Math.min(l.ta, l.a + 0.025)
          if (l.a >= l.ta) l.grow = false
        }
        const rt = l.th + s.earthRot,
          sp = Math.sin(l.ph2)
        const px = cx - R * sp * Math.cos(rt),
          py = cy - R * Math.cos(l.ph2)
        const depth = sp * Math.sin(rt)
        if (depth < -0.08) continue
        const vis = (depth + 0.08) / 1.08
        const pulse = s.reducedMotion ? 1 : 0.72 + 0.28 * Math.sin(l.p)
        const alpha = l.a * vis * pulse,
          rad = l.r * (0.55 + 0.45 * vis)
        const hue = s.mode === 'mission' ? l.missionHue : l.valuesHue
        const gr = ctx.createRadialGradient(px, py, 0, px, py, rad * 2.8)
        gr.addColorStop(0, `hsla(${hue},65%,68%,${alpha})`)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(px, py, rad * 2.8, 0, Math.PI * 2)
        ctx.fillStyle = gr
        ctx.fill()
      }

      // Vision lights — larger, pulsing, interactive (hit-testable)
      const visionPulse = s.reducedMotion ? 1 : 0.78 + 0.22 * Math.sin(s.glowT * 1.3)
      for (let vi = 0; vi < s.visionLights.length; vi++) {
        const vl = s.visionLights[vi]
        const rt = vl.th + s.earthRot
        const sp = Math.sin(vl.ph2)
        const px = cx - R * sp * Math.cos(rt)
        const py = cy - R * Math.cos(vl.ph2)
        const depth = sp * Math.sin(rt)
        vl.projX = px
        vl.projY = py
        vl.projVisible = depth >= -0.08
        if (!vl.projVisible) continue
        const vis = (depth + 0.08) / 1.08
        const isHighlighted = s.highlightedVisionIdx === vi
        const highlightBoost = isHighlighted
          ? 1 + 0.5 * Math.max(0, 1 - s.highlightAge / 90)
          : 1
        const rad = 8 * (0.65 + 0.35 * vis) * visionPulse * highlightBoost
        const alpha = Math.min(0.95, 0.78 * vis + 0.15) * visionPulse * highlightBoost
        // Outer soft halo
        const gr = ctx.createRadialGradient(px, py, 0, px, py, rad * 5)
        gr.addColorStop(0, `hsla(${vl.missionHue},95%,96%,${alpha})`)
        gr.addColorStop(0.25, `hsla(${vl.missionHue},85%,78%,${alpha * 0.7})`)
        gr.addColorStop(0.6, `hsla(${vl.missionHue},70%,60%,${alpha * 0.25})`)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(px, py, rad * 5, 0, Math.PI * 2)
        ctx.fillStyle = gr
        ctx.fill()
        // White-hot core dot
        ctx.beginPath()
        ctx.arc(px, py, rad * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`
        ctx.fill()
        // Expanding reveal ring — plays for first ~1.5s after highlight
        if (isHighlighted && !s.reducedMotion) {
          const rp = Math.min(1, s.highlightAge / 90)
          const ringR = rad * (1.2 + rp * 7) * vis
          ctx.beginPath()
          ctx.arc(px, py, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = `hsla(${vl.missionHue},85%,82%,${(1 - rp) * 0.55 * vis})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      // Reveal selection: pick the visible, unshown light with lowest depth (≈ just rotated into view)
      const REVEAL_INTERVAL = 420 // ~7 s at 60 fps
      s.frameCount++
      if (s.highlightedVisionIdx !== null) {
        s.highlightAge++
        if (s.highlightAge > 300) s.highlightedVisionIdx = null
      }
      if (
        s.visionLights.length > 0 &&
        s.frameCount - s.lastRevealFrame >= REVEAL_INTERVAL
      ) {
        // Collect visible candidates with their depth
        type Candidate = { idx: number; depth: number; vision: VisionItem }
        const candidates: Candidate[] = []
        for (let vi = 0; vi < s.visionLights.length; vi++) {
          const vl = s.visionLights[vi]
          if (!vl.projVisible) continue
          const rt = vl.th + s.earthRot
          const depth = Math.sin(vl.ph2) * Math.sin(rt)
          if (depth < 0.05) continue // too close to horizon — unstable
          candidates.push({ idx: vi, depth, vision: vl.vision })
        }
        if (candidates.length > 0) {
          // Prefer unshown; sort ascending by depth so lowest (≈ just appeared) comes first
          let pool = candidates.filter((c) => !s.shownVisionIndices.has(c.idx))
          if (pool.length === 0) {
            s.shownVisionIndices = new Set()
            pool = candidates
          }
          pool.sort((a, b) => a.depth - b.depth)
          const pick = pool[0]
          s.highlightedVisionIdx = pick.idx
          s.highlightAge = 0
          s.lastRevealFrame = s.frameCount
          s.shownVisionIndices.add(pick.idx)
          onVisionRevealedRef.current?.(pick.vision)
        }
      }

      // User's own light — pulsing highlight for ~8s after submit
      if (s.userLight) {
        const ul = s.userLight
        ul.elapsed += 1
        if (!s.reducedMotion) ul.phase += 0.055

        const LIFE = 480 // ~8s at 60fps
        const FADE = 360 // start fading at ~6s
        if (ul.elapsed >= LIFE) {
          s.lights.push({
            th: ul.th,
            ph2: ul.ph2,
            r: 2.5,
            missionHue: ul.missionHue,
            valuesHue: ul.valuesHue,
            a: 0.75,
            ta: 0.75,
            p: ul.phase,
            sp: 0.01,
            grow: false,
          })
          s.userLight = null
        } else {
          const fade = ul.elapsed < FADE ? 1 : 1 - (ul.elapsed - FADE) / (LIFE - FADE)
          const rt = ul.th + s.earthRot
          const sinPh = Math.sin(ul.ph2)
          const px = cx - R * sinPh * Math.cos(rt)
          const py = cy - R * Math.cos(ul.ph2)
          const depth = sinPh * Math.sin(rt)
          if (depth >= -0.08) {
            const vis = (depth + 0.08) / 1.08
            const hue = s.mode === 'mission' ? ul.missionHue : ul.valuesHue
            const pulse = s.reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(ul.phase)

            // Expanding ring — plays once over first ~1.5s
            if (ul.elapsed < 90) {
              const rp = ul.elapsed / 90
              ctx.beginPath()
              ctx.arc(px, py, 5 + rp * 14, 0, Math.PI * 2)
              ctx.strokeStyle = `hsla(${hue},80%,78%,${(1 - rp) * 0.55 * vis * fade})`
              ctx.lineWidth = 1.5
              ctx.stroke()
            }

            // Bright pulsing core
            const rad = 6.5 * (0.55 + 0.45 * vis) * pulse
            const a = 0.9 * vis * fade
            const ugr = ctx.createRadialGradient(px, py, 0, px, py, rad * 3.5)
            ugr.addColorStop(0, `hsla(${hue},90%,92%,${a})`)
            ugr.addColorStop(0.3, `hsla(${hue},72%,68%,${a * 0.65})`)
            ugr.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.beginPath()
            ctx.arc(px, py, rad * 3.5, 0, Math.PI * 2)
            ctx.fillStyle = ugr
            ctx.fill()
          }
        }
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
      ctx.strokeStyle = `rgba(80,150,240,${0.18 + 0.05 * Math.sin(s.glowT * 0.6)})`
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
    loop()
    window.addEventListener('resize', resize)
    // Lazy-load coastline data after initial render (separate chunk, non-blocking)
    import('@/lib/coastlines').then(({ COASTLINES }) => {
      s.coastlines = COASTLINES
    })
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
    const cx = e.clientX,
      cy = e.clientY

    // Hit-test vision lights (44px tap radius — generous for mobile)
    let closest: VisionLight | null = null
    let minDist = 44
    for (const vl of s.visionLights) {
      if (!vl.projVisible) continue
      const dx = vl.projX - cx,
        dy = vl.projY - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < minDist) {
        minDist = d
        closest = vl
      }
    }
    if (closest) {
      onLightClick?.(closest.vision)
      return
    }

    // Background click — dismiss any selected vision, then flash
    onLightClick?.(null)
    const dx = cx - s.cx,
      dy = cy - s.cy
    if (Math.sqrt(dx * dx + dy * dy) < s.eR * 1.15) {
      const el = flashEl.current
      if (!el) return
      el.style.opacity = '1'
      setTimeout(() => {
        el.style.opacity = '0'
      }, 350)
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onLightClick) return
    const s = anim.current
    const mx = e.clientX,
      my = e.clientY
    for (const vl of s.visionLights) {
      if (!vl.projVisible) continue
      const dx = vl.projX - mx,
        dy = vl.projY - my
      if (Math.sqrt(dx * dx + dy * dy) < 44) {
        e.currentTarget.style.cursor = 'pointer'
        return
      }
    }
    e.currentTarget.style.cursor = 'default'
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
        onMouseMove={handleMouseMove}
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
