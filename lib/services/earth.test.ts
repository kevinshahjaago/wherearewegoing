import {
  getEarthFill,
  getRecentVisions,
  getTotalContributions,
  getCountryCount,
  getPrincipleCount,
  getUniqueContributorCount,
  deriveValuesHue,
} from './earth'
import { EXPERIENCE_CONFIG } from '@/config/experience'

function makeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    from: () => ({
      select: (_cols: string, opts?: Record<string, unknown>) => {
        // HEAD count query (fallback path in getTotalContributions)
        if (opts?.head === true) return Promise.resolve({ count: overrides.count ?? 0 })
        return {
          eq: () => ({
            single: () => Promise.resolve(overrides),
          }),
          order: () => ({
            limit: () => Promise.resolve(overrides),
          }),
          not: () => Promise.resolve(overrides),
          gt: () => ({
            not: () => Promise.resolve(overrides),
            limit: () => Promise.resolve(overrides),
          }),
        }
      },
    }),
  } as unknown as Parameters<typeof getEarthFill>[0]
}

describe('getEarthFill', () => {
  it('returns 0 when total is 0', async () => {
    const supabase = makeSupabase({ data: { total: 0 } })
    expect(await getEarthFill(supabase)).toBe(0)
  })

  it('clamps to 1 when total exceeds max', async () => {
    const supabase = makeSupabase({
      data: { total: EXPERIENCE_CONFIG.maxEarthFillContributions * 2 },
    })
    expect(await getEarthFill(supabase)).toBe(1)
  })

  it('returns proportional fill for midpoint', async () => {
    const supabase = makeSupabase({
      data: { total: EXPERIENCE_CONFIG.maxEarthFillContributions / 2 },
    })
    expect(await getEarthFill(supabase)).toBeCloseTo(0.5)
  })

  it('returns 0 when data is null', async () => {
    const supabase = makeSupabase({ data: null })
    expect(await getEarthFill(supabase)).toBe(0)
  })
})

describe('getTotalContributions', () => {
  it('returns the total count', async () => {
    const supabase = makeSupabase({ data: { total: 42 } })
    expect(await getTotalContributions(supabase)).toBe(42)
  })

  it('returns 0 when data is null', async () => {
    const supabase = makeSupabase({ data: null })
    expect(await getTotalContributions(supabase)).toBe(0)
  })
})

describe('getRecentVisions', () => {
  it('wraps missions and includes hues', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({
                data: [
                  {
                    mission: 'To love better',
                    hue: 35,
                    principles: ['Care precedes transaction'],
                    country_code: 'GB',
                  },
                  { mission: 'To listen', hue: 170, principles: [], country_code: null },
                ],
              }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof getRecentVisions>[0]

    const visions = await getRecentVisions(supabase, 5)
    expect(visions).toHaveLength(2)
    expect(visions[0]).toHaveProperty('mission')
    expect(visions[0]).toHaveProperty('missionHue')
    expect(visions[0]).toHaveProperty('valuesHue')
  })

  it('returns empty array when data is null', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof getRecentVisions>[0]

    expect(await getRecentVisions(supabase)).toHaveLength(0)
  })
})

describe('getCountryCount', () => {
  function makeRpcSupabase(value: number | null) {
    return { rpc: () => Promise.resolve({ data: value }) } as unknown as Parameters<
      typeof getCountryCount
    >[0]
  }

  it('returns the count from the RPC', async () => {
    expect(await getCountryCount(makeRpcSupabase(2))).toBe(2)
  })

  it('returns 0 when data is null', async () => {
    expect(await getCountryCount(makeRpcSupabase(null))).toBe(0)
  })
})

describe('getPrincipleCount', () => {
  function makeRpcSupabase(value: number | null) {
    return { rpc: () => Promise.resolve({ data: value }) } as unknown as Parameters<
      typeof getPrincipleCount
    >[0]
  }

  it('returns the count from the RPC', async () => {
    expect(await getPrincipleCount(makeRpcSupabase(3))).toBe(3)
  })

  it('returns 0 when data is null', async () => {
    expect(await getPrincipleCount(makeRpcSupabase(null))).toBe(0)
  })
})

describe('getUniqueContributorCount', () => {
  function makeRpcSupabase(value: number | null) {
    return { rpc: () => Promise.resolve({ data: value }) } as unknown as Parameters<
      typeof getUniqueContributorCount
    >[0]
  }

  it('returns the count from the RPC', async () => {
    expect(await getUniqueContributorCount(makeRpcSupabase(2))).toBe(2)
  })

  it('returns 0 when data is null', async () => {
    expect(await getUniqueContributorCount(makeRpcSupabase(null))).toBe(0)
  })
})

describe('deriveValuesHue', () => {
  it('returns 45 for empty principles', () => {
    expect(deriveValuesHue([])).toBe(45)
  })

  it('returns known hue for a single known principle', () => {
    expect(deriveValuesHue(['Interdependence'])).toBe(130)
  })

  it('returns a number in 0-359 range for unknown principles', () => {
    const h = deriveValuesHue(['Something completely unknown'])
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(359)
  })
})
