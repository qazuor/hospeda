/**
 * HOS-2037 data migration against a real, migrated PostgreSQL database (the
 * integration carril's ephemeral database; 0144/0176 already loaded the catalog).
 *
 * Scenario: a monthly and an annual Basic subscriber, a Pro subscriber with a queued
 * downgrade to Basic, and a cancelled Basic row. After migration 0133 the live rows are
 * on the new Basic version with the cycle-matched option, the queued change targets the
 * new version, prices are untouched, the trial version still has zero entitlement rows,
 * and a second run changes nothing.
 */
import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingOptions,
    eq,
    inArray,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { up } from '../../src/data-migrations/0133-hos-2037-video-link-all-plans.js';
import { reanchorSubscriptionsToVersion } from '../../src/data-migrations/helpers/reanchorSubscriptionsToVersion.js';

const connectionString = process.env.HOSPEDA_DATABASE_URL;
let pool: Pool;
let db: DrizzleClient;

beforeAll(() => {
    if (!connectionString) throw new Error('HOSPEDA_DATABASE_URL is not set by the global setup');
    pool = new Pool({ connectionString });
    db = drizzle(pool) as unknown as DrizzleClient;
});

afterAll(async () => {
    await pool?.end();
});

const run = () => db.transaction(async (tx) => up({ db: tx } as Parameters<typeof up>[0]));

const reanchor = (fromVersionId: string, toVersionId: string) =>
    db.transaction(async (tx) =>
        reanchorSubscriptionsToVersion({ db: tx, fromVersionId, toVersionId })
    );

async function currentVersion(slug: string, role?: 'trial') {
    const [plan] = await db
        .select()
        .from(plans)
        .where(
            and(
                eq(plans.vertical, 'accommodation'),
                role ? eq(plans.role, role) : eq(plans.slug, slug)
            )
        );
    if (!plan) throw new Error(`Missing plan ${slug}`);
    const [version] = await db
        .select()
        .from(planVersions)
        .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)));
    if (!version) throw new Error(`Missing current version for ${slug}`);
    return { plan, version };
}

async function newUser() {
    const [user] = await db
        .insert(users)
        .values({
            email: `hos2037-${crypto.randomUUID()}@example.com`,
            displayName: 'HOS-2037 fixture'
        })
        .returning();
    if (!user) throw new Error('user insert failed');
    return user;
}

async function anchor(input: {
    readonly versionId: string;
    readonly cycle: 'monthly' | 'annual';
    readonly status: string;
}) {
    const user = await newUser();
    const [option] = await db
        .select()
        .from(billingOptions)
        .where(
            and(
                eq(billingOptions.planVersionId, input.versionId),
                eq(billingOptions.cycle, input.cycle)
            )
        );
    if (!option) throw new Error(`No ${input.cycle} option`);
    const [row] = await db
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: input.versionId,
            billingOptionId: option.id,
            paymentMethod: 'MANUAL',
            status: input.status,
            class: 'PRINCIPAL'
        })
        .returning();
    if (!row) throw new Error('subscription insert failed');
    return { row, option };
}

