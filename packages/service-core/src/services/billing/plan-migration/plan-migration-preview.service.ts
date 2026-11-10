import { createHash } from 'node:crypto';
import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { billingOptions, eq, getDb, plans } from '@repo/db';
import {
    type PlanMigrationPreview,
    PlanMigrationPreviewRequestSchema,
    type PlanMigrationPreviewRow,
    PlanMigrationPreviewSchema
} from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service.js';
import { readLivePromos } from '../promo/live-promos.js';
import { composePromoAmount } from '../promo/promo-composition.js';
import { readAnchoredBillingOption } from '../read-anchored-billing-option.js';
import { computeApplicationDate } from './plan-migration-application-date.js';
import {
    assertPlanMigrationActionPermitted,
    planMigrationRejection
} from './plan-migration-authorization.js';
import { type PlanMigrationCohortRow, readPlanMigrationCohort } from './plan-migration-cohort.js';
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
    readonly sourcePlanVersionId: string;
    readonly actorId: string;
    readonly targetOption: { readonly amount: number } | undefined;
    readonly direction: 'UP' | 'DOWN';
    readonly announcedAt: Date;
    readonly noticeDays: number;
}): Promise<PlanMigrationPreviewRow> {
    const { row } = args;
    const option = await readAnchoredBillingOption({
        subscription: {
            planVersionId: args.sourcePlanVersionId,
            billingOptionId: row.billingOptionId
        }
    });
    if (!option)
        throw planMigrationRejection({
            reason: 'INVALID_PLAN_MIGRATION_INPUT',
            message: 'Anchored billing option is missing.'
        });
    const promos = await readLivePromos({
        subscriptionId: row.subscriptionId,
        at: args.announcedAt
    });
    const currentAmount = composePromoAmount({
        listAmountMinor: option.amount,
        promos: promos.map(({ discountKind, value }) => ({ discountKind, value }))
    }).amountMinor;
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
        currentAmount,
        newAmount: outcome === 'PENDIENTE' ? (args.targetOption?.amount ?? null) : null,
        currency: option.currency,
        losesPromo: promos.length > 0,
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
    const { source, target } = await validatePlanMigrationVersions({
        sourcePlanVersionId,
        targetPlanVersionId,
        verticals: args.verticals
    });
    const { direction } = await args.verticals.changeDirection({
        fromPlanVersionId: source.id,
        toPlanVersionId: target.id
    });
    const deadlines = await getCurrentBillingDeadlines();
    const noticeDays = deadlines.values['12'].noticeDays;
    const announcedAt = args.clock?.now() ?? new Date();
    const cohort = await readPlanMigrationCohort({ sourcePlanVersionId });
    const targetOptions = await getDb()
        .select({ cycle: billingOptions.cycle, amount: billingOptions.amount })
        .from(billingOptions)
        .where(eq(billingOptions.planVersionId, target.id));
    const rows: PlanMigrationPreviewRow[] = [];
    for (const cohortRow of cohort) {
        rows.push(
            await previewRow({
                row: cohortRow,
                sourcePlanVersionId,
                actorId: actor.id,
                targetOption: targetOptions.find((option) => option.cycle === cohortRow.cycle),
                direction,
                announcedAt,
                noticeDays
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
        direction,
        noticeDays,
        deadlineVersion: deadlines.version,
        announcedAt,
        rows,
        cohortFingerprint: planMigrationCohortFingerprint({ rows }),
        launchable: rows.some((row) => row.outcome !== 'EXCLUDED')
    });
}
