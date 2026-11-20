/**
 * HOS-2398 data migration against a real, migrated PostgreSQL database. It builds its own
 * scratch database (`hospeda_it_hos2398_pub`, dropped afterwards); 0144/0176 load the catalog
 * and 0133/0156 are applied first, as on every live environment, so 0188 starts from the
 * versions they published.
 *
 * Scenario: accommodation Basic (monthly + annual), venue Pro with a queued downgrade to venue
 * Basic, an experience Premium in grace and a cancelled accommodation Basic row. After 0188 the
 * nine sellable owner plans have a new current version without the 15 tourist entitlements
 * and the 7 tourist limits, with every other row (`ai_chat` and the owner chat limits
 * included) copied verbatim; live rows and the queued change sit on the new versions with
 * cycle-matched options; prices are untouched; Tourist VIP and the owner trials are untouched;
 * a second run changes nothing.
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
import {
    OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS,
    OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS,
    PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS
} from '../../src/catalog/next-version-entitlements.js';
import { up as up0133 } from '../../src/data-migrations/0133-hos-2037-video-link-all-plans.js';
import { up as up0156 } from '../../src/data-migrations/0156-hos-2077-ai-chat-venue-experience-basic-pro.js';
import { up } from '../../src/data-migrations/0188-hos-2398-drop-tourist-keys-from-owner-plans.js';
import { scratchDatabase } from './support/scratch-database.js';

const database = scratchDatabase({ name: 'hospeda_it_hos2398_pub' });
let pool: Pool;
let db: DrizzleClient;

type MigrationUp = (ctx: never) => Promise<unknown>;
const runUp = (fn: MigrationUp) => db.transaction(async (tx) => fn({ db: tx } as unknown as never));

beforeAll(async () => {
    await database.create();
    await database.migrate();
    pool = new Pool({ connectionString: database.url });
    db = drizzle(pool) as unknown as DrizzleClient;
    await runUp(up0133 as MigrationUp);
    await runUp(up0156 as MigrationUp);
}, 600_000);

afterAll(async () => {
    await pool?.end();
    await database.drop();
});

type Vertical = 'accommodation' | 'venue' | 'experience' | 'tourist';

/** The owner chat limit per vertical (`apps/api/src/routes/ai/protected/chat.ts`). */
const OWNER_CHAT_LIMIT = {
    accommodation: 'max_ai_chat_per_month',
    venue: 'max_ai_chat_venue_per_month',
    experience: 'max_ai_chat_experience_per_month'
} as const;

const REMOVED_E = new Set<string>(OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS);
const REMOVED_L = new Set<string>(OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS);
const run = () => runUp(up as MigrationUp);

async function currentVersion(vertical: Vertical, slug: string) {
    const [plan] = await db
        .select()
        .from(plans)
        .where(and(eq(plans.vertical, vertical), eq(plans.slug, slug)));
    if (!plan) throw new Error(`Missing plan ${vertical}/${slug}`);
    const [version] = await db
        .select()
        .from(planVersions)
        .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)));
    if (!version) throw new Error(`Missing current version for ${slug}`);
    return { plan, version };
}

async function effects(versionId: string) {
    const [entitlements, limits, options] = await Promise.all([
        db
            .select()
            .from(planVersionEntitlements)
            .where(eq(planVersionEntitlements.planVersionId, versionId)),
        db.select().from(planVersionLimits).where(eq(planVersionLimits.planVersionId, versionId)),
        db.select().from(billingOptions).where(eq(billingOptions.planVersionId, versionId))
    ]);
    return { entitlements, limits, options };
}

async function anchor(input: {
    readonly vertical: Vertical;
    readonly versionId: string;
    readonly cycle: 'monthly' | 'annual';
    readonly status: string;
}) {
    const [user] = await db
        .insert(users)
        .values({
            email: `hos2398-${crypto.randomUUID()}@example.com`,
            displayName: 'HOS-2398 fixture'
        })
        .returning();
    if (!user) throw new Error('user insert failed');
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
            vertical: input.vertical,
            planVersionId: input.versionId,
            billingOptionId: option.id,
            paymentMethod: 'MANUAL',
            status: input.status,
            class: 'PRINCIPAL'
        })
        .returning();
    if (!row) throw new Error('subscription insert failed');
    return row;
}

