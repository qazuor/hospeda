/**
 * Publishes a new immutable version of each accommodation plan with the video
 * link entitlement. The production catalog source declares this delta in
 * `nextVersionEntitlements`; this migration applies it to existing catalogs.
 *
 * `contentOnly` is deliberate: a fresh database applies 0144 first, then this
 * migration runs for real instead of baseline-stamping an incomplete catalog.
 */
import {
    and,
    billingOptions,
    eq,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions
} from '@repo/db';
import { PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS } from '../../../../scripts/production-catalog/catalog.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0133-hos-2037-video-link-all-plans',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let published = 0;
    const videoPlanSlugs = PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS.filter(
        (entry) => entry.vertical === 'accommodation' && entry.key === 'can_embed_video'
    ).map((entry) => entry.slug);
    for (const slug of videoPlanSlugs) {
        const [plan] = await ctx.db
            .select()
            .from(plans)
            .where(and(eq(plans.vertical, 'accommodation'), eq(plans.slug, slug)))
            .limit(1);
        if (!plan) throw new Error(`Missing accommodation plan ${slug}`);

        const [current] = await ctx.db
            .select()
            .from(planVersions)
            .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)))
            .limit(1);
        if (!current) throw new Error(`Missing current version for accommodation plan ${slug}`);

        const existingGrant = await ctx.db
            .select({ id: planVersionEntitlements.id })
            .from(planVersionEntitlements)
            .where(
                and(
                    eq(planVersionEntitlements.planVersionId, current.id),
                    eq(planVersionEntitlements.key, 'can_embed_video')
                )
            )
            .limit(1);
        if (existingGrant.length > 0) continue;

        await ctx.db
            .update(planVersions)
            .set({ current: false })
            .where(eq(planVersions.id, current.id));
        const next = await ctx.db
            .insert(planVersions)
            .values({
                planId: current.planId,
                vertical: current.vertical,
                rank: current.rank,
                sellable: current.sellable,
                current: true,
                graceDays: current.graceDays,
                trialDays: current.trialDays,
                allowsPause: current.allowsPause,
                inheritsTouristVip: current.inheritsTouristVip
            })
            .returning({ id: planVersions.id });
        const newVersionId = next[0]?.id;
        if (!newVersionId) throw new Error(`Could not publish version for ${slug}`);

        const oldEntitlements = await ctx.db
            .select()
            .from(planVersionEntitlements)
            .where(eq(planVersionEntitlements.planVersionId, current.id));
        await ctx.db.insert(planVersionEntitlements).values([
            ...oldEntitlements.map(({ key, planQuota, trialQuota }) => ({
                planVersionId: newVersionId,
                key,
                planQuota,
                trialQuota
            })),
            { planVersionId: newVersionId, key: 'can_embed_video' }
        ]);

        const oldLimits = await ctx.db
            .select()
            .from(planVersionLimits)
            .where(eq(planVersionLimits.planVersionId, current.id));
        if (oldLimits.length > 0) {
            await ctx.db.insert(planVersionLimits).values(
                oldLimits.map(({ key, value }) => ({
                    planVersionId: newVersionId,
                    key,
                    value
                }))
            );
        }

        if (current.sellable) {
            const oldOptions = await ctx.db
                .select()
                .from(billingOptions)
                .where(eq(billingOptions.planVersionId, current.id));
            if (oldOptions.length > 0) {
                await ctx.db.insert(billingOptions).values(
                    oldOptions.map(({ cycle, amount, currency }) => ({
                        planVersionId: newVersionId,
                        cycle,
                        amount,
                        currency
                    }))
                );
            }
        }
        published += 1;
    }

    return {
        summary: `Published video-link entitlement on ${published} accommodation plan version(s).`
    };
}
