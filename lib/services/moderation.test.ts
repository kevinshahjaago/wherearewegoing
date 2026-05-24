/**
 * Safety agent tests — hard gates for the three-layer moderation pipeline.
 * All guard/harm/obscenity paths must have 100% verified behavior.
 */

// Mock pino logger before any module imports to avoid initialisation errors in Jest
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { child: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) },
}))

const mockMessagesCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}))

import { moderateContribution } from './moderation'

function stubLLM(text: string) {
  // mockResolvedValue (not Once) so there's no queue accumulation between tests
  mockMessagesCreate.mockResolvedValue({ content: [{ type: 'text', text }] })
}

const OLD_ENV = process.env

beforeEach(() => {
  // resetAllMocks clears both tracking data AND the implementation queue
  jest.resetAllMocks()
  process.env = { ...OLD_ENV, ANTHROPIC_API_KEY: 'test-key' }
})

afterEach(() => {
  process.env = OLD_ENV
})

// ─── PASS path ────────────────────────────────────────────────────────────────

describe('pass path', () => {
  it('returns mission and principles unchanged', async () => {
    stubLLM('{"action":"pass","mission":"To love better","principles":["Care first"]}')
    const result = await moderateContribution('To love better', ['Care first'])
    expect(result.action).toBe('pass')
    expect(result.mission).toBe('To love better')
    expect(result.principles).toEqual(['Care first'])
    expect(result.reframe).toBeUndefined()
  })
})

// ─── SAFETY GUARD path ────────────────────────────────────────────────────────

describe('safety guard (hard gate — silent, no client exposure)', () => {
  it('replaces mission with ❤️ on guard action', async () => {
    stubLLM('{"action":"guard"}')
    const result = await moderateContribution('<script>alert(1)</script>', [])
    expect(result.action).toBe('guard')
    expect(result.mission).toBe('❤️')
  })

  it('clears principles on guard action', async () => {
    stubLLM('{"action":"guard"}')
    const result = await moderateContribution('DROP TABLE contributions;', ['hack the planet'])
    expect(result.principles).toEqual([])
  })

  it('does NOT expose reframe field on guard action', async () => {
    stubLLM('{"action":"guard"}')
    const result = await moderateContribution('malicious content', [])
    expect(result.reframe).toBeUndefined()
  })
})

// ─── HARM AGENT path ──────────────────────────────────────────────────────────

describe('harm agent (transparent to user, with explanation)', () => {
  it('sets action to reframe with type harm', async () => {
    stubLLM(
      '{"action":"reframe","type":"harm","mission":"To protect all life","principles":[],"explanation":"We heard pain."}'
    )
    const result = await moderateContribution('violent harmful text', [])
    expect(result.action).toBe('reframe')
    expect(result.reframe?.type).toBe('harm')
  })

  it('provides reframed mission', async () => {
    stubLLM(
      '{"action":"reframe","type":"harm","mission":"To protect all life","principles":[],"explanation":"Reframed."}'
    )
    const result = await moderateContribution('original', [])
    expect(result.mission).toBe('To protect all life')
  })

  it('preserves original mission in reframe object for transparency notice', async () => {
    stubLLM(
      '{"action":"reframe","type":"harm","mission":"To protect life","principles":[],"explanation":"We heard you."}'
    )
    const result = await moderateContribution('original harmful text', [])
    expect(result.reframe?.originalMission).toBe('original harmful text')
  })

  it('returns explanation for display to user', async () => {
    stubLLM(
      '{"action":"reframe","type":"harm","mission":"To care","principles":[],"explanation":"Your words held something real."}'
    )
    const result = await moderateContribution('original', [])
    expect(result.reframe?.explanation).toBe('Your words held something real.')
  })
})

// ─── OBSCENITY AGENT path ─────────────────────────────────────────────────────