const rowKey = (row: { key: string; planQuota: number | null; trialQuota: number | null }) =>
    `${row.key}:${row.planQuota}:${row.trialQuota}`;

describe('HOS-2398 migration 0188 (real database)', () => {
    it('publishes the nine owner plans without the tourist keys, re-anchors live rows, is idempotent', async () => {
        // Arrange
        const before = new Map<string, Awaited<ReturnType<typeof currentVersion>>>();
        for (const { vertical, slug } of PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS) {
            const current = await currentVersion(vertical, slug);
            before.set(slug, current);
            const { entitlements, limits } = await effects(current.version.id);
            expect(
                entitlements.filter((e) => REMOVED_E.has(e.key)),
                slug
            ).toHaveLength(15);
            expect(
                limits.filter((l) => REMOVED_L.has(l.key)),
                slug
            ).toHaveLength(7);
        }
        const tourist = await currentVersion('tourist', 'tourist-vip');
        const trials = [
            await currentVersion('accommodation', 'trial'),
            await currentVersion('venue', 'trial'),
            await currentVersion('experience', 'trial')
        ];
        const oldAccBasic = before.get('owner-basico')?.version;
        const oldVenueBasic = before.get('venue-basico')?.version;
        const oldVenuePro = before.get('venue-pro')?.version;
        const oldExpPremium = before.get('experience-premium')?.version;
        if (!oldAccBasic || !oldVenueBasic || !oldVenuePro || !oldExpPremium)
            throw new Error('setup');

        const monthly = await anchor({
            vertical: 'accommodation',
            versionId: oldAccBasic.id,
            cycle: 'monthly',
            status: 'ACTIVE'
        });
        const annual = await anchor({
            vertical: 'accommodation',
            versionId: oldAccBasic.id,
            cycle: 'annual',
            status: 'ACTIVE'
        });
        const cancelled = await anchor({
            vertical: 'accommodation',
            versionId: oldAccBasic.id,
            cycle: 'monthly',
            status: 'CANCELLED'
        });
        const pro = await anchor({
            vertical: 'venue',
            versionId: oldVenuePro.id,
            cycle: 'monthly',
            status: 'ACTIVE'
        });
        const grace = await anchor({
            vertical: 'experience',
            versionId: oldExpPremium.id,
            cycle: 'monthly',
            status: 'GRACE_PERIOD'
        });
        const [queuedOption] = await db
            .select()
            .from(billingOptions)
            .where(
                and(
                    eq(billingOptions.planVersionId, oldVenueBasic.id),
                    eq(billingOptions.cycle, 'annual')
                )
            );
        if (!queuedOption) throw new Error('venue Basic has no annual option');
        const [queued] = await db
            .insert(subscriptionScheduledChanges)
            .values({
                subscriptionId: pro.id,
                targetPlanVersionId: oldVenueBasic.id,
                targetBillingOptionId: queuedOption.id,
                effectiveAt: new Date(Date.now() + 86_400_000)
            })
            .returning();
        if (!queued) throw new Error('scheduled change insert failed');

        // Act
        await run();

        // Assert: a new current version per plan, without the tourist keys, the rest verbatim
        const after = new Map<string, Awaited<ReturnType<typeof currentVersion>>>();
        for (const { vertical, slug } of PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS) {
            const old = before.get(slug);
            const current = await currentVersion(vertical, slug);
            after.set(slug, current);
            expect(current.version.id, slug).not.toBe(old?.version.id);
            expect(current.version.inheritsTouristVip, slug).toBe(true);
            expect(current.version.rank, slug).toBe(old?.version.rank);
            const oldEffects = await effects(old?.version.id ?? '');
            const { entitlements, limits, options } = await effects(current.version.id);
            expect(
                entitlements.filter((e) => REMOVED_E.has(e.key)),
                slug
            ).toEqual([]);
            expect(
                limits.filter((l) => REMOVED_L.has(l.key)),
                slug
            ).toEqual([]);
            expect(entitlements.map(rowKey).sort(), slug).toEqual(
                oldEffects.entitlements
                    .filter((e) => !REMOVED_E.has(e.key))
                    .map(rowKey)
                    .sort()
            );
            expect(new Map(limits.map((l) => [l.key, l.value])), slug).toEqual(
                new Map(
                    oldEffects.limits
                        .filter((l) => !REMOVED_L.has(l.key))
                        .map((l) => [l.key, l.value])
                )
            );
            // ai_chat and the owner chat limit survive
            expect(
                entitlements.some((e) => e.key === 'ai_chat'),
                slug
            ).toBe(true);
            expect(
                limits.some((l) => l.key === OWNER_CHAT_LIMIT[vertical]),
                slug
            ).toBe(true);
            // prices unchanged, per cycle
            expect(new Map(options.map((o) => [o.cycle, `${o.amount}/${o.currency}`]))).toEqual(
                new Map(oldEffects.options.map((o) => [o.cycle, `${o.amount}/${o.currency}`]))
            );
        }

        // live rows moved with the cycle-matched option; the cancelled one stays
        const newAccBasic = after.get('owner-basico')?.version;
        const newVenueBasic = after.get('venue-basico')?.version;
        const newVenuePro = after.get('venue-pro')?.version;
        const newExpPremium = after.get('experience-premium')?.version;
        if (!newAccBasic || !newVenueBasic || !newVenuePro || !newExpPremium)
            throw new Error('published');
        const cycleOf = async (versionId: string, optionId: string | null | undefined) =>
            (await effects(versionId)).options.find((o) => o.id === optionId)?.cycle;
        const rows = await db
            .select()
            .from(subscriptions)
            .where(
                inArray(subscriptions.id, [monthly.id, annual.id, cancelled.id, pro.id, grace.id])
            );
        const byId = new Map(rows.map((r) => [r.id, r]));
        expect(byId.get(monthly.id)?.planVersionId).toBe(newAccBasic.id);
        expect(await cycleOf(newAccBasic.id, byId.get(monthly.id)?.billingOptionId)).toBe(
            'monthly'
        );
        expect(byId.get(annual.id)?.planVersionId).toBe(newAccBasic.id);
        expect(await cycleOf(newAccBasic.id, byId.get(annual.id)?.billingOptionId)).toBe('annual');
        expect(byId.get(cancelled.id)?.planVersionId).toBe(oldAccBasic.id);
        expect(byId.get(pro.id)?.planVersionId).toBe(newVenuePro.id);
        expect(byId.get(grace.id)?.planVersionId).toBe(newExpPremium.id);

        const [queuedAfter] = await db
            .select()
            .from(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.id, queued.id));
        expect(queuedAfter?.targetPlanVersionId).toBe(newVenueBasic.id);
        expect(await cycleOf(newVenueBasic.id, queuedAfter?.targetBillingOptionId)).toBe('annual');

        // Tourist VIP and the owner trials keep their current version (and their rows)
        for (const { plan, version } of [tourist, ...trials]) {
            const [stillCurrent] = await db
                .select()
                .from(planVersions)
                .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)));
            expect(stillCurrent?.id, `${plan.vertical}/${plan.slug}`).toBe(version.id);
        }
        const vipRows = await effects(tourist.version.id);
        expect(vipRows.entitlements.filter((e) => REMOVED_E.has(e.key))).toHaveLength(15);
        expect(vipRows.limits.filter((l) => REMOVED_L.has(l.key))).toHaveLength(7);

        // Second run: no new version anywhere, nothing moves
        const planIds = [...after.values()].map(({ plan }) => plan.id);
        const versionsBefore = await db
            .select()
            .from(planVersions)
            .where(inArray(planVersions.planId, planIds));
        await run();
        const versionsAfter = await db
            .select()
            .from(planVersions)
            .where(inArray(planVersions.planId, planIds));
        expect(versionsAfter).toHaveLength(versionsBefore.length);
        for (const { vertical, slug } of PRODUCTION_PLAN_NEXT_VERSION_TOURIST_KEY_REMOVALS) {
            const current = await currentVersion(vertical, slug);
            expect(current.version.id).toBe(after.get(slug)?.version.id);
        }
    });

    it('sweeps a straggler left on the oldest version when the current one is already clean', async () => {
        // Arrange: a row pinned to the 0144 accommodation Basic version (before 0133 added video).
        const { plan } = await currentVersion('accommodation', 'owner-basico');
        const versions = await db
            .select()
            .from(planVersions)
            .where(eq(planVersions.planId, plan.id));
        const current = versions.find((v) => v.current);
        const oldest = versions
            .filter((v) => !v.current)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        if (!oldest || !current) throw new Error('expected an older and a current version');
        const straggler = await anchor({
            vertical: 'accommodation',
            versionId: oldest.id,
            cycle: 'monthly',
            status: 'ACTIVE'
        });

        // Act
        await run();

        // Assert
        const [row] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, straggler.id));
        expect(row?.planVersionId).toBe(current.id);
    });

    /**
     * Inserts, in one transaction (the catalog trigger only accepts child rows in the
     * transaction that publishes the version), a non-current version cloned from `sourceId`
     * plus the tourist keys, like every version published before 0188. `monthlyDelta` changes
     * its monthly price; `raisedLimit` gives it one owner limit above the source's.
     */
    async function olderVersion(input: {
        readonly sourceId: string;
        readonly monthlyDelta?: number;
        readonly raisedLimit?: string;
    }) {
        const sourceEffects = await effects(input.sourceId);
        return db.transaction(async (tx) => {
            const [source] = await tx
                .select()
                .from(planVersions)
                .where(eq(planVersions.id, input.sourceId));
            if (!source) throw new Error('source version');
            const [older] = await tx
                .insert(planVersions)
                .values({
                    planId: source.planId,
                    vertical: source.vertical,
                    rank: source.rank,
                    sellable: true,
                    current: false,
                    graceDays: source.graceDays,
                    trialDays: source.trialDays,
                    allowsPause: source.allowsPause,
                    inheritsTouristVip: true
                })
                .returning();
            if (!older) throw new Error('older version insert failed');
            await tx.insert(planVersionEntitlements).values([
                ...sourceEffects.entitlements.map(({ key, planQuota, trialQuota }) => ({
                    planVersionId: older.id,
                    key,
                    planQuota,
                    trialQuota
                })),
                ...OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS.map((key) => ({
                    planVersionId: older.id,
                    key,
                    planQuota: null,
                    trialQuota: null
                }))
            ]);
            await tx.insert(planVersionLimits).values([
                ...sourceEffects.limits.map(({ key, value }) => ({
                    planVersionId: older.id,
                    key,
                    value: key === input.raisedLimit ? value + 1 : value
                })),
                ...OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS.map((key) => ({
                    planVersionId: older.id,
                    key,
                    value: 200
                }))
            ]);
            await tx.insert(billingOptions).values(
                sourceEffects.options.map(({ cycle, amount, currency }) => ({
                    planVersionId: older.id,
                    cycle,
                    amount: cycle === 'monthly' ? amount + (input.monthlyDelta ?? 0) : amount,
                    currency
                }))
            );
            return older;
        });
    }

    it('leaves a subscription on a grandfathered price where it is and still succeeds', async () => {
        // Arrange: an older venue-premium version sold at another monthly price, one live row on it.
        const { version: current } = await currentVersion('venue', 'venue-premium');
        const older = await olderVersion({ sourceId: current.id, monthlyDelta: -100 });
        const grandfathered = await anchor({
            vertical: 'venue',
            versionId: older.id,
            cycle: 'monthly',
            status: 'ACTIVE'
        });

        // Act
        await run();

        // Assert: it keeps its version and its price; the plan keeps its current version
        const [row] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, grandfathered.id));
        expect(row?.planVersionId).toBe(older.id);
        expect(row?.billingOptionId).toBe(grandfathered.billingOptionId);
        expect((await currentVersion('venue', 'venue-premium')).version.id).toBe(current.id);

        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, grandfathered.id));
    });

    it('still aborts when a live row cannot be re-anchored for any other reason', async () => {
        // Arrange: same price, but the older venue-pro version grants a higher owner limit.
        const { version: current } = await currentVersion('venue', 'venue-pro');
        const ownerLimit = (await effects(current.id)).limits.find(
            (l) => !OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS.some((key) => key === l.key)
        );
        if (!ownerLimit) throw new Error('venue-pro has no owner limit');
        const older = await olderVersion({ sourceId: current.id, raisedLimit: ownerLimit.key });
        const blocked = await anchor({
            vertical: 'venue',
            versionId: older.id,
            cycle: 'monthly',
            status: 'ACTIVE'
        });

        // Act + Assert
        await expect(run()).rejects.toThrow('removes or reduces a limit');

        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, blocked.id));
    });
});
