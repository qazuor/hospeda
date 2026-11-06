/**
 * Publishes a new immutable version of each plan listed in
 * `PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS` (read from `../catalog/next-version-entitlements`,
 * which the production catalog source re-exports) with the listed entitlement, and re-anchors
 * every live subscription (and queued plan change) pinned to ANY older version of that plan.
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
import { buildPublicationContext, validatePublication } from '@repo/service-core';
import { PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS } from '../catalog/next-version-entitlements.js';
import { logger } from '../utils/logger.js';
import {
    reanchorOlderVersions,
    type SkippedReanchor
} from './helpers/reanchorSubscriptionsToVersion.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Ledger identity of this migration; `contentOnly` so fresh databases run it for real. */
export const meta = {
    name: '0133-hos-2037-video-link-all-plans',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * Publishes the next version of each plan in {@link PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS}
 * and re-anchors the live subscriptions pinned to its older versions. Idempotent: a plan whose
 * current version already grants the entitlement is not republished, but older-version
 * stragglers are still moved. If ANY live subscription on an older
 * version cannot be re-anchored (guard refusal or error) the migration throws, so the runner
 * rolls the whole transaction back and writes no ledger row; versions with no live
 * subscription are ignored.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns Summary of how many plan versions were published.
 * @throws Error naming each blocking version with its live and queued counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let published = 0;
    const skipped: { readonly slug: string; readonly item: SkippedReanchor }[] = [];
    for (const { vertical, slug, key: grantKey } of PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS) {
        const [plan] = await ctx.db
            .select()
            .from(plans)
            .where(and(eq(plans.vertical, vertical), eq(plans.slug, slug)))
            .limit(1);
        if (!plan) throw new Error(`Missing plan ${slug}`);

        const [current] = await ctx.db
            .select()
            .from(planVersions)
            .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)))
            .limit(1);
        if (!current) throw new Error(`Missing current version for plan ${slug}`);

        const existingGrant = await ctx.db
            .select({ id: planVersionEntitlements.id })
            .from(planVersionEntitlements)
            .where(
                and(
                    eq(planVersionEntitlements.planVersionId, current.id),
                    eq(planVersionEntitlements.key, grantKey)
                )
            )
            .limit(1);
        if (existingGrant.length > 0) {
            const stragglers = await reanchorOlderVersions({
                db: ctx.db,
                planId: plan.id,
                toVersionId: current.id
            });
            skipped.push(...stragglers.skipped.map((item) => ({ slug, item })));
            continue;
        }

        const oldEntitlements = await ctx.db
            .select()
            .from(planVersionEntitlements)
            .where(eq(planVersionEntitlements.planVersionId, current.id));
        const oldLimits = await ctx.db
            .select()
            .from(planVersionLimits)
            .where(eq(planVersionLimits.planVersionId, current.id));
        const oldOptions = await ctx.db
            .select()
            .from(billingOptions)
            .where(eq(billingOptions.planVersionId, current.id));
        const content = {
            rank: current.rank,
            sellable: current.sellable,
            trialDays: current.trialDays,
            graceDays: current.graceDays,
            allowsPause: current.allowsPause,
            inheritsTouristVip: current.inheritsTouristVip,
            entitlements: [
                ...oldEntitlements.map(({ key, planQuota, trialQuota }) => ({
                    key,
                    planQuota,
                    trialQuota
                })),
                { key: grantKey }
            ],
            limits: oldLimits.map(({ key, value }) => ({ key, value })),
            cycles: oldOptions.map(
                ({ cycle }) => cycle as 'monthly' | 'quarterly' | 'semiannual' | 'annual'
            )
        };
        const publication = await buildPublicationContext({
            client: ctx.db,
            planId: plan.id,
            content
        });
        validatePublication({ context: publication });
        for (const option of oldOptions) {
            if (option.currency !== 'ARS')
                throw new Error(`Unexpected currency for ${slug}/${option.cycle}`);
        }
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

        await ctx.db.insert(planVersionEntitlements).values([
            ...oldEntitlements.map(({ key, planQuota, trialQuota }) => ({
                planVersionId: newVersionId,
                key,
                planQuota,
                trialQuota
            })),
            { planVersionId: newVersionId, key: grantKey }
        ]);

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
        // The seed process has no effective-set cache client; entries expire on
        // their own within 15 minutes (ENTRY_MAX_AGE_MS) and the change is
        // additive, so no user loses a grant meanwhile.
        const moved = await reanchorOlderVersions({
            db: ctx.db,
            planId: plan.id,
            toVersionId: newVersionId
        });
        skipped.push(...moved.skipped.map((item) => ({ slug, item })));
        logger.info(
            `HOS-2037 re-anchored ${moved.movedCount} live subscription(s) and remapped ${moved.remappedScheduledChanges} scheduled change(s) for ${slug}; skipped ${moved.skipped.length} incompatible version(s).`
        );
        published += 1;
    }

    // Every holder must get the grant and nothing may fail silently: a live subscriber left on
    // a version that cannot be re-anchored aborts the migration (the runner rolls the whole
    // transaction back and writes no ledger row). Versions without live subscribers are ignored.
    const blocking = skipped.filter(({ item }) => item.liveCount > 0);
    if (blocking.length > 0) {
        throw new Error(
            `HOS-2037: cannot re-anchor live subscriptions: ${blocking
                .map(
                    ({ slug, item }) =>
                        `${slug} version ${item.versionId} (${item.liveCount} live, ${item.queuedCount} queued): ${item.reason}`
                )
                .join('; ')}`
        );
    }
    for (const { slug, item } of skipped)
        logger.warn(
            `HOS-2037: ${slug} version ${item.versionId} has ${item.queuedCount} queued change(s) that could not be remapped (no live subscribers): ${item.reason}`
        );

    return {
        summary: `Published next entitlement version on ${published} plan(s).`
    };
}
