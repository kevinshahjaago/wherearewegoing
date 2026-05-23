import { ContributeSchema } from './contribution'

const VALID = {
  mission: 'To love better',
  configVersion: 1,
}

describe('ContributeSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = ContributeSchema.safeParse(VALID)
    expect(result.success).toBe(true)
  })

  it('rejects an empty mission', () => {
    const result = ContributeSchema.safeParse({ ...VALID, mission: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a mission over 500 characters', () => {
    const result = ContributeSchema.safeParse({ ...VALID, mission: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 principles', () => {
    const result = ContributeSchema.safeParse({ ...VALID, principles: Array(11).fill('a') })
    expect(result.success).toBe(false)
  })

  it('rejects a principle over 200 characters', () => {
    const result = ContributeSchema.safeParse({ ...VALID, principles: ['x'.repeat(201)] })
    expect(result.success).toBe(false)
  })

  it('rejects a commitment over 500 characters', () => {
    const result = ContributeSchema.safeParse({ ...VALID, commitment: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive configVersion', () => {
    const result = ContributeSchema.safeParse({ ...VALID, configVersion: 0 })
    expect(result.success).toBe(false)
  })

  it('defaults principles to [] when omitted', () => {
    const result = ContributeSchema.safeParse(VALID)
    expect(result.success && result.data.principles).toEqual([])
  })

  it('accepts valid geolocation', () => {
    const result = ContributeSchema.safeParse({ ...VALID, geolocation: { lat: 51.5, lng: -0.1 } })
    expect(result.success).toBe(true)
  })

  it('rejects geolocation missing lng', () => {
    const result = ContributeSchema.safeParse({ ...VALID, geolocation: { lat: 51.5 } })
    expect(result.success).toBe(false)
  })

  it('accepts isReturn as optional boolean', () => {
    expect(ContributeSchema.safeParse({ ...VALID, isReturn: true }).success).toBe(true)
    expect(ContributeSchema.safeParse({ ...VALID, isReturn: false }).success).toBe(true)
    expect(ContributeSchema.safeParse(VALID).success).toBe(true)
  })
})
