import { z } from 'zod';

/** Public request body for submitting a Partner application. */
export const PartnerApplicationSubmitSchema = z.object({
    email: z
        .string()
        .trim()
        .email('zodError.partnerApplication.email.invalid')
        .max(320, 'zodError.partnerApplication.email.max'),
    cfTurnstileToken: z.string().optional(),
    _hp: z.string().max(256).optional()
});

/** Public response body for an accepted Partner application. */
export const PartnerApplicationSubmitResponseSchema = z.object({
    submitted: z.literal(true)
});

/** Request body for cancelling a rejected application's wait. */
export const PartnerApplicationCancelWaitSchema = z.object({
    reason: z
        .string()
        .trim()
        .min(1, 'zodError.partnerApplication.reason.required')
        .max(2000, 'zodError.partnerApplication.reason.max')
});

/** Response body for a cancelled application wait. */
export const PartnerApplicationCancelWaitResponseSchema = z.object({
    cancelled: z.literal(true)
});
