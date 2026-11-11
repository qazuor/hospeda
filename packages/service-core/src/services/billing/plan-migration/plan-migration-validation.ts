import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { planCatalogModel } from '@repo/db';
import type { PlanMigrationReason } from '@repo/schemas';
import { planMigrationRejection } from './plan-migration-authorization.js';

/**
 * Apply the same source and destination rules before preview or launch.
 *
 * A retirement moves away from a plan that is still sellable. A price increase
 * moves inside the same plan, from a non-current version to its current and
 * sellable successor, so the retirement check never applies to it.
 */
export async function validatePlanMigrationVersions(args: {
    readonly sourcePlanVersionId: string;
    readonly targetPlanVersionId: string;
    readonly verticals: Pick<VerticalsForBilling, 'planPolicy' | 'changeDirection'>;
    readonly reason?: PlanMigrationReason;
}) {
    const [source, target] = await Promise.all([
        planCatalogModel.findPlanVersionSummary({ id: args.sourcePlanVersionId }),
        planCatalogModel.findPlanVersionSummary({ id: args.targetPlanVersionId })
    ]);
    if (!source || !target)
        throw planMigrationRejection({
            reason: 'PLAN_VERSION_NOT_FOUND',
            message: 'Plan version not found.'
        });
    if (source.id === target.id)
        throw planMigrationRejection({
            reason: 'PLAN_MIGRATION_SAME_VERSION',
            message: 'Source and target are the same version.'
        });
    if (source.vertical !== target.vertical)
        throw planMigrationRejection({
            reason: 'PLAN_MIGRATION_VERTICAL_MISMATCH',
            message: 'Plan versions have different verticals.'
        });
    if (args.reason === 'PRICE_INCREASE') {
        if (source.planId !== target.planId)
            throw planMigrationRejection({
                reason: 'PLAN_MIGRATION_INCREASE_OTHER_PLAN',
                message: 'An increase moves between versions of the same plan.'
            });
        const currentSource = await planCatalogModel.findCurrentPlanVersion({
            planId: source.planId
        });
        if (currentSource?.id === source.id)
            throw planMigrationRejection({
                reason: 'PLAN_MIGRATION_INCREASE_SOURCE_CURRENT',
                message: 'The source version is the current one; publish the new version first.'
            });
    } else {
        const currentSource = await planCatalogModel.findCurrentPlanVersion({
            planId: source.planId
        });
        if (
            !currentSource ||
            (await args.verticals.planPolicy({ planVersionId: currentSource.id })).sellable
        )
            throw planMigrationRejection({
                reason: 'PLAN_MIGRATION_SOURCE_NOT_RETIRED',
                message: 'Source plan is not retired.'
            });
    }
    const targetPolicy = await args.verticals.planPolicy({ planVersionId: target.id });
    if (!(targetPolicy.current && targetPolicy.sellable))
        throw planMigrationRejection({
            reason: 'PLAN_MIGRATION_TARGET_NOT_SELLABLE',
            message: 'Target version is not current and sellable.'
        });
    return { source, target };
}
