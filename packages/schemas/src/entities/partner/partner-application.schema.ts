import { z } from 'zod';
import { PartnerTypeEnumSchema } from '../../enums/partner-type.schema.js';

const partnerApplicationReasonSchema = z
    .string()
    .trim()
    .min(1, 'zodError.partnerApplication.reason.required')
    .max(2000, 'zodError.partnerApplication.reason.max');

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
    reason: partnerApplicationReasonSchema
});

/** Response body for a cancelled application wait. */
export const PartnerApplicationCancelWaitResponseSchema = z.object({
    cancelled: z.literal(true)
});

/** Request body for approving a Partner application as action 5. */
export const PartnerApplicationApproveSchema = z.object({
    name: z.string().min(1).max(255),
    type: PartnerTypeEnumSchema,
    reason: partnerApplicationReasonSchema
});

/** Response body for an approved Partner application. */
export const PartnerApplicationApproveResponseSchema = z.object({
    approved: z.literal(true),
    partnerId: z.string().uuid()
});

/** Request body for rejecting a Partner application as action 5. */
export const PartnerApplicationRejectSchema = z.object({ reason: partnerApplicationReasonSchema });

/** Response body for a rejected Partner application. */
export const PartnerApplicationRejectResponseSchema = z.object({ rejected: z.literal(true) });
