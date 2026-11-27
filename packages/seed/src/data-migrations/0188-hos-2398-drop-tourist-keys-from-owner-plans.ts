/**
 * HOS-2398: the tourist entitlements and tourist limits come off the nine sellable
 * owner plans (owner decisions, 2026-11-20 04:29).
 *
 * For each plan in `PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS` (read from
 * `../catalog/next-version-entitlements`, which the production catalog source
 * re-exports) it publishes a new immutable version that copies the CURRENT one,
 * read at runtime (staging carries hand-published versions and prod differs, so no
 * content is hardcoded), minus the keys in `OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS`
 * and `OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS`. `ai_chat` and the owner chat limits
 * are not in those lists and are copied like every other row.
 *
 * Every live subscription (and queued plan change) pinned to ANY older version of
 * that plan is then re-anchored onto the new version. Same price, and nothing the
 * subscriber receives shrinks: the removed keys only counted in the owner vertical,
 * where nobody reads them, and the owner keeps getting them as a tourist through
 * Tourist VIP inheritance. That is the explicit allowlist in
 * `assertReanchorCompatible` (owner option B): no `plan_migration`, no notice.
 * The one exception is a subscription on an older version sold at another price (a
 * grandfathered price): re-anchoring it would change what it pays, so it stays on
 * its version, whose leftover tourist rows are just as unread.
 *
 * Modelled on 0133 (HOS-2037) and 0156 (HOS-2077). `contentOnly` is deliberate: a
 * fresh database applies 0144 first, then this migration runs for real instead of
 * baseline-stamping a catalog that still carries the tourist rows. No
 * `requiresColumns`: every column it reads already exists and none is being dropped.
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
import {
    OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS,
    OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS,
    PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS
} from '../catalog/next-version-entitlements.js';
import { logger } from '../utils/logger.js';
import {
    REANCHOR_PRICE_MISMATCH,
    reanchorOlderVersions,
    type SkippedReanchor
} from './helpers/reanchorSubscriptionsToVersion.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Ledger identity of this migration; `contentOnly` so fresh databases run it for real. */
export const meta = {
    name: '0188-hos-2398-drop-tourist-keys-from-owner-plans',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

const REMOVED_ENTITLEMENTS: ReadonlySet<string> = new Set(
    OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS
);
const REMOVED_LIMITS: ReadonlySet<string> = new Set(OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS);

/**
 * Publishes the next version of each plan in {@link PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS}
 * and re-anchors the live subscriptions pinned to its older versions. Idempotent: a plan whose
 * current version already carries none of the removed keys is not republished, but older-version
 * stragglers are still moved. A plan whose current version does NOT inherit Tourist VIP is
 * refused, because then the removal would really take something away. A live subscription on an
 * older version with a different price is left in place and reported; if one cannot be
 * re-anchored for ANY other reason the migration throws, so the runner rolls the whole
 * transaction back and writes no ledger row. Versions with no live subscription are ignored.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns Summary of how many plan versions were published.
 * @throws Error naming each blocking version with its live and queued counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let published = 0;
    const skipped: { readonly slug: string; readonly item: SkippedReanchor }[] = [];
    for (const { vertical, slug } of PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS) {
        const [plan] = await ctx.db
            .select()
            .from(plans)
            .where(and(eq(plans.vertical, vertical), eq(plans.slug, slug)))
            .limit(1);
        if (!plan) throw new Error(`Missing plan ${vertical}/${slug}`);

        const [current] = await ctx.db
            .select()
            .from(planVersions)
            .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)))
            .limit(1);
        if (!current) throw new Error(`Missing current version for plan ${slug}`);

        const oldEntitlements = await ctx.db
            .select()
            .from(planVersionEntitlements)
            .where(eq(planVersionEntitlements.planVersionId, current.id));
        const oldLimits = await ctx.db
            .select()
            .from(planVersionLimits)
            .where(eq(planVersionLimits.planVersionId, current.id));

        const carriesTouristKeys =
            oldEntitlements.some(({ key }) => REMOVED_ENTITLEMENTS.has(key)) ||
            oldLimits.some(({ key }) => REMOVED_LIMITS.has(key));
        if (!carriesTouristKeys) {
            const stragglers = await reanchorOlderVersions({
                db: ctx.db,
                planId: plan.id,
                toVersionId: current.id
            });
            skipped.push(...stragglers.skipped.map((item) => ({ slug, item })));
            continue;
        }
        if (!current.inheritsTouristVip)
            throw new Error(
                `HOS-2398: ${slug} current version does not inherit Tourist VIP; removing its tourist keys would take them away, refusing`
            );

        const oldOptions = await ctx.db
            .select()
            .from(billingOptions)
            .where(eq(billingOptions.planVersionId, current.id));
        const nextEntitlements = oldEntitlements
            .filter(({ key }) => !REMOVED_ENTITLEMENTS.has(key))
            .map(({ key, planQuota, trialQuota }) => ({ key, planQuota, trialQuota }));
        const nextLimits = oldLimits
            .filter(({ key }) => !REMOVED_LIMITS.has(key))
            .map(({ key, value }) => ({ key, value }));
        const content = {
            rank: current.rank,
            sellable: current.sellable,
            trialDays: current.trialDays,
            graceDays: current.graceDays,
            allowsPause: current.allowsPause,
            inheritsTouristVip: current.inheritsTouristVip,
            entitlements: nextEntitlements,
            limits: nextLimits,
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
                inheritsTouristVip: current.inheritsTouristVip,
                // HOS-2196: a republished version keeps the payment methods of the one it replaces.
                paymentMethods: current.paymentMethods
            })
            .returning({ id: planVersions.id });
        const newVersionId = next[0]?.id;
        if (!newVersionId) throw new Error(`Could not publish version for ${slug}`);

        if (nextEntitlements.length > 0)
            await ctx.db
                .insert(planVersionEntitlements)
                .values(nextEntitlements.map((row) => ({ planVersionId: newVersionId, ...row })));
        if (nextLimits.length > 0)
            await ctx.db
                .insert(planVersionLimits)
                .values(nextLimits.map((row) => ({ planVersionId: newVersionId, ...row })));

        if (current.sellable && oldOptions.length > 0) {
            await ctx.db.insert(billingOptions).values(
                oldOptions.map(({ cycle, amount, currency }) => ({
                    planVersionId: newVersionId,
                    cycle,
                    amount,
                    currency
                }))
            );
        }
        // The seed process has no effective-set cache client; owner-vertical entries expire on
        // their own within 15 minutes (ENTRY_MAX_AGE_MS). Nobody reads the removed keys in the
        // owner vertical, so a stale entry changes no decision meanwhile.
        const moved = await reanchorOlderVersions({
            db: ctx.db,
            planId: plan.id,
            toVersionId: newVersionId
        });
        skipped.push(...moved.skipped.map((item) => ({ slug, item })));
        logger.info(
            `HOS-2398 re-anchored ${moved.movedCount} live subscription(s) and remapped ${moved.remappedScheduledChanges} scheduled change(s) for ${slug}; skipped ${moved.skipped.length} incompatible version(s).`
        );
        published += 1;
    }

    // A live subscriber on an older version sold at ANOTHER price (a grandfathered price) stays
    // where it is: moving it would change what it pays, which only a `plan_migration` with notice
    // may do. That loses nothing, because the tourist rows its version keeps only count in the
    // owner vertical, where nobody reads them; it reaches the clean version on its next plan
    // migration. Any OTHER refusal under a live subscriber aborts the migration (the runner
    // rolls the whole transaction back and writes no ledger row).
    const grandfathered = skipped.filter(
        ({ item }) => item.liveCount > 0 && item.reason === REANCHOR_PRICE_MISMATCH
    );
    const blocking = skipped.filter(
        ({ item }) => item.liveCount > 0 && item.reason !== REANCHOR_PRICE_MISMATCH
    );
    if (blocking.length > 0) {
        throw new Error(
            `HOS-2398: cannot re-anchor live subscriptions: ${blocking
                .map(
                    ({ slug, item }) =>
                        `${slug} version ${item.versionId} (${item.liveCount} live, ${item.queuedCount} queued): ${item.reason}`
                )
                .join('; ')}`
        );
    }
    for (const { slug, item } of grandfathered)
        logger.warn(
            `HOS-2398: ${slug} version ${item.versionId} keeps ${item.liveCount} live subscription(s) and ${item.queuedCount} queued change(s) on a grandfathered price; left in place.`
        );
    for (const { slug, item } of skipped.filter(({ item }) => item.liveCount === 0))
        logger.warn(
            `HOS-2398: ${slug} version ${item.versionId} has ${item.queuedCount} queued change(s) that could not be remapped (no live subscribers): ${item.reason}`
        );

    const leftInPlace = grandfathered.reduce((total, { item }) => total + item.liveCount, 0);
    return {
        summary: `Published the version without tourist keys on ${published} owner plan(s); left ${leftInPlace} live subscription(s) on a grandfathered price in place.`
    };
}
