import type { DrizzleClient } from '@repo/db';
import type { AdminCatalogPlanVersion, AdminPlanCatalogResponse } from '@repo/schemas';
import type { Actor } from '../../types/index.js';

function compareKey(left: string, right: string): number {
    if (left < right) return -1;
    return left > right ? 1 : 0;
}

/** Reads a vertical's complete plan catalog and current version for its publisher. */
export async function readAdminPlanCatalog(input: {
    readonly actor: Actor;
    readonly vertical: string;
    readonly client?: DrizzleClient;
}): Promise<AdminPlanCatalogResponse> {
    const { requirePlanPublisher } = await import('./plan-publication.service.js');
    requirePlanPublisher(input.actor);
    const db = await import('@repo/db');
    const client = input.client ?? db.getDb();
    const planRows = await client
        .select({
            id: db.plans.id,
            slug: db.plans.slug,
            name: db.plans.name,
            description: db.plans.description,
            pricingOrder: db.plans.pricingOrder,
            role: db.plans.role
        })
        .from(db.plans)
        .where(db.eq(db.plans.vertical, input.vertical));
    const currentRows = await client
        .select()
        .from(db.planVersions)
        .where(
            db.and(
                db.eq(db.planVersions.vertical, input.vertical),
                db.eq(db.planVersions.current, true)
            )
        );
    const byPlan = new Map(currentRows.map((version) => [version.planId, version]));
    const { loadEffects, loadVersionCycles } = await import('./plan-publication.reader.js');
    const plans = await Promise.all(
        planRows.map(async (plan) => {
            const version = byPlan.get(plan.id);
            let currentVersion: AdminCatalogPlanVersion | null = null;
            if (version) {
                const [effects, cycleResult] = await Promise.all([
                    loadEffects({ client, versionId: version.id }),
                    loadVersionCycles({ client, versionId: version.id })
                ]);
                currentVersion = {
                    versionId: version.id,
                    rank: version.rank,
                    sellable: version.sellable,
                    trialDays: version.trialDays,
                    graceDays: version.graceDays,
                    allowsPause: version.allowsPause,
                    inheritsTouristVip: version.inheritsTouristVip,
                    entitlements: [...effects.entitlements].sort((a, b) =>
                        compareKey(a.key, b.key)
                    ),
                    limits: [...effects.limits].sort((a, b) => compareKey(a.key, b.key)),
                    cycles: [...(cycleResult.cycles ?? [])].sort()
                };
            }
            return {
                planId: plan.id,
                slug: plan.slug,
                name: plan.name,
                description: plan.description,
                pricingOrder: plan.pricingOrder,
                role: plan.role,
                currentVersion
            };
        })
    );
    plans.sort((a, b) => a.pricingOrder - b.pricingOrder || compareKey(a.slug, b.slug));
    return { vertical: input.vertical as AdminPlanCatalogResponse['vertical'], plans };
}
