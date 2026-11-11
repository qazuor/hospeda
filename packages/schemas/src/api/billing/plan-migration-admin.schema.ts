import { z } from 'zod';
import { BillingCycleSchema } from '../../catalog/plan-publication.schema.js';

const Id = z.string().uuid();
const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Version = z.object({ id: Id, planId: Id, name: z.string(), vertical: z.string() });

/** Why an admin announces a migration: a retired plan or a price increase. */
export const PlanMigrationReasonSchema = z.enum(['RETIREMENT', 'PRICE_INCREASE']);
/** Validated migration reason. */
export type PlanMigrationReason = z.infer<typeof PlanMigrationReasonSchema>;

/** Strict input for action 17 preview. */
export const PlanMigrationPreviewRequestSchema = z
    .object({
        sourcePlanVersionId: Id,
        targetPlanVersionId: Id,
        reason: PlanMigrationReasonSchema.optional()
    })
    .strict();
/** Raw action 17 preview input; the service defaults an absent reason to a retirement. */
export type PlanMigrationPreviewRequest = z.input<typeof PlanMigrationPreviewRequestSchema>;

/** Strict confirmation of the cohort shown in action 17 preview. */
export const LaunchPlanMigrationRequestSchema = PlanMigrationPreviewRequestSchema.extend({
    cohortFingerprint: z.string()
}).strict();
/** Raw action 17 launch input; the service defaults an absent reason to a retirement. */
export type LaunchPlanMigrationRequest = z.input<typeof LaunchPlanMigrationRequestSchema>;

/** One affected or excluded subscription. */
export const PlanMigrationPreviewRowSchema = z.object({
    subscriptionId: Id,
    userId: Id,
    customerName: z.string().nullable(),
    customerEmail: z.string().email(),
    status: z.enum(['PENDING_AUTHORIZATION', 'ACTIVE', 'GRACE_PERIOD', 'PAUSED', 'SUSPENDED']),
    cycle: BillingCycleSchema,
    direction: z.enum(['UP', 'DOWN']).nullable(),
    currentAmount: z.number().int().nonnegative(),
    newAmount: z.number().int().nonnegative().nullable(),
    currency: z.string().length(3),
    losesPromo: z.boolean(),
    applicationDate: LocalDate.nullable(),
    waits: z.boolean(),
    outcome: z.enum(['PENDIENTE', 'PARA_RESOLVER', 'EXCLUDED']),
    excludedReason: z.enum(['ACTOR_IS_SUBJECT', 'ALREADY_IN_MIGRATION']).nullable()
});
/** Validated preview row. */
export type PlanMigrationPreviewRow = z.infer<typeof PlanMigrationPreviewRowSchema>;

/** Read-only action 17 preview and its cohort fingerprint. */
export const PlanMigrationPreviewSchema = z.object({
    source: Version,
    target: Version,
    reason: PlanMigrationReasonSchema.default('RETIREMENT'),
    direction: z.enum(['UP', 'DOWN']),
    noticeDays: z.number().int().nonnegative(),
    deadlineVersion: z.number().int().positive(),
    announcedAt: z.date(),
    rows: z.array(PlanMigrationPreviewRowSchema),
    cohortFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    launchable: z.boolean()
});
/** Validated preview response. */
export type PlanMigrationPreview = z.infer<typeof PlanMigrationPreviewSchema>;

/** Persisted migration and each included or excluded customer. */
export const PlanMigrationLaunchResponseSchema = z.object({
    planMigrationId: Id,
    reason: PlanMigrationReasonSchema.default('RETIREMENT'),
    announcedAt: z.date(),
    deadlineVersion: z.number().int().positive(),
    noticeDays: z.number().int().nonnegative(),
    rows: z.array(
        z.object({
            subscriptionId: Id,
            outcome: z.enum(['PENDIENTE', 'PARA_RESOLVER']),
            applicationDate: LocalDate
        })
    ),
    excluded: z.array(
        z.object({
            subscriptionId: Id,
            excludedReason: z.enum(['ACTOR_IS_SUBJECT', 'ALREADY_IN_MIGRATION'])
        })
    )
});
/** Validated action 17 launch result. */
export type PlanMigrationLaunchResponse = z.infer<typeof PlanMigrationLaunchResponseSchema>;

/** Strict action 17 cancellation input. */
export const PlanMigrationCancelInputSchema = z.strictObject({ planMigrationId: Id });
/** Validated cancellation input. */
export type PlanMigrationCancelInput = z.infer<typeof PlanMigrationCancelInputSchema>;

/** Cancellation timestamp and exact scope outcomes. */
export const PlanMigrationCancelResultSchema = z.strictObject({
    planMigrationId: Id,
    cancelledAt: z.date(),
    rows: z.strictObject({
        cancelled: z.number().int().nonnegative(),
        alreadyStarted: z.number().int().nonnegative(),
        untouched: z.number().int().nonnegative()
    })
});
/** Validated cancellation result. */
export type PlanMigrationCancelResult = z.infer<typeof PlanMigrationCancelResultSchema>;

