import { createHash } from 'node:crypto';
import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { billingOptions, eq, getDb, plans } from '@repo/db';
import {
    type PlanMigrationPreview,
    PlanMigrationPreviewRequestSchema,
    type PlanMigrationPreviewRow,
    PlanMigrationPreviewSchema,
    type PlanMigrationReason
} from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service.js';
import { computeApplicationDate } from './plan-migration-application-date.js';
import {
    assertPlanMigrationActionPermitted,
    planMigrationRejection
} from './plan-migration-authorization.js';
import { type PlanMigrationCohortRow, readPlanMigrationCohort } from './plan-migration-cohort.js';
import { planMigrationRowPricing } from './plan-migration-pricing.js';
import { validatePlanMigrationVersions } from './plan-migration-validation.js';

/** Fingerprint the exact subscription and outcome pairs shown to the actor. */
export function planMigrationCohortFingerprint(args: {
    readonly rows: readonly Pick<PlanMigrationPreviewRow, 'subscriptionId' | 'outcome'>[];
}): string {
    const pairs = [...args.rows]
        .sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId))
        .map((row) => `${row.subscriptionId}:${row.outcome}`);
    return createHash('sha256').update(pairs.join('\n')).digest('hex');
}

async function previewRow(args: {
    readonly row: PlanMigrationCohortRow;
    readonly targetPlanVersionId: string;
    readonly actorId: string;
    readonly targetOption: { readonly amount: number } | undefined;
    readonly direction: 'UP' | 'DOWN';
    readonly announcedAt: Date;
    readonly noticeDays: number;
    readonly reason: PlanMigrationReason;
}): Promise<PlanMigrationPreviewRow> {
    const { row } = args;
    const pricing = await planMigrationRowPricing({
        row,
        targetPlanVersionId: args.targetPlanVersionId,
        at: args.announcedAt,
        reason: args.reason
    });
    const excludedReason =
        row.userId === args.actorId
            ? 'ACTOR_IS_SUBJECT'
            : row.alreadyInMigration
              ? 'ALREADY_IN_MIGRATION'
              : null;
    const outcome = excludedReason ? 'EXCLUDED' : args.targetOption ? 'PENDIENTE' : 'PARA_RESOLVER';
    return {
        subscriptionId: row.subscriptionId,
        userId: row.userId,
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        status: row.status,
        cycle: row.cycle,
        direction: excludedReason ? null : args.direction,
        currentAmount: pricing.currentAmount,
        newAmount: outcome === 'PENDIENTE' ? pricing.newAmount : null,
        currency: pricing.currency,
        losesPromo: pricing.losesPromo,
        applicationDate:
            outcome === 'PENDIENTE'
                ? computeApplicationDate({
                      nextChargeAt: row.nextChargeAt,
                      cycle: row.cycle,
                      announcedAt: args.announcedAt,
                      noticeDays: args.noticeDays
                  })
                : null,
        waits: row.status !== 'ACTIVE',
        outcome,
        excludedReason
    };
}

/** Preview action 17 without writing migration or subscription state. */
export async function previewPlanMigration(args: {
    readonly actor?: Actor;
    readonly input: unknown;
    readonly verticals: Pick<VerticalsForBilling, 'planPolicy' | 'changeDirection'>;
    readonly clock?: { readonly now: () => Date };
}): Promise<PlanMigrationPreview> {
    assertPlanMigrationActionPermitted({ actor: args.actor });
    const actor = args.actor;
    if (!actor)
        throw planMigrationRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    const parsed = PlanMigrationPreviewRequestSchema.safeParse(args.input);
    if (!parsed.success)
        throw planMigrationRejection({
            reason: 'INVALID_PLAN_MIGRATION_INPUT',
            message: 'Invalid plan migration input.'
        });
    const { sourcePlanVersionId, targetPlanVersionId } = parsed.data;
    const reason: PlanMigrationReason = parsed.data.reason ?? 'RETIREMENT';
    const { source, target } = await validatePlanMigrationVersions({
        sourcePlanVersionId,
        targetPlanVersionId,
        verticals: args.verticals,
        reason
    });
    const direction =
        reason === 'PRICE_INCREASE'
            ? ('UP' as const)
            : (
                  await args.verticals.changeDirection({
                      fromPlanVersionId: source.id,
                      toPlanVersionId: target.id
                  })
              ).direction;
    const deadlines = await getCurrentBillingDeadlines();
    const noticeDays = deadlines.values[reason === 'PRICE_INCREASE' ? '11' : '12'].noticeDays;
    const announcedAt = args.clock?.now() ?? new Date();
    const cohort = await readPlanMigrationCohort({ sourcePlanVersionId });
    const targetOptions = await getDb()
        .select({ cycle: billingOptions.cycle, amount: billingOptions.amount })
        .from(billingOptions)
        .where(eq(billingOptions.planVersionId, target.id));
    if (
        reason === 'PRICE_INCREASE' &&
        cohort.some(
            (cohortRow) =>
                cohortRow.userId !== actor.id &&
                !cohortRow.alreadyInMigration &&
                !targetOptions.some((option) => option.cycle === cohortRow.cycle)
        )
    )
        throw planMigrationRejection({
            reason: 'PLAN_MIGRATION_INCREASE_CYCLE_MISSING',
            message: 'The new version does not offer every customer cycle.'
        });
    const rows: PlanMigrationPreviewRow[] = [];
    for (const cohortRow of cohort) {
        rows.push(
            await previewRow({
                row: cohortRow,
                targetPlanVersionId,
                actorId: actor.id,
                targetOption: targetOptions.find((option) => option.cycle === cohortRow.cycle),
                direction,
                announcedAt,
                noticeDays,
                reason
            })
        );
    }
    const db = getDb();
    const [sourcePlan, targetPlan] = await Promise.all([
        db.select({ name: plans.name }).from(plans).where(eq(plans.id, source.planId)).limit(1),
        db.select({ name: plans.name }).from(plans).where(eq(plans.id, target.planId)).limit(1)
    ]);
    return PlanMigrationPreviewSchema.parse({
        source: {
            id: source.id,
            planId: source.planId,
            name: sourcePlan[0]?.name ?? '',
            vertical: source.vertical
        },
        target: {
            id: target.id,
            planId: target.planId,
            name: targetPlan[0]?.name ?? '',
            vertical: target.vertical
        },
        reason,
        direction,
        noticeDays,
        deadlineVersion: deadlines.version,
        announcedAt,
        rows,
        cohortFingerprint: planMigrationCohortFingerprint({ rows }),
        launchable: rows.some((row) => row.outcome !== 'EXCLUDED')
    });
}
