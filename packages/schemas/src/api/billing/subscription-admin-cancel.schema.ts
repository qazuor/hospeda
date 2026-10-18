import { z } from 'zod';
import type {
    SubscriptionCancellationParamsSchema,
    SubscriptionCancellationPreviewResponseSchema
} from './subscription-self-cancel.schema.js';

/** Origins the admin may confirm before cancelling a subscription. */
export const AdminSubscriptionCancellationExpectedOriginSchema = z.enum([
    'ACTIVE',
    'GRACE_PERIOD',
    'SUSPENDED'
]);

/** Request body for administrative cancellation without a refund. */
export const AdminSubscriptionCancellationRequestSchema = z.strictObject({
    expectedOrigin: AdminSubscriptionCancellationExpectedOriginSchema,
    note: z.string().trim().min(1).max(2000).optional()
});

/** Result of administrative cancellation without a refund. */
export const AdminSubscriptionCancellationResponseSchema = z.object({
    subscriptionId: z.string().uuid(),
    outcome: z.enum(['SCHEDULED', 'ALREADY_SCHEDULED', 'CANCELLED', 'ALREADY_CANCELLED']),
    transition: z.enum(['S11', 'S23', 'S24']).nullable(),
    serviceEndsAt: z.string().datetime().nullable(),
    cancelCall: z
        .enum(['SENT', 'NOT_NEEDED', 'NOTICE_PENDING', 'FAILED', 'NOT_APPLICABLE'])
        .optional(),
    escalated: z.enum(['NO_RECIPIENT', 'DELIVERY_EXHAUSTED']).optional()
});

/** Parsed request for administrative cancellation without a refund. */
export type AdminSubscriptionCancellationRequest = z.infer<
    typeof AdminSubscriptionCancellationRequestSchema
>;
/** Parsed response for administrative cancellation without a refund. */
export type AdminSubscriptionCancellationResponse = z.infer<
    typeof AdminSubscriptionCancellationResponseSchema
>;
/** Reused cancellation preview response shape. */
export type AdminSubscriptionCancellationPreviewResponse = z.infer<
    typeof SubscriptionCancellationPreviewResponseSchema
>;
/** Reused cancellation route parameters. */
export type AdminSubscriptionCancellationParams = z.infer<
    typeof SubscriptionCancellationParamsSchema
>;
