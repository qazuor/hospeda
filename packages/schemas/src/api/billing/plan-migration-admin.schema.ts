import { z } from 'zod';
import { BillingCycleSchema } from '../../catalog/plan-publication.schema.js';

const Id = z.string().uuid();
const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Version = z.object({ id: Id, planId: Id, name: z.string(), vertical: z.string() });

/** Strict input for action 17 preview. */
export const PlanMigrationPreviewRequestSchema = z
    .object({
        sourcePlanVersionId: Id,
        targetPlanVersionId: Id
    })
    .strict();
/** Validated action 17 preview input. */
export type PlanMigrationPreviewRequest = z.infer<typeof PlanMigrationPreviewRequestSchema>;

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

/** Retired source versions and sellable current targets grouped by vertical. */
export const PlanMigrationOptionsSchema = z.object({
    sources: z.array(Version.extend({ customerCount: z.number().int().nonnegative() })),
    targets: z.record(z.string(), z.array(Version))
});
/** Validated selection options. */
export type PlanMigrationOptions = z.infer<typeof PlanMigrationOptionsSchema>;
