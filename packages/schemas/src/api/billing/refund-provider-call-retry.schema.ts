import { z } from 'zod';

/** Path parameters for retrying the unanswered provider calls of one refund (HOS-2516). */
export const RefundProviderCallRetryParamsSchema = z.object({ refundId: z.string().uuid() });

/** Explicit confirmation required before a refund call is sent to the provider again. */
export const RefundProviderCallRetryRequestSchema = z
    .object({ confirmed: z.literal(true) })
    .strict();

/** What the provider answered to one resent call, under the call's original idempotency key. */
export const RefundProviderCallRetryCallOutcomeSchema = z.enum([
    'SENT',
    'AWAITING_PROVIDER_ANSWER',
    'PROVIDER_KEY_CONFLICT',
    'PROVIDER_REJECTED_FAILED'
]);

/**
 * What RF3 read right after the resend. `null` when RF3 did not run (a call is still unanswered,
 * the refund failed) or its charge read failed: a later provider notice runs it.
 */
export const RefundProviderCallRetryExecutionSchema = z
    .enum([
        'EXECUTED',
        'NOT_CONFIRMED',
        'NOT_APPLICABLE',
        'AWAITING_PROVIDER_ANSWER',
        'NOTHING_ACCEPTED',
        'NOT_ACCREDITED_KEPT_CONFIRMED',
        'REFUND_STATE_CHANGED'
    ])
    .nullable();

/** Response of the retry: one entry per resent call, the refund's status and RF3's outcome. */
export const RefundProviderCallRetryResponseSchema = z.object({
    refundId: z.string().uuid(),
    status: z.enum(['CONFIRMED', 'EXECUTED', 'FAILED']),
    calls: z.array(
        z.object({
            idempotencyKey: z.string().min(1),
            outcome: RefundProviderCallRetryCallOutcomeSchema
        })
    ),
    execution: RefundProviderCallRetryExecutionSchema
});

/** Parsed path parameters of the retry. */
export type RefundProviderCallRetryParams = z.infer<typeof RefundProviderCallRetryParamsSchema>;
/** Parsed explicit confirmation body of the retry. */
export type RefundProviderCallRetryRequest = z.infer<typeof RefundProviderCallRetryRequestSchema>;
/** One resent call's outcome. */
export type RefundProviderCallRetryCallOutcome = z.infer<
    typeof RefundProviderCallRetryCallOutcomeSchema
>;
/** RF3's outcome after the retry, or null. */
export type RefundProviderCallRetryExecution = z.infer<
    typeof RefundProviderCallRetryExecutionSchema
>;
/** Response of the retry. */
export type RefundProviderCallRetryResponse = z.infer<typeof RefundProviderCallRetryResponseSchema>;
