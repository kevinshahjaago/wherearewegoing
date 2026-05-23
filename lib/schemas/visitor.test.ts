import { VisitorUpsertSchema } from './visitor'

describe('VisitorUpsertSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = VisitorUpsertSchema.safeParse({ fingerprint: 'abc123' })
    expect(result.success).toBe(true)
  })

  it('rejects a fingerprint over 64 characters', () => {
    const result = VisitorUpsertSchema.safeParse({ fingerprint: 'x'.repeat(65) })
    expect(result.success).toBe(false)
  })

  it('rejects a countryCode that is not 2 characters', () => {
    expect(VisitorUpsertSchema.safeParse({ fingerprint: 'fp', countryCode: 'USA' }).success).toBe(
      false
    )
    expect(VisitorUpsertSchema.safeParse({ fingerprint: 'fp', countryCode: 'U' }).success).toBe(
      false
    )
  })

  it('accepts a valid 2-character countryCode', () => {
    const result = VisitorUpsertSchema.safeParse({ fingerprint: 'fp', countryCode: 'GB' })
    expect(result.success).toBe(true)
  })

  it('accepts valid geolocation', () => {
    const result = VisitorUpsertSchema.safeParse({
      fingerprint: 'fp',
      geolocation: { lat: 48.8, lng: 2.3 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects geolocation with non-numeric lat', () => {
    const result = VisitorUpsertSchema.safeParse({
      fingerprint: 'fp',
      geolocation: { lat: 'bad', lng: 2.3 },
    })
    expect(result.success).toBe(false)
  })
})
