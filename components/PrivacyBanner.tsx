'use client'

import { useState } from 'react'
import styles from './PrivacyBanner.module.css'

const STORAGE_KEY = 'privacy-acknowledged'

export default function PrivacyBanner() {
  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)
  )

  function acknowledge() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={styles.banner}
      role="dialog"
      aria-modal="false"
      aria-label="How we use your information"
    >
      <h2 className={styles.heading}>A few honest things before you begin</h2>

      <p className={styles.body}>
        When you visit, we give your device a private random ID — like a number in an envelope. No
        name. No email. We never know who you are.
      </p>

      <p className={styles.body}>
        We use that ID to remember if you&apos;ve been here before, so we can show you what&apos;s
        changed since your last visit.
      </p>

      <p className={styles.body}>
        If you choose to share your location, we use it to place your light on the earth. We only
        store your general coordinates — not your street or address. You can say no and your vision
        still counts.
      </p>

      <p className={styles.body}>
        Your vision is stored without your name. Other people see your words, not who you are.
      </p>

      <p className={`${styles.body} ${styles.promise}`}>
        We will never sell your data. Ever. To anyone.
      </p>

      <button className={styles.btn} onClick={acknowledge}>
        I understand — let me in
      </button>
    </div>
  )
}
