import { z } from 'zod';

const reason = z
    .string()
    .trim()
    .min(1, { message: 'zodError.partner.presenceModeration.reason.required' })
    .max(2000, { message: 'zodError.partner.presenceModeration.reason.max' });

/** Request to moderate or lift a Partner presence under ACC:12 (sources: action 13), AC:V7:14; V7 §1.6. */
export const PartnerPresenceModerationSchema = z.object({
    action: z.enum(['MODERATE', 'LIFT']),
    reason
});

/** Response after ACC:12 (sources: action 13) changes Partner presence moderation, AC:V7:14; V7 §1.6. */
export const PartnerPresenceModerationResponseSchema = z.object({
    id: z.string().uuid(),
    presenceModerated: z.boolean()
});

/** Parsed request for ACC:12 (sources: action 13), AC:V7:14; V7 §1.6. */
export type PartnerPresenceModeration = z.infer<typeof PartnerPresenceModerationSchema>;
/** Parsed response for ACC:12 (sources: action 13), AC:V7:14; V7 §1.6. */
export type PartnerPresenceModerationResponse = z.infer<
    typeof PartnerPresenceModerationResponseSchema
>;
