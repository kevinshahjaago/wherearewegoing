// Bump `version` whenever question framing changes — stamped on every submission
// so historical contributions remain interpretable.
export const EXPERIENCE_CONFIG = {
  version: 1,
  maxEarthFillContributions: parseInt(process.env.MAX_EARTH_FILL_CONTRIBUTIONS ?? '10000', 10),
  voices: {
    sampleSize: 20,
    cacheSeconds: 30,
  },
  rateLimit: {
    contributeRpm: parseInt(process.env.RATE_LIMIT_CONTRIBUTE_RPM ?? '5', 10),
  },
  copy: {
    arrival: {
      line1: 'Where are we',
      line2: 'going?',
      cta: 'Add my light',
    },
    mission: {
      line1: 'What do you want',
      line2: "the earth's mission to be?",
      placeholder: 'To love, and keep learning how to love better…',
      cta: 'Add my light',
      label: "Earth's mission",
    },
    principles: {
      line1: 'What values would',
      line2: 'need to be true?',
      placeholder: 'We treat strangers as neighbors…',
      cta: 'Continue',
      label: 'A value',
      seeds: [
        'Care precedes transaction',
        'Repair over perfection',
        'Curiosity over certainty',
        'Presence as practice',
        'Long-term thinking',
        'Interdependence',
        'Truth-telling as kindness',
        'Local action',
      ],
    },
    commitment: {
      line1: 'One thing you will do',
      line2: 'this week.',
      placeholder: 'Call my father. Actually listen this time.',
      cta: 'Submit yours to see everyone else’s',
      label: 'Your commitment this week',
    },
    joining: {
      line1: 'Your light is joining',
      line2: 'the earth.',
    },
    reveal: {
      voicesRegionLabel: 'Voices from around the world',
      copyLink: 'Copy link',
      copied: 'Copied ✓',
      returnCta: 'Return another day',
    },
    return: {
      line1: 'What is your mission',
      line2: 'today?',
      placeholder: 'To slow down enough to notice what is already here…',
      cta: 'Add to the earth',
      label: 'Your mission today',
      earthHolds: 'The earth holds every season of you.',
    },
  },
} as const

export type ExperienceConfig = typeof EXPERIENCE_CONFIG
