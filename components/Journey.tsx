'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EXPERIENCE_CONFIG } from '@/config/experience'
import { getBrowserFingerprint } from '@/lib/fingerprint'
import { track } from '@/lib/analytics/client'
import { getGeolocation } from '@/lib/geolocation'
import { createClient } from '@/lib/supabase/client'
import EarthCanvas, { type EarthCanvasHandle } from './EarthCanvas'
import type { VisionItem } from '@/lib/services/earth'
import styles from './Journey.module.css'

const CLIENT_PRINCIPLE_HUES: Record<string, number> = {
  'Care precedes transaction': 30,
  'Repair over perfection': 15,
  'Curiosity over certainty': 55,
  'Presence as practice': 170,
  'Long-term thinking': 220,
  Interdependence: 130,
  'Truth-telling as kindness': 280,
  'Local action': 320,
}

function deriveClientValuesHue(principles: string[]): number {
  if (!principles.length) return 45
  const hues = principles.map((p) => {
    if (p in CLIENT_PRINCIPLE_HUES) return CLIENT_PRINCIPLE_HUES[p]
    let h = 0
    for (const c of p) h = (h * 31 + c.charCodeAt(0)) & 0xffff
    return h % 360
  })
  const sinSum = hues.reduce((s, h) => s + Math.sin((h * Math.PI) / 180), 0)
  const cosSum = hues.reduce((s, h) => s + Math.cos((h * Math.PI) / 180), 0)
  return Math.round(((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360)
}

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6
type QuestionContent = { line1: string; line2: string } | null
type Delta = {
  newVoices: number
  trendingPrinciple: string | null
  newCountries: string[]
}

const { copy } = EXPERIENCE_CONFIG

const FALLBACK_VISIONS: VisionItem[] = [
  {
    mission: 'To reduce unnecessary suffering',
    missionHue: 210,
    valuesHue: 170,
    countryCode: null,
    principles: ['Long-term thinking', 'Care precedes transaction'],
  },
  {
    mission: 'To understand itself',
    missionHue: 280,
    valuesHue: 220,
    countryCode: null,
    principles: ['Curiosity over certainty'],
  },
  {
    mission: 'To love without keeping score',
    missionHue: 35,
    valuesHue: 30,
    countryCode: null,
    principles: ['Care precedes transaction', 'Presence as practice'],
  },
  {
    mission: 'To leave it better',
    missionHue: 130,
    valuesHue: 130,
    countryCode: null,
    principles: ['Long-term thinking', 'Repair over perfection'],
  },
  {
    mission: 'To protect what is fragile',
    missionHue: 170,
    valuesHue: 170,
    countryCode: null,
    principles: ['Interdependence', 'Local action'],
  },
  {
    mission: 'To be present',
    missionHue: 55,
    valuesHue: 170,
    countryCode: null,
    principles: ['Presence as practice'],
  },
  {
    mission: 'To repair what is broken',
    missionHue: 15,
    valuesHue: 15,
    countryCode: null,
    principles: ['Repair over perfection', 'Truth-telling as kindness'],
  },
  {
    mission: 'To see each other clearly',
    missionHue: 240,
    valuesHue: 280,
    countryCode: null,
    principles: ['Truth-telling as kindness', 'Curiosity over certainty'],
  },
  {
    mission: 'That the future gets a vote',
    missionHue: 220,
    valuesHue: 220,
    countryCode: null,
    principles: ['Long-term thinking', 'Interdependence'],
  },
  {
    mission: 'To mean what we say',
    missionHue: 280,
    valuesHue: 280,
    countryCode: null,
    principles: ['Truth-telling as kindness'],
  },
  {
    mission: 'To act as if we are responsible',
    missionHue: 130,
    valuesHue: 55,
    countryCode: null,
    principles: ['Interdependence', 'Local action'],
  },
  {
    mission: 'To stop treating people as problems',
    missionHue: 310,
    valuesHue: 30,
    countryCode: null,
    principles: ['Care precedes transaction', 'Presence as practice'],
  },
]

export default function Journey({
  earthFill = 0,
  totalContributions = 0,
}: {
  earthFill?: number
  totalContributions?: number
}) {
  const [step, setStep] = useState<Step>(0)
  const [liveContributions, setLiveContributions] = useState(totalContributions)
  const [questionContent, setQuestionContent] = useState<QuestionContent>(null)
  const [questionVisible, setQuestionVisible] = useState(false)
  const [inputVisible, setInputVisible] = useState(false)
  const [inputPlaceholder, setInputPlaceholder] = useState('')
  const [inputLabel, setInputLabel] = useState('')
  const [seedsVisible, setSeedsVisible] = useState(false)
  const [suggestsVisible, setSuggestsVisible] = useState(false)
  const [principles, setPrinciples] = useState<string[]>([])
  const [usedSeeds, setUsedSeeds] = useState<Set<string>>(new Set())
  const [displayVisions, setDisplayVisions] = useState<VisionItem[]>(FALLBACK_VISIONS)
  const [realVisions, setRealVisions] = useState<VisionItem[]>([])
  const [cycleVoiceIdx, setCycleVoiceIdx] = useState(0)
  const [cycleVoiceVisible, setCycleVoiceVisible] = useState(false)
  const [countryCount, setCountryCount] = useState(0)
  const [principleCount, setPrincipleCount] = useState(0)
  const [contributorCount, setContributorCount] = useState(0)
  const [selectedVision, setSelectedVision] = useState<VisionItem | null>(null)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [anchoredMission, setAnchoredMission] = useState('')
  const [yourMark, setYourMark] = useState('')
  const [yourMarkVisible, setYourMarkVisible] = useState(false)
  const [yourMarkOpacity, setYourMarkOpacity] = useState(0)
  const [shareRowVisible, setShareRowVisible] = useState(false)
  const [copyLabel, setCopyLabel] = useState<string>(copy.reveal.copyLink)
  const [shiftsVisible, setShiftsVisible] = useState(false)
  const [delta, setDelta] = useState<Delta | null>(null)
  const [btnLabel, setBtnLabel] = useState<string>(copy.arrival.cta)
  const [btnVisible, setBtnVisible] = useState(false)
  const [btnDisabled, setBtnDisabled] = useState(false)
  const [inputError, setInputError] = useState(false)
  const [locationPromptVisible, setLocationPromptVisible] = useState(false)
  const [lastMission, setLastMission] = useState<string | null>(null)
  const [returnInputOpen, setReturnInputOpen] = useState(false)
  // null = session check in progress, 'first' | 'return' = determined
  const [visitType, setVisitType] = useState<'first' | 'return' | null>(null)

  const earthRef = useRef<EarthCanvasHandle>(null)
  const questionRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isComposing = useRef(false)
  const missionText = useRef('')
  const principlesRef = useRef<string[]>([])

  // Keep principlesRef in sync so goContribute can read without stale closure
  useEffect(() => {
    principlesRef.current = principles
  }, [principles])

  const transitionQuestion = useCallback((content: QuestionContent, cb?: () => void) => {
    setQuestionVisible(false)
    setTimeout(() => {
      setQuestionContent(content)
      setQuestionVisible(true)
      setTimeout(() => {
        questionRef.current?.focus()
        cb?.()
      }, 50)
    }, 350)
  }, [])

  const showBtn = useCallback((label: string, disabled = false) => {
    setBtnLabel(label)
    setBtnDisabled(disabled)
    setBtnVisible(false)
    setTimeout(() => setBtnVisible(true), 500)
  }, [])

  const showInput = useCallback((placeholder: string, label: string) => {
    setInputPlaceholder(placeholder)
    setInputLabel(label)
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.style.height = 'auto'
    }
    setInputVisible(true)
    setTimeout(() => inputRef.current?.focus(), 750)
  }, [])

  // Declared before goContribute which calls it
  const goReveal = useCallback(
    (
      fetched: {
        visions: VisionItem[]
        countryCount: number
        principleCount: number
        contributorCount: number
      } | null = null
    ) => {
      // Real visions shown in the explore list (no fallbacks — count must match stats bar)
      const real = fetched?.visions ?? []
      setRealVisions(real)
      // Cycling voice blends in fallbacks for variety when DB is sparse
      const padded = [...real]
      for (const fb of FALLBACK_VISIONS) {
        if (padded.length >= 12) break
        padded.push(fb)
      }
      const visions = padded.length > 0 ? padded : FALLBACK_VISIONS
      track('voices_revealed')
      setStep(5)
      if (missionText.current) {
        setYourMark(`"${missionText.current}"`)
        setYourMarkVisible(true)
        setTimeout(() => setYourMarkOpacity(1), 200)
      }
      transitionQuestion(null)

      setDisplayVisions(visions)
      setSelectedVision(null)
      if (fetched) {
        setCountryCount(fetched.countryCount)
        setPrincipleCount(fetched.principleCount ?? 0)
        setContributorCount(fetched.contributorCount ?? 0)
      }
      // Use the full padded list so there are always lights to click (fallbacks fill in when DB is sparse)
      earthRef.current?.loadVisionLights(visions)
      setCycleVoiceIdx(0)
      setExploreOpen(false)
      setTimeout(() => setCycleVoiceVisible(true), 1200)
      setTimeout(() => setShareRowVisible(true), 2800)
      showBtn(copy.reveal.returnCta, true)
    },
    [transitionQuestion, showBtn]
  )

  const goContribute = useCallback(async () => {
    const commitment = inputRef.current?.value.trim()
    setStep(4)
    setInputVisible(false)
    setSeedsVisible(false)
    setSuggestsVisible(false)
    setBtnDisabled(true)
    transitionQuestion({ line1: copy.joining.line1, line2: copy.joining.line2 })

    // Burst uses random theme hues; canonical hue is assigned by Claude server-side
    // and arrives back on the earth via the real-time channel INSERT event.
    earthRef.current?.addLights(12)
    earthRef.current?.flash()

    const animDone = new Promise<void>((resolve) => setTimeout(resolve, 2600))
    const voicesFetch = fetch('/api/voices')
      .then(
        (r) =>
          r.json() as Promise<{
            visions: VisionItem[]
            countryCount: number
            principleCount: number
            contributorCount: number
          }>
      )
      .then((d) => ({
        visions: d.visions ?? [],
        countryCount: d.countryCount ?? 0,
        principleCount: d.principleCount ?? 0,
        contributorCount: d.contributorCount ?? 0,
      }))
      .catch(() => null)

    setLocationPromptVisible(true)
    const geo = await Promise.race([
      getGeolocation(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ])
    setLocationPromptVisible(false)

    const contributeFetch = fetch('/api/contribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mission: missionText.current,
        principles: principlesRef.current,
        commitment,
        geolocation: geo ? { lat: geo.lat, lng: geo.lng } : undefined,
        configVersion: EXPERIENCE_CONFIG.version,
        isReturn: false,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          r.json()
            .then((b) => console.error('[contribute]', r.status, b))
            .catch(() => null)
          return undefined as number | undefined
        }
        const body = (await r.json()) as { success: boolean; hue?: number }
        return body.hue
      })
      .catch((e: unknown) => {
        console.error('[contribute]', e)
        return undefined as number | undefined
      })

    const [, , userHue] = await Promise.all([animDone, voicesFetch, contributeFetch])
    // Re-fetch voices fresh so the just-submitted vision is included
    const freshVoices = await fetch('/api/voices')
      .then(
        (r) =>
          r.json() as Promise<{
            visions: VisionItem[]
            countryCount: number
            principleCount: number
            contributorCount: number
          }>
      )
      .catch(() => null)
    earthRef.current?.pulseUserLight(
      geo ?? undefined,
      userHue,
      deriveClientValuesHue(principlesRef.current)
    )
    if (userHue !== undefined) setLiveContributions((n) => n + 1)
    goReveal(freshVoices ?? null)
  }, [transitionQuestion, goReveal])

  const goCommitment = useCallback(() => {
    track('principles_submitted', {
      principle_count: String(principlesRef.current.length),
      config_version: String(EXPERIENCE_CONFIG.version),
    })
    setStep(3)
    setSeedsVisible(false)
    setSuggestsVisible(false)
    setInputVisible(false)
    transitionQuestion({ line1: copy.commitment.line1, line2: copy.commitment.line2 }, () =>
      showInput(copy.commitment.placeholder, copy.commitment.label)
    )
    showBtn(copy.commitment.cta)
  }, [transitionQuestion, showBtn, showInput])

  const goPrinciples = useCallback(() => {
    const val = inputRef.current?.value.trim() ?? ''
    if (!val) {
      setInputError(true)
      inputRef.current?.focus()
      setTimeout(() => setInputError(false), 1500)
      return
    }
    missionText.current = val
    setAnchoredMission(val)
    track('mission_submitted', { config_version: String(EXPERIENCE_CONFIG.version) })
    // Brief burst so the user feels their light land in the earth on mission submit
    // Hue is random here — the canonical hue arrives via the real-time channel after API assigns it
    earthRef.current?.addLights(3)
    setStep(2)
    setPrinciples([])
    setUsedSeeds(new Set())
    setInputVisible(false)
    setSeedsVisible(true)
    setSuggestsVisible(true)
    transitionQuestion({ line1: copy.principles.line1, line2: copy.principles.line2 }, () =>
      showInput(copy.principles.placeholder, copy.principles.label)
    )
    showBtn(copy.principles.cta)
  }, [transitionQuestion, showBtn, showInput])

  const goMission = useCallback(() => {
    setStep(1)
    setSeedsVisible(false)
    setSuggestsVisible(false)
    transitionQuestion({ line1: copy.mission.line1, line2: copy.mission.line2 }, () =>
      showInput(copy.mission.placeholder, copy.mission.label)
    )
    showBtn(copy.mission.cta)
  }, [transitionQuestion, showBtn, showInput])

  // Skip adding a mission; fetch fresh voices and go straight to the reveal.
  const goExploreOnly = useCallback(async () => {
    setBtnDisabled(true)
    setBtnVisible(false)
    setShiftsVisible(false)
    setInputVisible(false)
    setReturnInputOpen(false)
    earthRef.current?.addLights(3)
    const freshVoices = await fetch('/api/voices')
      .then(
        (r) =>
          r.json() as Promise<{
            visions: VisionItem[]
            countryCount: number
            principleCount: number
            contributorCount: number
          }>
      )
      .catch(() => null)
    goReveal(freshVoices ?? null)
  }, [goReveal])

  // Reveal the optional mission input after the user opts in.
  const openReturnInput = useCallback(() => {
    setReturnInputOpen(true)
    transitionQuestion({ line1: copy.return.line1, line2: copy.return.line2 }, () =>
      showInput(copy.return.placeholder, copy.return.label)
    )
    showBtn('Add my light')
  }, [transitionQuestion, showBtn, showInput])

  const goContributeReturn = useCallback(async () => {
    const mission = inputRef.current?.value.trim() ?? ''
    setInputVisible(false)
    setShiftsVisible(false)
    setReturnInputOpen(false)
    setBtnVisible(false)
    setBtnDisabled(true)

    if (mission) {
      missionText.current = mission
      earthRef.current?.addLights(7)
      earthRef.current?.flash()
    } else {
      earthRef.current?.addLights(3)
    }

    setLocationPromptVisible(true)
    const geo = await Promise.race([
      getGeolocation(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ])
    setLocationPromptVisible(false)

    if (mission) {
      setLiveContributions((n) => n + 1)
      earthRef.current?.pulseUserLight(geo ?? undefined)
      fetch('/api/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission,
          principles: [],
          geolocation: geo ? { lat: geo.lat, lng: geo.lng } : undefined,
          configVersion: EXPERIENCE_CONFIG.version,
          isReturn: true,
        }),
      }).catch(() => null)
    }

    const freshVoices = await fetch('/api/voices')
      .then(
        (r) =>
          r.json() as Promise<{
            visions: VisionItem[]
            countryCount: number
            principleCount: number
            contributorCount: number
          }>
      )
      .catch(() => null)
    goReveal(freshVoices ?? null)
  }, [goReveal])

  const goReturn = useCallback(() => {
    setStep(6)
    setInputVisible(false)
    setSeedsVisible(false)
    setSuggestsVisible(false)
    setCycleVoiceVisible(false)
    setYourMarkVisible(false)
    setYourMarkOpacity(0)
    setShareRowVisible(false)
    setReturnInputOpen(false)
    setSelectedVision(null)
    setShiftsVisible(true)
    transitionQuestion(null)
    showBtn('Explore the earth')
  }, [transitionQuestion, showBtn])

  const addPrinciple = useCallback((text?: string) => {
    const val = text ?? inputRef.current?.value.trim() ?? ''
    if (!val) return
    setPrinciples((prev) => (prev.includes(val) ? prev : [...prev, val]))
    if (!text && inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.style.height = 'auto'
      inputRef.current.focus()
    }
  }, [])

  const removePrinciple = useCallback((index: number) => {
    setPrinciples((prev) => {
      const removed = prev[index]
      setUsedSeeds((u) => {
        const s = new Set(u)
        s.delete(removed)
        return s
      })
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const addSuggest = useCallback(
    (seed: string) => {
      addPrinciple(seed)
      setUsedSeeds((prev) => new Set([...prev, seed]))
    },
    [addPrinciple]
  )

  const SHARE_URL = 'https://wherearewegoing.earth'
  const SHARE_TEXT = 'Where are we going? Add your voice →'

  const copyLink = useCallback(async () => {
    track('share_clicked', { channel: 'copy' })
    try {
      await navigator.clipboard.writeText(SHARE_URL)
      setCopyLabel(copy.reveal.copied)
      setTimeout(() => setCopyLabel(copy.reveal.copyLink), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [])

  const shareWhatsApp = useCallback(() => {
    track('share_clicked', { channel: 'whatsapp' })
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }, [])

  const shareX = useCallback(() => {
    track('share_clicked', { channel: 'x' })
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }, [])

  const handleBtn = useCallback(() => {
    if (btnDisabled) return
    switch (step) {
      case 0:
        goMission()
        break
      case 1:
        goPrinciples()
        break
      case 2:
        goCommitment()
        break
      case 3:
        void goContribute()
        break
      case 6:
        if (returnInputOpen) {
          void goContributeReturn()
        } else {
          void goExploreOnly()
        }
        break
    }
  }, [
    step,
    btnDisabled,
    returnInputOpen,
    goMission,
    goPrinciples,
    goCommitment,
    goContribute,
    goContributeReturn,
    goExploreOnly,
  ])

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && step === 2 && !isComposing.current) {
        e.preventDefault()
        addPrinciple()
      }
    },
    [step, addPrinciple]
  )

  const handleInputResize = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    // Comma or Arabic comma → create pill immediately (values step only)
    if (step === 2 && (el.value.endsWith(',') || el.value.endsWith('،'))) {
      const text = el.value.slice(0, -1).trim()
      if (text) {
        addPrinciple(text)
        el.value = ''
        el.style.height = 'auto'
        return
      }
    }
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [step, addPrinciple])

  // Establish anonymous session, fingerprint the device, detect return visits.
  // Sets visitType which triggers the appropriate journey flow below.
  useEffect(() => {
    let cancelled = false

    // Fallback fires after 3 s if the API hasn't responded yet.
    // Declared before initSession so the closure can clearTimeout it on success.
    const fallback = setTimeout(() => {
      if (!cancelled) setVisitType('first')
    }, 3000)

    async function initSession() {
      try {
        const supabase = createClient()
        let {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) {
          ;({
            data: { session },
          } = await supabase.auth.signInAnonymously())
        }
        if (!session || cancelled) return

        const fingerprint = await getBrowserFingerprint()
        const res = await fetch('/api/visitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint }),
        })
        if (cancelled) return

        if (res.ok) {
          const data = (await res.json()) as {
            isReturn: boolean
            delta: Delta | null
            lastMission: string | null
          }
          if (!cancelled) {
            clearTimeout(fallback) // API answered — cancel so it can't overwrite visitType
            setDelta(data.delta)
            setLastMission(data.lastMission ?? null)
            setVisitType(data.isReturn ? 'return' : 'first')
          }
          return
        }
      } catch {
        /* Supabase not configured or network error — fall through to first-visit */
      }
      if (!cancelled) {
        clearTimeout(fallback)
        setVisitType('first')
      }
    }

    initSession()
    return () => {
      cancelled = true
      clearTimeout(fallback)
    }
  }, [])

  // Launch appropriate flow once visit type is known
  useEffect(() => {
    if (!visitType) return
    const t = setTimeout(() => {
      if (visitType === 'return') {
        track('return_visit_started', {
          delta_contributions: String(delta?.newVoices ?? 0),
        })
        goReturn()
      } else {
        track('journey_started', { config_version: String(EXPERIENCE_CONFIG.version) })
        goMission()
      }
    }, 300)
    return () => clearTimeout(t)
  }, [visitType, delta, goReturn, goMission])

  // R key: jump to return flow from reveal screen (not while typing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'Escape') setSelectedVision(null)
      if ((e.key === 'r' || e.key === 'R') && step >= 5) goReturn()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [step, goReturn])

  // Push the UI above the software keyboard on iOS and Android.
  // visualViewport.height shrinks when the keyboard opens; the difference is the
  // keyboard height. We expose it as --keyboard-offset so the CSS padding-bottom
  // can react without a re-render.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`)
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // Track abandonment when the tab is hidden mid-journey (steps 1–2)
  useEffect(() => {
    if (step !== 1 && step !== 2) return
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        track('journey_abandoned', {
          last_step: String(step),
          config_version: String(EXPERIENCE_CONFIG.version),
        })
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [step])

  // Cycle voices one at a time on the reveal screen
  useEffect(() => {
    if (step !== 5 || displayVisions.length === 0 || exploreOpen) return
    const interval = setInterval(() => {
      setCycleVoiceVisible(false)
      setTimeout(() => {
        setCycleVoiceIdx((i) => (i + 1) % displayVisions.length)
        setCycleVoiceVisible(true)
      }, 900)
    }, 7000)
    return () => clearInterval(interval)
  }, [step, displayVisions.length, exploreOpen])

  // Live earth: add a geo-positioned, hue-colored light on every new contribution INSERT
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('earth-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contributions' },
        (payload) => {
          const raw = payload.new?.geolocation as { lat: number; lng: number } | null | undefined
          const geo =
            raw?.lat != null && raw?.lng != null ? { lat: raw.lat, lng: raw.lng } : undefined
          const missionHue = payload.new?.hue as number | null | undefined
          earthRef.current?.addLights(1, geo, missionHue ?? undefined, undefined)
          setLiveContributions((n) => n + 1)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return (
    <>
      <EarthCanvas
        ref={earthRef}
        earthFill={earthFill}
        contributionCount={liveContributions}
        onLightClick={setSelectedVision}
      />

      <div
        role="status"
        aria-live="polite"
        className={`${styles.locationPrompt}${locationPromptVisible ? ` ${styles.locationPromptVisible}` : ''}`}
      >
        Share your location so we can add your vision to where you are
      </div>

      <div
        className={`${styles.wordmark}${selectedVision ? ` ${styles.wordmarkHidden}` : ''}`}
        aria-label="wherearewegoing.earth"
      >
        where are we going . earth
      </div>

      <div className={`${styles.ui}${selectedVision ? ` ${styles.uiHidden}` : ''}`}>
        <div
          ref={questionRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
          className={`${styles.question}${questionVisible ? ` ${styles.questionVisible}` : ''}`}
        >
          {questionContent && (
            <>
              {questionContent.line1}
              <br />
              <em className={styles.questionEmphasis}>{questionContent.line2}</em>
            </>
          )}
        </div>

        {shiftsVisible && lastMission && (
          <div className={styles.lastMission}>
            <span className={styles.lastMissionLabel}>Your last light</span>
            &ldquo;{lastMission}&rdquo;
          </div>
        )}

        <ul
          aria-label="What has changed since your last visit"
          className={`${styles.shiftList}${shiftsVisible ? ` ${styles.shiftListVisible}` : ''}`}
        >
          {delta ? (
            <>
              {delta.newVoices > 0 && (
                <li className={styles.shift}>
                  <span
                    className={styles.sdot}
                    style={{ background: 'var(--sage)' }}
                    aria-hidden="true"
                  />
                  <span>
                    {delta.newVoices.toLocaleString()} new vision{delta.newVoices !== 1 ? 's' : ''}{' '}
                    since you were last here
                  </span>
                </li>
              )}
              {delta.trendingPrinciple && (
                <li className={styles.shift}>
                  <span
                    className={styles.sdot}
                    style={{ background: 'var(--gold)' }}
                    aria-hidden="true"
                  />
                  <span>
                    <em style={{ fontStyle: 'italic', color: 'rgba(201,168,76,0.55)' }}>
                      {delta.trendingPrinciple}
                    </em>{' '}
                    rose to become the most shared principle
                  </span>
                </li>
              )}
              {delta.newCountries.length > 0 && (
                <li className={styles.shift}>
                  <span
                    className={styles.sdot}
                    style={{ background: '#c26b3a' }}
                    aria-hidden="true"
                  />
                  <span>
                    {delta.newCountries.length} countr
                    {delta.newCountries.length !== 1 ? 'ies' : 'y'} joined for the first time
                  </span>
                </li>
              )}
            </>
          ) : (
            /* Shown while delta loads or on first-ever return before data exists */
            <li className={styles.shift}>
              <span
                className={styles.sdot}
                style={{ background: 'var(--sage)' }}
                aria-hidden="true"
              />
              <span>{copy.return.earthHolds}</span>
            </li>
          )}
        </ul>

        <div
          role="status"
          aria-live="polite"
          className={`${styles.yourMark}${yourMarkVisible ? ` ${styles.yourMarkVisible}` : ''}`}
          style={{ opacity: yourMarkOpacity }}
        >
          {yourMark}
        </div>

        {step === 2 && anchoredMission && (
          <div className={styles.missionAnchor} aria-hidden="true">
            &ldquo;{anchoredMission}&rdquo;
          </div>
        )}

        <div
          role="status"
          aria-live="polite"
          aria-label={copy.reveal.voicesRegionLabel}
          className={`${styles.cycleVoice}${cycleVoiceVisible && !exploreOpen ? ` ${styles.cycleVoiceVisible}` : ''}`}
        >
          {step === 5 && !exploreOpen ? `"${displayVisions[cycleVoiceIdx]?.mission ?? ''}"` : ''}
        </div>

        {step === 5 && (
          <div className={styles.statsBar}>
            <span>{liveContributions.toLocaleString()} visions</span>
            {contributorCount > 0 && (
              <>
                <span className={styles.statsDot} aria-hidden="true" />
                <span>{contributorCount.toLocaleString()} people</span>
              </>
            )}
            {principleCount > 0 && (
              <>
                <span className={styles.statsDot} aria-hidden="true" />
                <span>{principleCount.toLocaleString()} principles</span>
              </>
            )}
            {countryCount > 0 && (
              <>
                <span className={styles.statsDot} aria-hidden="true" />
                <span>{countryCount} countries</span>
              </>
            )}
          </div>
        )}

        <button
          className={`${styles.exploreToggle}${step === 5 && realVisions.length > 0 ? ` ${styles.exploreToggleVisible}` : ''}`}
          onClick={() => setExploreOpen((o) => !o)}
        >
          {exploreOpen ? copy.reveal.exploreCollapse : copy.reveal.exploreAll}
        </button>

        <div
          role="region"
          aria-label={copy.reveal.voicesRegionLabel}
          className={`${styles.exploreList}${exploreOpen && realVisions.length > 0 ? ` ${styles.exploreListVisible}` : ''}`}
        >
          {realVisions.map((v, i) => (
            <div key={i} className={styles.exploreItem}>
              <span
                className={styles.exploreHue}
                style={{ background: `hsl(${v.missionHue},55%,62%)` }}
                aria-hidden="true"
              />
              <div>
                <p className={styles.exploreMission}>&ldquo;{v.mission}&rdquo;</p>
                {v.principles.length > 0 && (
                  <div className={styles.explorePrinciples}>
                    {v.principles.slice(0, 3).map((p) => (
                      <span key={p} className={styles.explorePrinciple}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                {v.countryCode && <p className={styles.exploreCountry}>{v.countryCode}</p>}
              </div>
            </div>
          ))}
        </div>

        <div
          role="group"
          aria-label="Selected values — tap to remove"
          className={`${styles.seeds}${seedsVisible ? ` ${styles.seedsVisible}` : ''}`}
        >
          {principles.map((p, i) => (
            <button
              key={p}
              className={styles.seed}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => removePrinciple(i)}
              aria-pressed="true"
              title="Tap to remove"
            >
              {p}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label="Suggested values"
          className={`${styles.suggests}${suggestsVisible ? ` ${styles.suggestsVisible}` : ''}`}
        >
          {(copy.principles.seeds as readonly string[]).map((seed) => {
            const used = usedSeeds.has(seed)
            return (
              <button
                key={seed}
                className={`${styles.pill}${used ? ` ${styles.pillUsed}` : ''}`}
                onClick={() => addSuggest(seed)}
                aria-pressed={used}
                tabIndex={used ? -1 : 0}
              >
                {seed}
              </button>
            )
          })}
        </div>

        <div className={`${styles.inputWrap}${inputVisible ? ` ${styles.inputWrapVisible}` : ''}`}>
          <label htmlFor="journey-answer" className="sr-only">
            {inputLabel}
          </label>
          <textarea
            ref={inputRef}
            id="journey-answer"
            className={styles.answer}
            rows={2}
            placeholder={inputPlaceholder}
            onInput={handleInputResize}
            onKeyDown={handleInputKeyDown}
            onCompositionStart={() => {
              isComposing.current = true
            }}
            onCompositionEnd={() => {
              isComposing.current = false
            }}
            aria-required={step === 1}
            autoComplete="off"
            style={inputError ? { borderBottomColor: 'rgba(194,107,58,0.6)' } : undefined}
          />
        </div>

        <div
          role="group"
          aria-label="Share options"
          className={`${styles.shareRow}${shareRowVisible ? ` ${styles.shareRowVisible}` : ''}`}
        >
          <button className={styles.shareBtn} onClick={copyLink}>
            {copyLabel}
          </button>
          <button className={styles.shareBtn} onClick={shareWhatsApp}>
            WhatsApp
          </button>
          <button className={styles.shareBtn} onClick={shareX}>
            X
          </button>
        </div>

        <button
          className={`${styles.btn}${btnVisible ? ` ${styles.btnVisible}` : ''}`}
          onClick={handleBtn}
          aria-disabled={btnDisabled ? 'true' : undefined}
          tabIndex={btnDisabled ? -1 : 0}
        >
          {btnLabel}
        </button>

        {step === 6 && btnVisible && (
          <button
            className={styles.returnAction}
            onClick={returnInputOpen ? () => void goExploreOnly() : openReturnInput}
          >
            {returnInputOpen ? 'Skip — explore the earth' : 'Add today’s light'}
          </button>
        )}
      </div>
      {/* Vision card — shown when a light on the earth is clicked */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Vision from around the world"
        className={`${styles.visionCard}${selectedVision ? ` ${styles.visionCardVisible}` : ''}`}
      >
        {selectedVision && (
          <>
            <p className={styles.visionCardMission}>&ldquo;{selectedVision.mission}&rdquo;</p>
            {selectedVision.principles.length > 0 && (
              <div className={styles.visionCardPrinciples}>
                {selectedVision.principles.map((p) => (
                  <span key={p} className={styles.visionCardPrinciple}>
                    {p}
                  </span>
                ))}
              </div>
            )}
            {selectedVision.countryCode && (
              <p className={styles.visionCardCountry}>{selectedVision.countryCode}</p>
            )}
            <p className={styles.visionCardDismiss}>tap the earth to close</p>
          </>
        )}
      </div>
    </>
  )
}
