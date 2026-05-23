import { saveContribution } from './contribution'
import { EXPERIENCE_CONFIG } from '@/config/experience'

const BASE_ARGS = {
  visitorId: 'visitor-uuid',
  mission: 'To love better',
  principles: ['Care precedes transaction'],
}

function makeSupabase(error: { message: string } | null = null) {
  return {
    from: () => ({
      insert: () => Promise.resolve({ error }),
    }),
  } as unknown as Parameters<typeof saveContribution>[0]
}

describe('saveContribution', () => {
  it('stamps the current config version on insert', async () => {
    let inserted: Record<string, unknown> | null = null
    const supabase = {
      from: () => ({
        insert: (row: unknown) => {
          inserted = row as Record<string, unknown>
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as Parameters<typeof saveContribution>[0]

    await saveContribution(supabase, BASE_ARGS)
    expect(inserted).not.toBeNull()
    expect((inserted as unknown as Record<string, unknown>).config_version).toBe(
      EXPERIENCE_CONFIG.version
    )
  })

  it('includes geolocation when provided', async () => {
    let inserted: Record<string, unknown> | null = null
    const supabase = {
      from: () => ({
        insert: (row: unknown) => {
          inserted = row as Record<string, unknown>
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as Parameters<typeof saveContribution>[0]

    await saveContribution(supabase, { ...BASE_ARGS, geolocation: { lat: 51.5, lng: -0.1 } })
    expect((inserted as unknown as Record<string, unknown>).geolocation).toEqual({
      lat: 51.5,
      lng: -0.1,
    })
  })

  it('sets geolocation to null when omitted', async () => {
    let inserted: Record<string, unknown> | null = null
    const supabase = {
      from: () => ({
        insert: (row: unknown) => {
          inserted = row as Record<string, unknown>
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as Parameters<typeof saveContribution>[0]

    await saveContribution(supabase, BASE_ARGS)
    expect((inserted as unknown as Record<string, unknown>).geolocation).toBeNull()
  })

  it('sets commitment to null when omitted', async () => {
    let inserted: Record<string, unknown> | null = null
    const supabase = {
      from: () => ({
        insert: (row: unknown) => {
          inserted = row as Record<string, unknown>
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as Parameters<typeof saveContribution>[0]

    await saveContribution(supabase, BASE_ARGS)
    expect((inserted as unknown as Record<string, unknown>).commitment).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    const supabase = makeSupabase({ message: 'RLS violation' })
    await expect(saveContribution(supabase, BASE_ARGS)).rejects.toThrow('RLS violation')
  })

  it('resolves with a hue on success', async () => {
    const supabase = makeSupabase(null)
    await expect(saveContribution(supabase, BASE_ARGS)).resolves.toMatchObject({
      hue: expect.any(Number),
    })
  })
})
