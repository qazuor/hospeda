import { z } from 'zod';

/** Path parameters for declining one open refund. */
export const RefundDeclineParamsSchema = z.object({ refundId: z.string().uuid() });

/** Explicit refusal of administrative action 13. */
export const RefundDeclineRequestSchema = z.object({ declined: z.literal(true) }).strict();

/**
 * What a person must check after declining a refund that was already `CONFIRMED`:
 * `VERIFY_NO_PROVIDER_REFUND` asks them to confirm in the provider's panel that no refund left
 * before settling it by hand (action 14), so a manual refund never duplicates a provider one.
 */
export const RefundDeclineWarningSchema = z.enum(['VERIFY_NO_PROVIDER_REFUND']);

/** RF5 result after a person declines a refund; `warning` only for a declined `CONFIRMED` one. */
export const RefundDeclineResponseSchema = z.object({
    refundId: z.string().uuid(),
    status: z.literal('FAILED'),
    warning: RefundDeclineWarningSchema.optional()
});

/** Parsed path parameters for refund decline. */
export type RefundDeclineParams = z.infer<typeof RefundDeclineParamsSchema>;
/** Parsed explicit decline body. */
export type RefundDeclineRequest = z.infer<typeof RefundDeclineRequestSchema>;
/** A warning carried by an action 13 decline. */
export type RefundDeclineWarning = z.infer<typeof RefundDeclineWarningSchema>;
/** Response of administrative action 13 decline (RF5). */
export type RefundDeclineResponse = z.infer<typeof RefundDeclineResponseSchema>;
