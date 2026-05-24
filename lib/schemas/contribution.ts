import { z } from 'zod'

export const ContributeSchema = z.object({
  mission: z.string().min(1).max(500),
  principles: z.array(z.string().max(200)).max(10).default([]),
  commitment: z.string().max(500).optional(),
  geolocation: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  configVersion: z.number().int().positive(),
  isReturn: z.boolean().optional(),
})

export type ContributeInput = z.infer<typeof ContributeSchema>
