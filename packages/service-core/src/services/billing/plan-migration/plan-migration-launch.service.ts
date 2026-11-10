import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    and,
    billingDeadlineVersions,
    billingOptions,
    desc,
    eq,
    getDb,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    subscriptions
} from '@repo/db';
import {
    LaunchPlanMigrationRequestSchema,
    type PlanMigrationLaunchResponse,
    PlanMigrationLaunchResponseSchema
} from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause.js';
import { computeApplicationDate } from './plan-migration-application-date.js';
import {
    assertPlanMigrationActionPermitted,
    planMigrationRejection
} from './plan-migration-authorization.js';
import {
    PLAN_MIGRATION_COHORT_STATUSES,
    readPlanMigrationCohort
} from './plan-migration-cohort.js';
import { planMigrationCohortFingerprint } from './plan-migration-preview.service.js';
import { validatePlanMigrationVersions } from './plan-migration-validation.js';

/** Map only the database constraints owned by action 17. */
export function mapPlanMigrationWriteError(args: { readonly error: unknown }): never {
    if (args.error instanceof ServiceError) throw args.error;
    const cause = extractPostgresErrorCause(args.error);
    if (
        cause?.code === '23505' &&
        (cause.constraint === 'uq_plan_migration_subscription_one_pending' ||
            cause.constraint === 'uq_plan_migration_subscription_pair')
    )
        throw planMigrationRejection({
            reason: 'PLAN_MIGRATION_COHORT_CHANGED',
            message: 'The cohort changed since preview.'
        });
    if (cause?.code === '23514' && cause.constraint?.startsWith('ck_plan_migration_'))
        throw planMigrationRejection({
            reason: 'INVALID_PLAN_MIGRATION_INPUT',
            message: 'Invalid plan migration row.'
        });
    throw args.error;
}

/** Announce one retirement migration and its customer rows atomically. */
export async function launchPlanMigration(args: {
    readonly actor?: Actor;
    readonly input: unknown;
    readonly verticals: Pick<VerticalsForBilling, 'planPolicy' | 'changeDirection'>;
    readonly clock?: { readonly now: () => Date };
}): Promise<PlanMigrationLaunchResponse> {
    assertPlanMigrationActionPermitted({ actor: args.actor });
    const parsed = LaunchPlanMigrationRequestSchema.safeParse(args.input);
    if (!parsed.success)
        throw planMigrationRejection({
            reason: 'INVALID_PLAN_MIGRATION_INPUT',
            message: 'Invalid plan migration input.'
        });
    const actor = args.actor;
    if (!actor)
        throw planMigrationRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    const { sourcePlanVersionId, targetPlanVersionId, cohortFingerprint } = parsed.data;
    const { source } = await validatePlanMigrationVersions({
        sourcePlanVersionId,
        targetPlanVersionId,
        verticals: args.verticals
    });
    try {
        return await getDb().transaction(async (tx) => {
            await tx
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.class, 'PRINCIPAL'),
                        eq(subscriptions.planVersionId, sourcePlanVersionId),
                        inArray(subscriptions.status, [...PLAN_MIGRATION_COHORT_STATUSES])
                    )
                )
                .orderBy(subscriptions.id)
                .for('update');
            const cohort = await readPlanMigrationCohort({ sourcePlanVersionId, tx });
            const targetOptions = await tx
                .select({ cycle: billingOptions.cycle })
                .from(billingOptions)
                .where(eq(billingOptions.planVersionId, targetPlanVersionId));
            const classified = cohort.map((row) => {
                const excludedReason =
                    row.userId === actor.id
                        ? ('ACTOR_IS_SUBJECT' as const)
                        : row.alreadyInMigration
                          ? ('ALREADY_IN_MIGRATION' as const)
                          : null;
                const outcome = excludedReason
                    ? ('EXCLUDED' as const)
                    : targetOptions.some((option) => option.cycle === row.cycle)
                      ? ('PENDIENTE' as const)
                      : ('PARA_RESOLVER' as const);
                return { row, outcome, excludedReason };
            });
            if (
                planMigrationCohortFingerprint({
                    rows: classified.map(({ row, outcome }) => ({
                        subscriptionId: row.subscriptionId,
                        outcome
                    }))
                }) !== cohortFingerprint
            )
                throw planMigrationRejection({
                    reason: 'PLAN_MIGRATION_COHORT_CHANGED',
                    message: 'The cohort changed since preview.'
                });
            const included = classified.filter((entry) => entry.outcome !== 'EXCLUDED');
            if (included.length === 0)
                throw planMigrationRejection({
                    reason: 'PLAN_MIGRATION_EMPTY_COHORT',
                    message: 'No customers remain in the cohort.'
                });
            const [deadlines] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!deadlines) throw new Error('Current billing deadlines missing');
            const announcedAt = args.clock?.now() ?? new Date();
            const noticeDays = deadlines.values['12'].noticeDays;
            const [migration] = await tx
                .insert(planMigrations)
                .values({
                    vertical: source.vertical,
                    sourcePlanVersionId,
                    targetPlanVersionId,
                    reason: 'RETIREMENT',
                    announcedAt,
                    noticeDays,
                    deadlineVersion: deadlines.version,
                    signedBy: actor.id
                })
                .returning();
            if (!migration) throw new Error('Plan migration insert returned no row');
            const rows = included.map(({ row, outcome }) => ({
                subscriptionId: row.subscriptionId,
                outcome: outcome as 'PENDIENTE' | 'PARA_RESOLVER',
                applicationDate: computeApplicationDate({
                    nextChargeAt: row.nextChargeAt,
                    cycle: row.cycle,
                    announcedAt,
                    noticeDays
                })
            }));
            await tx.insert(planMigrationSubscriptions).values(
                rows.map((row) => ({
                    planMigrationId: migration.id,
                    subscriptionId: row.subscriptionId,
                    status: row.outcome,
                    applicationDate: new Date(`${row.applicationDate}T12:00:00.000Z`)
                }))
            );
            return PlanMigrationLaunchResponseSchema.parse({
                planMigrationId: migration.id,
                announcedAt,
                deadlineVersion: deadlines.version,
                noticeDays,
                rows,
                excluded: classified
                    .filter((entry) => entry.excludedReason !== null)
                    .map((entry) => ({
                        subscriptionId: entry.row.subscriptionId,
                        excludedReason: entry.excludedReason
                    }))
            });
        });
    } catch (error) {
        mapPlanMigrationWriteError({ error });
    }
}
