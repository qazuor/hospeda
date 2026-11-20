import { z } from 'zod';

/** Pagination query for the proposed-refund list (administrative action 13). */
export const ProposedRefundListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/** The reconciliation mark behind a proposed refund: the one that hangs the refunded payment. */
export const ProposedRefundMarkSchema = z.object({
    markId: z.string().uuid(),
    reason: z.string(),
    reasonNumber: z.number().int().min(1).max(24),
    openedAt: z.string().datetime(),
    /** Null while the mark is open. */
    liftedAt: z.string().datetime().nullable(),
    subject: z.object({
        kind: z.enum(['SUBSCRIPTION', 'ADDON_INSTANCE']),
        id: z.string().uuid()
    })
});

/**
 * One refund a person proposed from a reconciliation mark and that still awaits action 13: either
 * `REQUESTED`, or `CONFIRMED` without a single provider call (so declining it cannot lose money
 * the provider already moved, but the panel must be checked first).
 */
export const ProposedRefundSchema = z.object({
    refundId: z.string().uuid(),
    status: z.enum(['REQUESTED', 'CONFIRMED']),
    amountMinor: z.number().int().positive(),
    /** Null for a manual payment, which stores no currency. */
    currency: z.string().nullable(),
    requestedAt: z.string().datetime(),
    payment: z.object({
        source: z.enum(['PAYMENT', 'MANUAL_PAYMENT']),
        id: z.string().uuid()
    }),
    /** Number of provider calls already recorded; always 0 for the listed refunds. */
    providerCallCount: z.number().int().nonnegative(),
    /** True when a page-charge mark holds the payment: the server refuses to decline it (HOS-2179 D1). */
    closesHeldCharge: z.boolean(),
    marks: z.array(ProposedRefundMarkSchema)
});

/** Paginated response of the proposed-refund list. */
export const ProposedRefundListResponseSchema = z.object({
    items: z.array(ProposedRefundSchema),
    pagination: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int()
    })
});

/** Parsed proposed-refund list query. */
export type ProposedRefundListQuery = z.infer<typeof ProposedRefundListQuerySchema>;
/** The mark behind a proposed refund. */
export type ProposedRefundMark = z.infer<typeof ProposedRefundMarkSchema>;
/** One proposed refund awaiting action 13. */
export type ProposedRefund = z.infer<typeof ProposedRefundSchema>;
/** Response of the proposed-refund list. */
export type ProposedRefundListResponse = z.infer<typeof ProposedRefundListResponseSchema>;
