import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    and,
    asc,
    count,
    eq,
    getDb,
    inArray,
    planCatalogModel,
    plans,
    planVersions,
    subscriptions
} from '@repo/db';
import { type PlanMigrationOptions, PlanMigrationOptionsSchema } from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import { assertPlanMigrationActionPermitted } from './plan-migration-authorization.js';
import { PLAN_MIGRATION_COHORT_STATUSES } from './plan-migration-cohort.js';

/** List eligible source versions and target versions for action 17. */
export async function listPlanMigrationOptions(args: {
    readonly actor?: Actor;
    readonly verticals: Pick<VerticalsForBilling, 'planPolicy'>;
}): Promise<PlanMigrationOptions> {
    assertPlanMigrationActionPermitted({ actor: args.actor });
    const db = getDb();
    const candidates = await db
        .select({
            id: planVersions.id,
            planId: plans.id,
            name: plans.name,
            vertical: planVersions.vertical,
            customerCount: count(subscriptions.id)
        })
        .from(subscriptions)
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, [...PLAN_MIGRATION_COHORT_STATUSES])
            )
        )
        .groupBy(planVersions.id, plans.id)
        .orderBy(asc(planVersions.id));
    const sources = [];
    for (const candidate of candidates) {
        const current = await planCatalogModel.findCurrentPlanVersion({ planId: candidate.planId });
        if (current && !(await args.verticals.planPolicy({ planVersionId: current.id })).sellable) {
            sources.push(candidate);
        }
    }
    const currentVersions = await db
        .select({
            id: planVersions.id,
            planId: plans.id,
            name: plans.name,
            vertical: planVersions.vertical
        })
        .from(planVersions)
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(eq(planVersions.current, true))
        .orderBy(asc(planVersions.id));
    const targets: Record<string, typeof currentVersions> = {};
    for (const version of currentVersions) {
        const policy = await args.verticals.planPolicy({ planVersionId: version.id });
        if (policy.current && policy.sellable) {
            targets[version.vertical] = [...(targets[version.vertical] ?? []), version];
        }
    }
    return PlanMigrationOptionsSchema.parse({ sources, targets });
}
