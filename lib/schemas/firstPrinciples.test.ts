import { FirstPrinciplesRequestSchema, FirstPrinciplesResponseSchema } from './firstPrinciples'

describe('FirstPrinciplesRequestSchema', () => {
  it('accepts a valid mission string', () => {
    const result = FirstPrinciplesRequestSchema.safeParse({ mission: 'To love better' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty mission', () => {
    const result = FirstPrinciplesRequestSchema.safeParse({ mission: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a mission exceeding 500 chars', () => {
    const result = FirstPrinciplesRequestSchema.safeParse({ mission: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('rejects missing mission field', () => {
    const result = FirstPrinciplesRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('FirstPrinciplesResponseSchema', () => {
  it('accepts a valid principles array', () => {
    const result = FirstPrinciplesResponseSchema.safeParse({
      principles: ['Be kind', 'Act with care'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty array', () => {
    const result = FirstPrinciplesResponseSchema.safeParse({ principles: [] })
    expect(result.success).toBe(true)
  })

  it('rejects a principle exceeding 80 chars', () => {
    const result = FirstPrinciplesResponseSchema.safeParse({
      principles: ['a'.repeat(81)],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 8 principles', () => {
    const result = FirstPrinciplesResponseSchema.safeParse({
      principles: Array.from({ length: 9 }, (_, i) => `Principle ${i}`),
    })
    expect(result.success).toBe(false)
  })
})
