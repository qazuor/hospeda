import {
    ALL_TRIAL_PLANS,
    describeTrialSnapshotDivergences,
    findTrialSnapshotDivergences,
    type TrialSnapshotPlanRow
} from '@repo/billing';
import { billingPlans, type DrizzleClient, getDb, inArray } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { ensureTrialPlanRow } from './trialPlans.writer.js';

/**
 * Composed trial-plan seed (HOS-1012 D-5, spec §6.8).
 *
 * Seeds the three dedicated trial plans — `owner-trial`, `gastronomy-trial` and
 * `experience-trial` — each stamped with its own `billing_plans.product_domain`
 * and carrying its `metadata.trialComposition`.
 *
 * Why a dedicated seed and NOT the `ALL_PLANS` loop in `billingPlans.seed.ts`:
 * the same reason `seedCommercePlan`, `seedPartnerPlan` and `seedTestDailyPlan`
 * each have one. The accommodation seed loop, the public plan list and the
 * grant-matrix snapshot tests all operate on `ALL_PLANS`, and a trial plan must
 * be invisible to all three.
 *
 * `product_domain` per vertical is REQUIRED, not decorative:
 * `createTrialSubscription` throws when the plan's domain does not match the
 * trial being started, which is what turns a wrong mapping into a loud failure
 * instead of a silent cross-vertical trial.
 *
 * Idempotent — see {@link ensureTrialPlanRow}. On a re-run it re-stamps
 * `product_domain` + `metadata.trialComposition` (both no-ops when already
 * correct) and never touches the entitlements/limits snapshot, which is
 * `'commercial'` under Model C.
 *
 * @param _context - Seed context (unused; kept for the runner contract).
 */
export async function seedTrialPlans(_context: SeedContext): Promise<void> {
    const entityName = 'Trial Plans';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName} (HOS-1012 D-5)`);
    logger.info(`${separator}`);

    try {
        const livemode = process.env.NODE_ENV === 'production';
        const db: DrizzleClient = getDb();

        let created = 0;
        let restamped = 0;
        let skipped = 0;

        for (const entry of ALL_TRIAL_PLANS) {
            const outcome = await ensureTrialPlanRow({ db, entry, livemode });
            if (outcome === 'created') {
                created++;
                logger.success({
                    msg: `${STATUS_ICONS.Success}  Created trial plan "${entry.plan.slug}" (product_domain='${entry.productDomain}', composition: entitlements←${entry.composition.entitlementsFrom}, limits←${entry.composition.limitsFrom})`
                });
            } else if (outcome === 'restamped') {
                restamped++;
                logger.info(
                    `${STATUS_ICONS.Success}  Trial plan "${entry.plan.slug}" already existed — re-stamped product_domain + metadata.trialComposition`
                );
            } else {
                skipped++;
                logger.info(
                    `${STATUS_ICONS.Skip}  Trial plan "${entry.plan.slug}" already correct — nothing to do`
                );
            }
        }

        await reportSnapshotDivergences(db);

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Trial plans: ${created} created, ${restamped} re-stamped, ${skipped} unchanged. No billing_prices row is ever created — a trial plan is granted at first publish, never bought.`
        );

        summaryTracker.trackSuccess(entityName);
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        summaryTracker.trackError(
            entityName,
            'trial-plans',
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
}

/**
 * Reports — never fixes, never fails — any trial plan whose stored SNAPSHOT has
 * drifted from what its composition resolves against the LIVE source rows
 * (HOS-1012 T-036).
 *
 * Reads rows rather than config on purpose. `entitlements` and `limitsValues`
 * are `'commercial'` under HOS-39's Model C, so the drift this can catch — an
 * operator raising `owner-basico`'s photo cap through the admin panel — exists
 * only in the database. A config-vs-config check would agree with itself and
 * see nothing.
 *
 * A divergence is not an error: the operator edit that caused it is supported,
 * and the trial still GATES on the live composition. What has gone stale is the
 * number an admin screen shows. So this logs and moves on.
 *
 * @param db - Drizzle client.
 */
async function reportSnapshotDivergences(db: DrizzleClient): Promise<void> {
    const slugs = new Set<string>();
    for (const { plan, composition } of ALL_TRIAL_PLANS) {
        slugs.add(plan.slug);
        slugs.add(composition.entitlementsFrom);
        slugs.add(composition.limitsFrom);
    }

    const dbRows = await db
        .select({
            slug: billingPlans.name,
            entitlements: billingPlans.entitlements,
            limits: billingPlans.limits,
            metadata: billingPlans.metadata
        })
        .from(billingPlans)
        .where(inArray(billingPlans.name, [...slugs]));

    const rows: TrialSnapshotPlanRow[] = dbRows.map((r) => ({
        slug: r.slug,
        entitlements: (r.entitlements ?? []) as string[],
        limits: (r.limits ?? {}) as Record<string, number>,
        metadata: r.metadata
    }));

    const divergences = findTrialSnapshotDivergences({ rows });
    if (divergences.length === 0) {
        logger.info(
            `${STATUS_ICONS.Success}  Trial plan snapshots agree with what their compositions resolve.`
        );
        return;
    }

    logger.info(
        `${STATUS_ICONS.Skip}  ${divergences.length} trial plan snapshot divergence(s) — the trial still GATES on the live composition; only the displayed values are stale:`
    );
    for (const line of describeTrialSnapshotDivergences(divergences)) {
        logger.info(`   ${line}`);
    }
}