describe('HOS-2037 migration 0133 (real database)', () => {
    it('publishes Basic with the grant, re-anchors by cycle, remaps queued changes, is idempotent', async () => {
        const { plan: basic, version: oldBasic } = await currentVersion('owner-basico');
        const { version: pro } = await currentVersion('owner-pro');
        const { version: trial } = await currentVersion('trial', 'trial');
        const oldOptions = await db
            .select()
            .from(billingOptions)
            .where(eq(billingOptions.planVersionId, oldBasic.id));
        const priceByCycle = new Map(oldOptions.map((o) => [o.cycle, `${o.amount}/${o.currency}`]));

        // Arrange
        const monthly = await anchor({
            versionId: oldBasic.id,
            cycle: 'monthly',
            status: 'ACTIVE'
        });
        const annual = await anchor({ versionId: oldBasic.id, cycle: 'annual', status: 'ACTIVE' });
        const cancelled = await anchor({
            versionId: oldBasic.id,
            cycle: 'monthly',
            status: 'CANCELLED'
        });
        const proSub = await anchor({ versionId: pro.id, cycle: 'monthly', status: 'ACTIVE' });
        const queuedOption = oldOptions.find((o) => o.cycle === 'annual');
        if (!queuedOption) throw new Error('Basic has no annual option');
        const [queued] = await db
            .insert(subscriptionScheduledChanges)
            .values({
                subscriptionId: proSub.row.id,
                targetPlanVersionId: oldBasic.id,
                targetBillingOptionId: queuedOption.id,
                effectiveAt: new Date(Date.now() + 86_400_000)
            })
            .returning();
        if (!queued) throw new Error('scheduled change insert failed');
        const trialRowsBefore = await db
            .select()
            .from(planVersionEntitlements)
            .where(eq(planVersionEntitlements.planVersionId, trial.id));
        expect(trialRowsBefore).toHaveLength(0);

        // Act
        await run();

        // Assert: new current Basic version with the grant
        const { version: newBasic } = await currentVersion('owner-basico');
        expect(newBasic.id).not.toBe(oldBasic.id);
        const grant = await db
            .select()
            .from(planVersionEntitlements)
            .where(
                and(
                    eq(planVersionEntitlements.planVersionId, newBasic.id),
                    eq(planVersionEntitlements.key, 'can_embed_video')
                )
            );
        expect(grant).toHaveLength(1);

        // prices unchanged, per cycle
        const newOptions = await db
            .select()
            .from(billingOptions)
            .where(eq(billingOptions.planVersionId, newBasic.id));
        expect(new Map(newOptions.map((o) => [o.cycle, `${o.amount}/${o.currency}`]))).toEqual(
            priceByCycle
        );

        // live rows moved with the cycle-matched option
        const rows = await db
            .select()
            .from(subscriptions)
            .where(inArray(subscriptions.id, [monthly.row.id, annual.row.id, cancelled.row.id]));
        const byId = new Map(rows.map((r) => [r.id, r]));
        const cycleOf = (optionId: string | null | undefined) =>
            newOptions.find((o) => o.id === optionId)?.cycle;
        expect(byId.get(monthly.row.id)?.planVersionId).toBe(newBasic.id);
        expect(cycleOf(byId.get(monthly.row.id)?.billingOptionId)).toBe('monthly');
        expect(byId.get(annual.row.id)?.planVersionId).toBe(newBasic.id);
        expect(cycleOf(byId.get(annual.row.id)?.billingOptionId)).toBe('annual');
        // a CANCELLED row is not live: left on the version it was sold under
        expect(byId.get(cancelled.row.id)?.planVersionId).toBe(oldBasic.id);

        // queued downgrade now lands on the new version, annual preserved
        const [queuedAfter] = await db
            .select()
            .from(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.id, queued.id));
        expect(queuedAfter?.targetPlanVersionId).toBe(newBasic.id);
        expect(cycleOf(queuedAfter?.targetBillingOptionId)).toBe('annual');

        // the trial stays derived: still zero entitlement rows; Pro untouched
        const trialRowsAfter = await db
            .select()
            .from(planVersionEntitlements)
            .where(eq(planVersionEntitlements.planVersionId, trial.id));
        expect(trialRowsAfter).toHaveLength(0);
        const [proAfter] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, proSub.row.id));
        expect(proAfter?.planVersionId).toBe(pro.id);

        // second run: no new version, nothing moves
        const versionsBefore = await db
            .select()
            .from(planVersions)
            .where(eq(planVersions.planId, basic.id));
        await run();
        const versionsAfter = await db
            .select()
            .from(planVersions)
            .where(eq(planVersions.planId, basic.id));
        expect(versionsAfter).toHaveLength(versionsBefore.length);
        expect(await reanchor(oldBasic.id, newBasic.id)).toEqual({
            movedCount: 0,
            remappedScheduledChanges: 0,
            userIds: []
        });
    });

    it('accepts a retired, non-sellable source and refuses a price-different one', async () => {
        const { version: current } = await currentVersion('owner-basico');
        const [currentEntitlements, currentLimits, currentOptions] = await Promise.all([
            db
                .select()
                .from(planVersionEntitlements)
                .where(eq(planVersionEntitlements.planVersionId, current.id)),
            db
                .select()
                .from(planVersionLimits)
                .where(eq(planVersionLimits.planVersionId, current.id)),
            db.select().from(billingOptions).where(eq(billingOptions.planVersionId, current.id))
        ]);

        const retire = (priceShift: number) =>
            // The catalog triggers only accept children inside the version's own transaction.
            db.transaction(async (tx) => {
                const [version] = await tx
                    .insert(planVersions)
                    .values({
                        planId: current.planId,
                        vertical: current.vertical,
                        rank: current.rank,
                        sellable: false,
                        current: false,
                        graceDays: current.graceDays,
                        trialDays: current.trialDays,
                        allowsPause: current.allowsPause,
                        inheritsTouristVip: current.inheritsTouristVip
                    })
                    .returning();
                if (!version) throw new Error('retired version insert failed');
                await tx.insert(planVersionEntitlements).values(
                    currentEntitlements.map(({ key, planQuota, trialQuota }) => ({
                        planVersionId: version.id,
                        key,
                        planQuota,
                        trialQuota
                    }))
                );
                if (currentLimits.length > 0)
                    await tx.insert(planVersionLimits).values(
                        currentLimits.map(({ key, value }) => ({
                            planVersionId: version.id,
                            key,
                            value
                        }))
                    );
                await tx.insert(billingOptions).values(
                    currentOptions.map(({ cycle, amount, currency }) => ({
                        planVersionId: version.id,
                        cycle,
                        amount: amount + priceShift,
                        currency
                    }))
                );
                return version;
            });

        // Different price: refused even with a live subscriber, and nothing moves.
        const dearer = await retire(1);
        const stuck = await anchor({ versionId: dearer.id, cycle: 'monthly', status: 'ACTIVE' });
        await expect(reanchor(dearer.id, current.id)).rejects.toThrow('prices differ');
        const [stuckAfter] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, stuck.row.id));
        expect(stuckAfter?.planVersionId).toBe(dearer.id);

        // Same price, retired and non-sellable: moved, cycle preserved.
        const retired = await retire(0);
        const moved = await anchor({ versionId: retired.id, cycle: 'annual', status: 'ACTIVE' });
        const result = await reanchor(retired.id, current.id);
        expect(result.movedCount).toBe(1);
        expect(result.userIds).toEqual([moved.row.userId]);
        const [movedAfter] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, moved.row.id));
        expect(movedAfter?.planVersionId).toBe(current.id);
        expect(currentOptions.find((o) => o.id === movedAfter?.billingOptionId)?.cycle).toBe(
            'annual'
        );
    });
});
