import { z } from 'zod';

/** One payment attached to an actionable reconciliation mark. */
export const ReconciliationMarkHungPaymentSchema = z.object({
    source: z.enum(['PAYMENT', 'MANUAL_PAYMENT']),
    paymentId: z.string().uuid(),
    amountMinor: z.number().int().nullable(),
    currency: z.string().nullable(),
    status: z.string(),
    hungAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable()
});

/** One open mark and the evidence needed to review its system proposal. */
export const ActionableReconciliationMarkSchema = z.object({
    markId: z.string().uuid(),
    version: z.number().int().min(1),
    reason: z.string(),
    reasonNumber: z.number().int().min(1).max(24),
    refundConfirmation: z.boolean(),
    defaultProposal: z.enum(['REFUND', 'REFUND_DIFFERENCE', 'NO_REFUND', 'NONE']),
    openedAt: z.string().datetime(),
    subject: z.object({
        kind: z.enum(['SUBSCRIPTION', 'ADDON_INSTANCE']),
        id: z.string().uuid(),
        status: z.string().nullable()
    }),
    payments: z.array(ReconciliationMarkHungPaymentSchema),
    paymentCount: z.number().int().nonnegative(),
    totalAmount: z.array(z.object({ currency: z.string(), amountMinor: z.number().int() })),
    unknownAmountCount: z.number().int().nonnegative(),
    eventLink: z.object({ markId: z.string().uuid() }).nullable()
});

/** A provider or manual payment explicitly resolved while lifting a mark. */
export const ReconciliationMarkPaymentRefSchema = z
    .object({ source: z.enum(['PAYMENT', 'MANUAL_PAYMENT']), paymentId: z.string().uuid() })
    .strict();

/** Request body for administrative action 7 (ACC:7, S15). */
export const ReconciliationMarkLiftRequestSchema = z
    .object({
        expectedVersion: z.number().int().min(1),
        resolveWithoutRefund: z.array(ReconciliationMarkPaymentRefSchema).max(100).default([]),
        note: z.string().trim().min(1).max(2000).optional()
    })
    .strict()
    .refine(
        ({ resolveWithoutRefund }) =>
            new Set(resolveWithoutRefund.map(({ source, paymentId }) => `${source}:${paymentId}`))
                .size === resolveWithoutRefund.length,
        { message: 'Payment references must be unique', path: ['resolveWithoutRefund'] }
    );

/** Successful response of administrative action 7 (ACC:7, S15). */
export const ReconciliationMarkLiftResponseSchema = z.object({
    markId: z.string().uuid(),
    reason: z.string(),
    liftedAt: z.string().datetime(),
    liftedBy: z.string().uuid(),
    version: z.number().int().min(2),
    resolvedWithoutRefund: z.array(ReconciliationMarkPaymentRefSchema)
});

/** Parsed body of administrative action 7. */
export type ReconciliationMarkLiftRequest = z.infer<typeof ReconciliationMarkLiftRequestSchema>;

/** Response of administrative action 7. */
export type ReconciliationMarkLiftResponse = z.infer<typeof ReconciliationMarkLiftResponseSchema>;

/** Standard pagination query for the actionable mark list. */
export const ReconciliationMarkListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/** Path parameters for reading a mark's critical events. */
export const ReconciliationMarkParamsSchema = z.object({ markId: z.string().uuid() });

/** Paginated response returned by the admin list route. */
export const ReconciliationMarkListResponseSchema = z.object({
    items: z.array(ActionableReconciliationMarkSchema),
    pagination: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int()
    })
});

/** Mark and critical event details used by the reconciliation panel. */
export const ReconciliationMarkEventsResponseSchema = z.object({
    mark: z.object({
        markId: z.string().uuid(),
        reason: z.string(),
        reasonNumber: z.number().int(),
        openedAt: z.string().datetime(),
        liftedAt: z.string().datetime().nullable(),
        subject: z.object({
            kind: z.enum(['SUBSCRIPTION', 'ADDON_INSTANCE']),
            id: z.string().uuid()
        })
    }),
    events: z.array(
        z.object({
            eventId: z.string().uuid(),
            occurredAt: z.string().datetime(),
            actorType: z.string(),
            actorId: z.string().nullable(),
            correlationId: z.string(),
            outcome: z.string().nullable(),
            failedCondition: z
                .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
                .nullable(),
            conditionRecorded: z.boolean(),
            changes: z.array(
                z.object({
                    field: z.string(),
                    old: z.unknown().optional(),
                    new: z.unknown().optional()
                })
            )
        })
    )
});
