import Anthropic from '@anthropic-ai/sdk'

// Spread of representative hues used for ambient/seeded lights before real hues arrive
export const THEME_HUES = [15, 35, 55, 130, 170, 210, 240, 280, 310]

// Compact prompt — ~40 tokens in, 3 tokens out. ~$0.00004 per call on Haiku.
const PROMPT = (mission: string) =>
  `Mission: "${mission}"\nHue 0-359 for its essence (0=fire, 35=love, 55=hope, 130=nature, 170=peace, 220=wisdom, 280=creativity, 320=community). Integer only.`

export async function assignHue(mission: string): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) return 45

  try {
    const client = new Anthropic()
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8,
      messages: [{ role: 'user', content: PROMPT(mission) }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    const hue = parseInt(text, 10)
    return Number.isFinite(hue) && hue >= 0 && hue <= 359 ? hue : 45
  } catch {
    return 45
  }
}
