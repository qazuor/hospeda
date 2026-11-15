import { z } from 'zod';

/** Path parameters for declining one open refund. */
export const RefundDeclineParamsSchema = z.object({ refundId: z.string().uuid() });

/** Explicit refusal of administrative action 13. */
export const RefundDeclineRequestSchema = z.object({ declined: z.literal(true) }).strict();

/** RF5 result after a person declines a refund. */
export const RefundDeclineResponseSchema = z.object({
    refundId: z.string().uuid(),
    status: z.literal('FAILED')
});

/** Parsed path parameters for refund decline. */
export type RefundDeclineParams = z.infer<typeof RefundDeclineParamsSchema>;
/** Parsed explicit decline body. */
export type RefundDeclineRequest = z.infer<typeof RefundDeclineRequestSchema>;
/** Response of administrative action 13 decline (RF5). */
export type RefundDeclineResponse = z.infer<typeof RefundDeclineResponseSchema>;