/** Retired source versions and sellable current targets grouped by vertical. */
export const PlanMigrationOptionsSchema = z.object({
    sources: z.array(Version.extend({ customerCount: z.number().int().nonnegative() })),
    targets: z.record(z.string(), z.array(Version)),
    increases: z
        .array(
            z.object({
                source: Version.extend({ customerCount: z.number().int().nonnegative() }),
                target: Version
            })
        )
        .default([])
});
/** Validated selection options. */
export type PlanMigrationOptions = z.infer<typeof PlanMigrationOptionsSchema>;

/** Query parameters for the paginated action 17 migration list. */
export const PlanMigrationListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});
/** Validated migration list query. */
export type PlanMigrationListQuery = z.infer<typeof PlanMigrationListQuerySchema>;

const PlanMigrationStatusSchema = z.enum([
    'PENDIENTE',
    'PARA_RESOLVER',
    'APLICADA',
    'FUERA',
    'CANCELADA'
]);
const PlanMigrationCountsSchema = z.strictObject({
    PENDIENTE: z.number().int().nonnegative(),
    PARA_RESOLVER: z.number().int().nonnegative(),
    APLICADA: z.number().int().nonnegative(),
    FUERA: z.number().int().nonnegative(),
    CANCELADA: z.number().int().nonnegative()
});

/** One migration and the complete count of its scope states. */
export const PlanMigrationListItemSchema = z.strictObject({
    id: Id,
    reason: PlanMigrationReasonSchema,
    sourcePlanVersionId: Id,
    targetPlanVersionId: Id,
    sourcePlanName: z.string(),
    targetPlanName: z.string(),
    announcedAt: z.date(),
    cancelledAt: z.date().nullable(),
    counts: PlanMigrationCountsSchema
});
/** Validated migration list item. */
export type PlanMigrationListItem = z.infer<typeof PlanMigrationListItemSchema>;

/** Paginated migration list with a stable total. */
export const PlanMigrationListSchema = z.strictObject({
    items: z.array(PlanMigrationListItemSchema),
    pagination: z.strictObject({
        page: z.number().int().positive(),
        pageSize: z.number().int().min(1).max(100),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative()
    })
});
/** Validated migration list response. */
export type PlanMigrationList = z.infer<typeof PlanMigrationListSchema>;

/** A scope row; only unresolved rows have an age since announcement. */
export const PlanMigrationDetailRowSchema = z
    .strictObject({
        id: Id,
        subscriptionId: Id,
        ownerUserId: Id,
        status: PlanMigrationStatusSchema,
        outReason: z.enum(['CAMBIO_DE_PLAN', 'SE_DIO_DE_BAJA', 'TERMINO']).nullable(),
        applicationDate: LocalDate.nullable(),
        appliedAt: z.date().nullable(),
        ageDays: z.number().int().nullable()
    })
    .superRefine((row, ctx) => {
        if ((row.status === 'PARA_RESOLVER') !== (row.ageDays !== null))
            ctx.addIssue({
                code: 'custom',
                path: ['ageDays'],
                message: 'Age must match unresolved status'
            });
        if (row.status === 'PARA_RESOLVER' && row.applicationDate !== null)
            ctx.addIssue({
                code: 'custom',
                path: ['applicationDate'],
                message: 'Unresolved rows have no date'
            });
    });
/** Validated scope row. */
export type PlanMigrationDetailRow = z.infer<typeof PlanMigrationDetailRowSchema>;

/** Migration detail with rows ordered by state and id. */
export const PlanMigrationDetailSchema = PlanMigrationListItemSchema.extend({
    noticeDays: z.number().int().nonnegative(),
    deadlineVersion: z.number().int().positive(),
    rows: z.array(PlanMigrationDetailRowSchema)
}).strict();
/** Validated migration detail response. */
export type PlanMigrationDetail = z.infer<typeof PlanMigrationDetailSchema>;

/**
 * One plan version nobody can buy anymore, with the live subscriptions still
 * anchored to it. Being retired is derived from the catalog policy, never a
 * stored state on the version.
 */
export const RetiredPlanVersionSchema = z.strictObject({
    id: Id,
    planId: Id,
    name: z.string(),
    vertical: z.string(),
    liveSubscriptionCount: z.number().int().positive()
});
/** Validated retired plan version. */
export type RetiredPlanVersion = z.infer<typeof RetiredPlanVersionSchema>;

/** Retired plan versions ordered by live customers, the most anchored first. */
export const RetiredPlanVersionListSchema = z.strictObject({
    items: z.array(RetiredPlanVersionSchema)
});
/** Validated retired plan version list. */
export type RetiredPlanVersionList = z.infer<typeof RetiredPlanVersionListSchema>;
