import { getEarthFill, getRecentVoices, getTotalContributions } from './earth'
import { EXPERIENCE_CONFIG } from '@/config/experience'

function makeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(overrides),
        }),
        order: () => ({
          limit: () => Promise.resolve(overrides),
        }),
        gt: () => ({
          not: () => Promise.resolve(overrides),
          limit: () => Promise.resolve(overrides),
        }),
      }),
    }),
  } as unknown as Parameters<typeof getEarthFill>[0]
}

describe('getEarthFill', () => {
  it('returns 0 when total is 0', async () => {
    const supabase = makeSupabase({ data: { total: 0 } })
    expect(await getEarthFill(supabase)).toBe(0)
  })

  it('clamps to 1 when total exceeds max', async () => {
    const supabase = makeSupabase({ data: { total: EXPERIENCE_CONFIG.maxEarthFillContributions * 2 } })
    expect(await getEarthFill(supabase)).toBe(1)
  })

  it('returns proportional fill for midpoint', async () => {
    const supabase = makeSupabase({ data: { total: EXPERIENCE_CONFIG.maxEarthFillContributions / 2 } })
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

describe('getRecentVoices', () => {
  it('wraps missions in quotes', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({
                data: [{ mission: 'To love better' }, { mission: 'To listen' }],
              }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof getRecentVoices>[0]

    const voices = await getRecentVoices(supabase, 5)
    expect(voices).toHaveLength(2)
    expect(voices[0]).toMatch(/^".*"$/)
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
    } as unknown as Parameters<typeof getRecentVoices>[0]

    expect(await getRecentVoices(supabase)).toHaveLength(0)
  })
})
