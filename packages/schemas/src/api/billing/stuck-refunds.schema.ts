import { z } from 'zod';

/** Pagination query for the stuck-refund list (HOS-2560). */
export const StuckRefundListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/**
 * The exit the list suggests for a stuck refund: «Retry with MP» or the remainder settlement from
 * the provider panel. Advisory: both actions revalidate.
 */
export const StuckRefundActionSchema = z.enum(['RETRY', 'SETTLE_REMAINDER']);

/**
 * One `CONFIRMED` refund stuck on a live provider call (one the provider accepted, or one with no
 * stored answer). These are the refunds the proposed list leaves out.
 */
export const StuckRefundSchema = z.object({
    refundId: z.string().uuid(),
    amountMinor: z.number().int().positive(),
    /** Null for a manual payment, which stores no currency. */
    currency: z.string().nullable(),
    createdAt: z.string().datetime(),
    payment: z.object({
        source: z.enum(['PAYMENT', 'MANUAL_PAYMENT']),
        id: z.string().uuid()
    }),
    providerCallCount: z.number().int().nonnegative(),
    /** Calls the provider has not answered yet. */
    unansweredCallCount: z.number().int().nonnegative(),
    /** When the oldest unanswered call was sent; null when every call has an answer. */
    oldestUnansweredAt: z.string().datetime().nullable(),
    /** Sum, in cents, of the calls the provider accepted. */
    acceptedAmountMinor: z.number().int().nonnegative(),
    /** Null when neither action can take the refund right now. */
    suggestedAction: StuckRefundActionSchema.nullable()
});

/** Paginated response of the stuck-refund list. */
export const StuckRefundListResponseSchema = z.object({
    items: z.array(StuckRefundSchema),
    pagination: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int()
    })
});

/** Parsed stuck-refund list query. */
export type StuckRefundListQuery = z.infer<typeof StuckRefundListQuerySchema>;
/** The suggested exit of a stuck refund. */
export type StuckRefundAction = z.infer<typeof StuckRefundActionSchema>;
/** One stuck refund. */
export type StuckRefund = z.infer<typeof StuckRefundSchema>;
/** Response of the stuck-refund list. */
export type StuckRefundListResponse = z.infer<typeof StuckRefundListResponseSchema>;
