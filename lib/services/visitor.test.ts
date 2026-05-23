import { upsertVisitor } from './visitor'

const BASE_ARGS = { userId: 'user-uuid-1', fingerprint: 'fp-abc123' }

/**
 * Builds a minimal Supabase mock shaped to match how visitor.ts calls the client.
 *
 * visitor.ts chains:
 *   visitors: .select(...).eq('id', ...).maybeSingle()
 *   visitors: .select(...).eq('fingerprint', ...).maybeSingle()
 *   visitors: .insert({...})
 *   visitors: .update({...}).eq('id', ...)
 *   contributions: .select('*', { count, head }).gt(...) → { count }
 *   contributions: .select('country_code').gt(...).not(...) → { data }
 *   contributions: .select('principles').gt(...) → { data }
 */
function buildSupabase({
  existingById = null as Record<string, unknown> | null,
  existingByFingerprint = null as Record<string, unknown> | null,
  newVoices = 0,
  countries = [] as string[],
  principleRows = [] as Array<{ principles: string[] }>,
} = {}) {
  const inserted: unknown[] = []
  const updated: unknown[] = []

  return {
    _inserted: inserted,
    _updated: updated,
    from(table: string) {
      return {
        select(cols: string, opts?: Record<string, unknown>) {
          return {
            eq(col: string, _val: unknown) {
              // visitors table, look up by id or fingerprint
              if (table === 'visitors') {
                const row = col === 'id' ? existingById : existingByFingerprint
                return { maybeSingle: () => Promise.resolve({ data: row }) }
              }
              return { maybeSingle: () => Promise.resolve({ data: null }) }
            },
            gt(_col: string, _val: unknown) {
              // contributions count query (head: true)
              if (opts?.count === 'exact' && opts?.head === true) {
                return Promise.resolve({ count: newVoices, data: null, error: null })
              }
              // contributions country_code query — needs .not() next
              if (cols.includes('country_code')) {
                return {
                  not: (_c: unknown, _op: unknown, _v: unknown) =>
                    Promise.resolve({
                      data: countries.map((c) => ({ country_code: c })),
                      error: null,
                    }),
                }
              }
              // contributions principles query
              return Promise.resolve({ data: principleRows, error: null })
            },
          }
        },
        insert(row: unknown) {
          inserted.push(row)
          return Promise.resolve({ error: null })
        },
        update(row: unknown) {
          updated.push(row)
          return {
            eq: (_col: unknown, _val: unknown) => Promise.resolve({ error: null }),
          }
        },
      }
    },
  } as unknown as Parameters<typeof upsertVisitor>[0] & {
    _inserted: unknown[]
    _updated: unknown[]
  }
}

describe('upsertVisitor — first visit', () => {
  it('returns isReturn=false and null delta when no prior record exists', async () => {
    const supabase = buildSupabase()
    const result = await upsertVisitor(supabase, BASE_ARGS)
    expect(result.isReturn).toBe(false)
    expect(result.delta).toBeNull()
    expect(result.visitCount).toBe(1)
  })

  it('inserts a new visitor row', async () => {
    const supabase = buildSupabase()
    await upsertVisitor(supabase, BASE_ARGS)
    expect(supabase._inserted).toHaveLength(1)
    expect((supabase._inserted[0] as Record<string, unknown>).id).toBe(BASE_ARGS.userId)
  })
})

describe('upsertVisitor — return visit (UUID match)', () => {
  it('returns isReturn=true and increments visitCount', async () => {
    const supabase = buildSupabase({
      existingById: { last_seen_at: '2024-01-01T00:00:00Z', visit_count: 3 },
      newVoices: 7,
      countries: ['US', 'DE'],
      principleRows: [
        { principles: ['Care precedes transaction', 'Long-term thinking'] },
        { principles: ['Care precedes transaction'] },
      ],
    })
    const result = await upsertVisitor(supabase, BASE_ARGS)
    expect(result.isReturn).toBe(true)
    expect(result.visitCount).toBe(4)
    expect(result.delta?.newVoices).toBe(7)
    expect(result.delta?.newCountries).toEqual(expect.arrayContaining(['US', 'DE']))
  })

  it('computes the trending principle correctly', async () => {
    const supabase = buildSupabase({
      existingById: { last_seen_at: '2024-01-01T00:00:00Z', visit_count: 1 },
      principleRows: [
        { principles: ['Interdependence', 'Long-term thinking'] },
        { principles: ['Interdependence'] },
        { principles: ['Long-term thinking'] },
      ],
    })
    const result = await upsertVisitor(supabase, BASE_ARGS)
    expect(result.delta?.trendingPrinciple).toBe('Interdependence')
  })

  it('updates last_seen_at on return visit', async () => {
    const supabase = buildSupabase({
      existingById: { last_seen_at: '2024-01-01T00:00:00Z', visit_count: 1 },
    })
    await upsertVisitor(supabase, BASE_ARGS)
    expect(supabase._updated).toHaveLength(1)
    expect(supabase._updated[0] as Record<string, unknown>).toHaveProperty('last_seen_at')
  })
})

describe('upsertVisitor — fingerprint fallback', () => {
  it('returns isReturn=true when fingerprint matches a prior visitor', async () => {
    const supabase = buildSupabase({
      existingById: null,
      existingByFingerprint: { last_seen_at: '2024-01-01T00:00:00Z' },
    })
    const result = await upsertVisitor(supabase, BASE_ARGS)
    expect(result.isReturn).toBe(true)
    expect(result.visitCount).toBe(1)
  })

  it('still inserts a fresh visitor row on fingerprint match', async () => {
    const supabase = buildSupabase({
      existingByFingerprint: { last_seen_at: '2024-01-01T00:00:00Z' },
    })
    await upsertVisitor(supabase, BASE_ARGS)
    expect(supabase._inserted).toHaveLength(1)
  })
})
