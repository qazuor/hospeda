import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { planCatalogModel } from '@repo/db';
import { planMigrationRejection } from './plan-migration-authorization.js';

/** Apply the same source and destination rules before preview or launch. */
export async function validatePlanMigrationVersions(args: {
    readonly sourcePlanVersionId: string;
    readonly targetPlanVersionId: string;
    readonly verticals: Pick<VerticalsForBilling, 'planPolicy' | 'changeDirection'>;
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
    const currentSource = await planCatalogModel.findCurrentPlanVersion({ planId: source.planId });
    if (
        !currentSource ||
        (await args.verticals.planPolicy({ planVersionId: currentSource.id })).sellable
    )
        throw planMigrationRejection({
            reason: 'PLAN_MIGRATION_SOURCE_NOT_RETIRED',
            message: 'Source plan is not retired.'
        });
    const targetPolicy = await args.verticals.planPolicy({ planVersionId: target.id });
    if (!(targetPolicy.current && targetPolicy.sellable))
        throw planMigrationRejection({
            reason: 'PLAN_MIGRATION_TARGET_NOT_SELLABLE',
            message: 'Target version is not current and sellable.'
        });
    return { source, target };
}
