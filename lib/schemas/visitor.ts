import { z } from 'zod'

export const VisitorUpsertSchema = z.object({
  fingerprint: z.string().max(64),
  countryCode: z.string().length(2).optional(),
  geolocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
})

export type VisitorUpsertInput = z.infer<typeof VisitorUpsertSchema>
