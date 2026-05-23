'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EXPERIENCE_CONFIG } from '@/config/experience'
import { getBrowserFingerprint } from '@/lib/fingerprint'
import { track } from '@/lib/analytics/client'
import { getGeolocation } from '@/lib/geolocation'
import { createClient } from '@/lib/supabase/client'
import EarthCanvas, { type EarthCanvasHandle } from './EarthCanvas'
import styles from './Journey.module.css'

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6
type QuestionContent = { line1: string; line2: string } | null
type Delta = {
  newVoices: number
  trendingPrinciple: string | null
  newCountries: string[]
}

const { copy } = EXPERIENCE_CONFIG

const FALLBACK_VOICES = [
  '"To reduce unnecessary suffering"',
  '"To understand itself"',
  '"To love without keeping score"',
  '"To leave it better"',
  '"To protect what is fragile"',
  '"To be present"',
  '"To repair what is broken"',
  '"To see each other clearly"',
  '"That the future gets a vote"',
  '"To mean what we say"',
  '"To act as if we are responsible"',
  '"To stop treating people as problems"',
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
  const [displayVoices, setDisplayVoices] = useState<string[]>(FALLBACK_VOICES)
  const [voicesVisible, setVoicesVisible] = useState(false)
  const [voicesUnblurred, setVoicesUnblurred] = useState<boolean[]>(
    FALLBACK_VOICES.map(() => false)
  )
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
    (fetchedVoices: string[] | null = null) => {
      const voices = fetchedVoices && fetchedVoices.length > 0 ? fetchedVoices : FALLBACK_VOICES
      track('voices_revealed')
      setStep(5)
      setYourMark(`"${missionText.current}"`)
      setYourMarkVisible(true)
      setTimeout(() => setYourMarkOpacity(1), 200)
      transitionQuestion(null)

      setDisplayVoices(voices)
      setVoicesVisible(true)
      setVoicesUnblurred(voices.map(() => false))
      setTimeout(() => {
        voices.forEach((_, i) => {
          setTimeout(() => {
            setVoicesUnblurred((prev) => {
              const next = [...prev]
              next[i] = true
              return next
            })
          }, i * 100)
        })
      }, 1200)

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
    // Burst lights immediately (random placement) — geo positioning happens via real-time
    // events so other users see new lights at accurate coordinates
    earthRef.current?.addLights(12)
    earthRef.current?.flash()

    const animDone = new Promise<void>((resolve) => setTimeout(resolve, 2600))
    const voicesFetch = fetch('/api/voices')
      .then((r) => r.json() as Promise<{ voices: string[] }>)
      .then((d) => d.voices)
      .catch(() => null)

    // Race geo against 3 s — if the user grants permission quickly we include it;
    // if not (or permission is already denied and IP fallback is slow) we proceed without.
    const geo = await Promise.race([
      getGeolocation(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ])

    fetch('/api/contribute', {
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
    }).catch(() => null)

    const [, voices] = await Promise.all([animDone, voicesFetch])
    goReveal(voices ?? null)
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
    track('mission_submitted', { config_version: String(EXPERIENCE_CONFIG.version) })
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

  const goArrival = useCallback(() => {
    setStep(0)
    setInputVisible(false)
    setSeedsVisible(false)
    setSuggestsVisible(false)
    setVoicesVisible(false)
    setYourMarkVisible(false)
    setYourMarkOpacity(0)
    setShareRowVisible(false)
    setShiftsVisible(false)
    transitionQuestion({ line1: copy.arrival.line1, line2: copy.arrival.line2 })
    showBtn(copy.arrival.cta)
  }, [transitionQuestion, showBtn])

  const goContributeReturn = useCallback(async () => {
    const mission = inputRef.current?.value.trim() ?? ''
    setInputVisible(false)
    setShiftsVisible(false)
    earthRef.current?.addLights(7)
    earthRef.current?.flash()
    transitionQuestion({ line1: 'The earth holds', line2: 'every season of you.' })
    setTimeout(() => {
      setBtnVisible(false)
      setBtnDisabled(true)
    }, 500)

    if (!mission) return

    const geo = await Promise.race([
      getGeolocation(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ])

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
  }, [transitionQuestion])

  const goReturn = useCallback(() => {
    setStep(6)
    setInputVisible(false)
    setSeedsVisible(false)
    setSuggestsVisible(false)
    setVoicesVisible(false)
    setYourMarkVisible(false)
    setYourMarkOpacity(0)
    setShareRowVisible(false)
    transitionQuestion({ line1: copy.return.line1, line2: copy.return.line2 }, () =>
      showInput(copy.return.placeholder, copy.return.label)
    )
    setShiftsVisible(true)
    showBtn(copy.return.cta)
  }, [transitionQuestion, showBtn, showInput])

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
        void goContributeReturn()
        break
    }
  }, [step, btnDisabled, goMission, goPrinciples, goCommitment, goContribute, goContributeReturn])

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
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // Establish anonymous session, fingerprint the device, detect return visits.
  // Sets visitType which triggers the appropriate journey flow below.
  useEffect(() => {
    let cancelled = false

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
          const data = (await res.json()) as { isReturn: boolean; delta: Delta | null }
          if (!cancelled) {
            setDelta(data.delta)
            setVisitType(data.isReturn ? 'return' : 'first')
          }
          return
        }
      } catch {
        /* Supabase not configured or network error — fall through to first-visit */
      }
      if (!cancelled) setVisitType('first')
    }

    // Start the journey after 3 s even if the API hasn't responded
    const fallback = setTimeout(() => {
      if (!cancelled) setVisitType('first')
    }, 3000)

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
        goArrival()
      }
    }, 300)
    return () => clearTimeout(t)
  }, [visitType, delta, goReturn, goArrival])

  // R key: jump to return flow from reveal screen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  // Live earth: add a geo-positioned light on every new contribution INSERT
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
          earthRef.current?.addLights(1, geo)
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
      <EarthCanvas ref={earthRef} earthFill={earthFill} contributionCount={liveContributions} />

      <div className={styles.wordmark} aria-label="wherearewegoing.earth">
        wherearewegoing
      </div>

      <div className={styles.ui}>
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
                    {delta.newVoices.toLocaleString()} new voice{delta.newVoices !== 1 ? 's' : ''}{' '}
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

        <div
          role="region"
          aria-label={copy.reveal.voicesRegionLabel}
          aria-live="off"
          className={`${styles.voices}${voicesVisible ? ` ${styles.voicesVisible}` : ''}`}
        >
          {displayVoices.map((v, i) => (
            <span
              key={v}
              className={styles.voice}
              style={{
                animationDelay: `${i * 0.12}s`,
                filter: voicesUnblurred[i] ? 'blur(0)' : 'blur(7px)',
              }}
            >
              {v}
            </span>
          ))}
        </div>

        <div
          role="group"
          aria-label="Selected principles — tap to remove"
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
          aria-label="Suggested principles"
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
      </div>
    </>
  )
}
