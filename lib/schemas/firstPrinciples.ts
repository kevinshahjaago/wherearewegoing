import { z } from 'zod'

export const FirstPrinciplesRequestSchema = z.object({
  mission: z.string().min(1).max(500),
})

// Each principle: short phrase, 4th-grade level, max 80 chars
export const FirstPrinciplesResponseSchema = z.object({
  principles: z.array(z.string().min(2).max(80)).min(0).max(8),
})

export type FirstPrinciplesRequest = z.infer<typeof FirstPrinciplesRequestSchema>
export type FirstPrinciplesResponse = z.infer<typeof FirstPrinciplesResponseSchema>
