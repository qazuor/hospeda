import { z } from 'zod';

/** Path parameters for confirming one requested refund. */
export const RefundConfirmationParamsSchema = z.object({ refundId: z.string().uuid() });

/** Explicit confirmation required by administrative action 13. */
export const RefundConfirmationRequestSchema = z.object({ confirmed: z.literal(true) }).strict();

/** Provider call summary returned after refund confirmation. */
export const RefundConfirmationCallSchema = z.object({
    amount: z.number().int().positive(),
    providerRefundId: z.string().nullable(),
    answered: z.boolean()
});

/** RF2 outcomes that keep the refund confirmed or close it as charged back. */
export const RefundConfirmationOutcomeSchema = z.enum([
    'SENT',
    'NOT_ACCEPTED_KEPT_CONFIRMED',
    'PROVIDER_REJECTED_KEPT_CONFIRMED',
    'AWAITING_PROVIDER_ANSWER',
    'CHARGED_BACK'
]);

/** Response of administrative action 13 (RF2). */
export const RefundConfirmationResponseSchema = z.object({
    refundId: z.string().uuid(),
    status: z.enum(['CONFIRMED', 'FAILED']),
    outcome: RefundConfirmationOutcomeSchema,
    calls: z.array(RefundConfirmationCallSchema)
});

/** Parsed path parameters for refund confirmation. */
export type RefundConfirmationParams = z.infer<typeof RefundConfirmationParamsSchema>;
/** Parsed explicit confirmation body. */
export type RefundConfirmationRequest = z.infer<typeof RefundConfirmationRequestSchema>;
/** One provider call included in a refund confirmation response. */
export type RefundConfirmationCall = z.infer<typeof RefundConfirmationCallSchema>;
/** An RF2 result outcome. */
export type RefundConfirmationOutcome = z.infer<typeof RefundConfirmationOutcomeSchema>;
/** Response of administrative action 13 (RF2). */
export type RefundConfirmationResponse = z.infer<typeof RefundConfirmationResponseSchema>;