describe('obscenity agent (transparent to user, with explanation)', () => {
  it('sets action to reframe with type obscenity', async () => {
    stubLLM(
      '{"action":"reframe","type":"obscenity","mission":"To care for this world","principles":[],"explanation":"The love was always there."}'
    )
    const result = await moderateContribution('vulgar text', [])
    expect(result.action).toBe('reframe')
    expect(result.reframe?.type).toBe('obscenity')
  })

  it('provides reframed mission', async () => {
    stubLLM(
      '{"action":"reframe","type":"obscenity","mission":"To care for this world","principles":[],"explanation":"Reframed."}'
    )
    const result = await moderateContribution('original', [])
    expect(result.mission).toBe('To care for this world')
  })

  it('preserves original mission for transparency notice', async () => {
    stubLLM(
      '{"action":"reframe","type":"obscenity","mission":"To care","principles":[],"explanation":"Heard."}'
    )
    const result = await moderateContribution('original vulgar text', [])
    expect(result.reframe?.originalMission).toBe('original vulgar text')
  })
})

// ─── Blocklist hard gate ───────────────────────────────────────────────────────

describe('blocklist hard gate (applied to ALL principles in any path)', () => {
  it('strips blocklisted words from principles returned by LLM in reframe path', async () => {
    stubLLM(
      '{"action":"reframe","type":"obscenity","mission":"To heal","principles":["fuck everything","be kind"],"explanation":"Reframed."}'
    )
    const result = await moderateContribution('original', [])
    expect(result.principles).not.toContain('fuck everything')
    expect(result.principles).toContain('be kind')
  })

  it('strips all blocklisted words from a principles list with multiple violations', async () => {
    stubLLM(
      '{"action":"reframe","type":"harm","mission":"To protect","principles":["shit happens","care first","dick move"],"explanation":"Reframed."}'
    )
    const result = await moderateContribution('original', [])
    expect(result.principles).toEqual(['care first'])
  })

  it('returns empty principles array when all principles are blocked', async () => {
    stubLLM(
      '{"action":"reframe","type":"harm","mission":"To protect","principles":["fuck","shit","bitch"],"explanation":"Reframed."}'
    )
    const result = await moderateContribution('original', [])
    expect(result.principles).toEqual([])
  })
})

// ─── Code-fence stripping ─────────────────────────────────────────────────────

describe('markdown code fence stripping', () => {
  it('parses JSON wrapped in ```json fences', async () => {
    stubLLM('```json\n{"action":"pass","mission":"To grow","principles":["Be kind"]}\n```')
    const result = await moderateContribution('To grow', ['Be kind'])
    expect(result.action).toBe('pass')
    expect(result.mission).toBe('To grow')
  })

  it('parses JSON wrapped in plain ``` fences', async () => {
    stubLLM('```\n{"action":"guard"}\n```')
    const result = await moderateContribution('bad input', [])
    expect(result.action).toBe('guard')
  })
})

// ─── Graceful degradation ─────────────────────────────────────────────────────

describe('graceful degradation (fail open — never block a submission)', () => {
  it('passes through when ANTHROPIC_API_KEY is not set', async () => {
    process.env.ANTHROPIC_API_KEY = ''
    const result = await moderateContribution('some mission', ['a principle'])
    expect(mockMessagesCreate).not.toHaveBeenCalled()
    expect(result.action).toBe('pass')
    expect(result.mission).toBe('some mission')
  })

  it('passes through on non-JSON LLM response', async () => {
    stubLLM('Sorry, I cannot help with that.')
    const result = await moderateContribution('some mission', [])
    expect(result.action).toBe('pass')
    expect(result.mission).toBe('some mission')
  })

  it('passes through on unknown action in response', async () => {
    stubLLM('{"action":"unknown","mission":"x","principles":[]}')
    const result = await moderateContribution('some mission', [])
    expect(result.action).toBe('pass')
  })

  it('passes through on AbortError (timeout)', async () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    mockMessagesCreate.mockRejectedValueOnce(err)
    const result = await moderateContribution('mission', [])
    expect(result.action).toBe('pass')
    expect(result.mission).toBe('mission')
  })

  it('passes through on generic API error', async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error('network error'))
    const result = await moderateContribution('mission', [])
    expect(result.action).toBe('pass')
  })

  it('uses fallback principles when LLM returns non-array principles field', async () => {
    stubLLM('{"action":"reframe","type":"harm","mission":"Reframed","principles":"not an array","explanation":"x"}')
    const result = await moderateContribution('original', ['original principle'])
    // parsePrinciples falls back to original when value is not an array
    expect(result.principles).toEqual(['original principle'])
  })
})
