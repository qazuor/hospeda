/**
 * HOS-2077 data migration against a real, migrated PostgreSQL database. It builds its own
 * scratch database (`hospeda_it_hos2077_pub`, dropped afterwards) so the shared global-setup
 * database stays empty for the other seed integration tests; 0144/0176 already load the catalog.
 *
 * Scenario: monthly and annual venue Basic subscribers, a venue Pro subscriber with a queued
 * downgrade to Basic, an experience Basic subscriber and a cancelled venue Basic row. After
 * migration 0156 the four Basic/Pro plans have a new current version granting `ai_chat` with
 * the chat limit at 20 (Basic) or 100 (Pro), the live rows and the queued change are on the
 * new versions with cycle-matched options, prices are untouched, Premium and accommodation
 * are untouched, the trial derivation (limits from the lowest rank, entitlements from the
 * highest) yields chat with 20, and a second run changes nothing.
 */
import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingOptions,
    eq,
    inArray,
    PlanCatalogModel,
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
import { up } from '../../src/data-migrations/0156-hos-2077-ai-chat-venue-experience-basic-pro.js';
import { scratchDatabase } from './support/scratch-database.js';

const database = scratchDatabase({ name: 'hospeda_it_hos2077_pub' });
let pool: Pool;
let db: DrizzleClient;

beforeAll(async () => {
    await database.create();
    await database.migrate();
    pool = new Pool({ connectionString: database.url });
    db = drizzle(pool) as unknown as DrizzleClient;
}, 600_000);

afterAll(async () => {
    await pool?.end();
    await database.drop();
});

type Vertical = 'venue' | 'experience' | 'accommodation';

const CHAT_LIMIT: Record<'venue' | 'experience', string> = {
    venue: 'max_ai_chat_venue_per_month',
    experience: 'max_ai_chat_experience_per_month'
};

const run = () =>
    db.transaction(async (tx) => up({ db: tx } as unknown as Parameters<typeof up>[0]));

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
            email: `hos2077-${crypto.randomUUID()}@example.com`,
            displayName: 'HOS-2077 fixture'
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

describe('HOS-2077 migration 0156 (real database)', () => {
    it('publishes Basic/Pro with chat, re-anchors live rows, leaves the rest alone, is idempotent', async () => {
        // Arrange
        const targets = [
            { vertical: 'venue', slug: 'venue-basico', quota: 20 },
            { vertical: 'venue', slug: 'venue-pro', quota: 100 },
            { vertical: 'experience', slug: 'experience-basico', quota: 20 },
            { vertical: 'experience', slug: 'experience-pro', quota: 100 }
        ] as const;
        const before = new Map<string, Awaited<ReturnType<typeof currentVersion>>>();
        const pricesBefore = new Map<string, Map<string, string>>();
        for (const target of targets) {
            const current = await currentVersion(target.vertical, target.slug);
            before.set(target.slug, current);
            const { entitlements, limits, options } = await effects(current.version.id);
            expect(
                entitlements.some((e) => e.key === 'ai_chat'),
                target.slug
            ).toBe(false);
            expect(limits.find((l) => l.key === CHAT_LIMIT[target.vertical])?.value).toBe(0);
            pricesBefore.set(
                target.slug,
                new Map(options.map((o) => [o.cycle, `${o.amount}/${o.currency}`]))
            );
        }
        const untouched = [
            await currentVersion('venue', 'venue-premium'),
            await currentVersion('experience', 'experience-premium'),
            await currentVersion('accommodation', 'owner-basico'),
            await currentVersion('accommodation', 'owner-pro')
        ];
        const oldVenueBasic = before.get('venue-basico')?.version;
        const oldVenuePro = before.get('venue-pro')?.version;
        const oldExperienceBasic = before.get('experience-basico')?.version;
        if (!oldVenueBasic || !oldVenuePro || !oldExperienceBasic) throw new Error('setup');

        const monthly = await anchor({
            vertical: 'venue',
            versionId: oldVenueBasic.id,
            cycle: 'monthly',
            status: 'ACTIVE'
        });
        const annual = await anchor({
            vertical: 'venue',
            versionId: oldVenueBasic.id,
            cycle: 'annual',
            status: 'ACTIVE'
        });
        const cancelled = await anchor({
            vertical: 'venue',
            versionId: oldVenueBasic.id,
            cycle: 'monthly',
            status: 'CANCELLED'
        });
        const pro = await anchor({
            vertical: 'venue',
            versionId: oldVenuePro.id,
            cycle: 'monthly',
            status: 'ACTIVE'
        });
        const experience = await anchor({
            vertical: 'experience',
            versionId: oldExperienceBasic.id,
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

        // Assert: a new current version per plan, with chat and the raised limit
        const after = new Map<string, Awaited<ReturnType<typeof currentVersion>>>();
        for (const target of targets) {
            const old = before.get(target.slug);
            const current = await currentVersion(target.vertical, target.slug);
            after.set(target.slug, current);
            expect(current.version.id, target.slug).not.toBe(old?.version.id);
            const [oldRow] = await db
                .select()
                .from(planVersions)
                .where(eq(planVersions.id, old?.version.id ?? ''));
            expect(oldRow?.current, target.slug).toBe(false);

            const oldEffects = await effects(old?.version.id ?? '');
            const { entitlements, limits, options } = await effects(current.version.id);
            const chat = entitlements.filter((e) => e.key === 'ai_chat');
            expect(chat, target.slug).toHaveLength(1);
            expect(chat[0]?.planQuota, target.slug).toBe(target.quota);
            expect(chat[0]?.trialQuota, target.slug).toBe(20);
            expect(limits.find((l) => l.key === CHAT_LIMIT[target.vertical])?.value).toBe(
                target.quota
            );
            // every other entitlement and limit is copied verbatim
            expect(entitlements.filter((e) => e.key !== 'ai_chat').map((e) => e.key)).toEqual(
                expect.arrayContaining(oldEffects.entitlements.map((e) => e.key))
            );
            expect(entitlements).toHaveLength(oldEffects.entitlements.length + 1);
            expect(
                new Map(
                    limits
                        .filter((l) => l.key !== CHAT_LIMIT[target.vertical])
                        .map((l) => [l.key, l.value])
                )
            ).toEqual(
                new Map(
                    oldEffects.limits
                        .filter((l) => l.key !== CHAT_LIMIT[target.vertical])
                        .map((l) => [l.key, l.value])
                )
            );
            expect(limits).toHaveLength(oldEffects.limits.length);
            // prices unchanged, per cycle
            expect(new Map(options.map((o) => [o.cycle, `${o.amount}/${o.currency}`]))).toEqual(
                pricesBefore.get(target.slug)
            );
        }

        // live rows moved with the cycle-matched option; the cancelled one stays
        const newVenueBasic = after.get('venue-basico')?.version;
        const newVenuePro = after.get('venue-pro')?.version;
        const newExperienceBasic = after.get('experience-basico')?.version;
        if (!newVenueBasic || !newVenuePro || !newExperienceBasic) throw new Error('published');
        const newBasicOptions = (await effects(newVenueBasic.id)).options;
        const cycleOf = (optionId: string | null | undefined) =>
            newBasicOptions.find((o) => o.id === optionId)?.cycle;
        const rows = await db
            .select()
            .from(subscriptions)
            .where(
                inArray(subscriptions.id, [
                    monthly.id,
                    annual.id,
                    cancelled.id,
                    pro.id,
                    experience.id
                ])
            );
        const byId = new Map(rows.map((r) => [r.id, r]));
        expect(byId.get(monthly.id)?.planVersionId).toBe(newVenueBasic.id);
        expect(cycleOf(byId.get(monthly.id)?.billingOptionId)).toBe('monthly');
        expect(byId.get(annual.id)?.planVersionId).toBe(newVenueBasic.id);
        expect(cycleOf(byId.get(annual.id)?.billingOptionId)).toBe('annual');
        expect(byId.get(cancelled.id)?.planVersionId).toBe(oldVenueBasic.id);
        expect(byId.get(pro.id)?.planVersionId).toBe(newVenuePro.id);
        expect(byId.get(experience.id)?.planVersionId).toBe(newExperienceBasic.id);

        const [queuedAfter] = await db
            .select()
            .from(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.id, queued.id));
        expect(queuedAfter?.targetPlanVersionId).toBe(newVenueBasic.id);
        expect(cycleOf(queuedAfter?.targetBillingOptionId)).toBe('annual');

        // Premium and accommodation keep their current version
        for (const { plan, version } of untouched) {
            const [stillCurrent] = await db
                .select()
                .from(planVersions)
                .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)));
            expect(stillCurrent?.id, plan.slug).toBe(version.id);
        }

        // Trial derivation input (`trial-ratchet.ts`): limits from the lowest-rank sellable
        // current version, entitlements from the highest-rank one.
        const reader = new PlanCatalogModel();
        for (const vertical of ['venue', 'experience'] as const) {
            const sellable = await reader.findSellableCurrentVersions({ vertical, tx: db });
            const lowest = sellable[0];
            const highest = sellable[sellable.length - 1];
            if (!lowest || !highest) throw new Error(`no sellable ${vertical} versions`);
            const lowestEffects = await reader.findPlanVersionEffects({ id: lowest.id, tx: db });
            const highestEffects = await reader.findPlanVersionEffects({ id: highest.id, tx: db });
            expect(
                lowestEffects.limits.find((l) => l.key === CHAT_LIMIT[vertical])?.value,
                vertical
            ).toBe(20);
            expect(
                highestEffects.entitlements.some((e) => e.key === 'ai_chat'),
                vertical
            ).toBe(true);
        }

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
        for (const target of targets) {
            const current = await currentVersion(target.vertical, target.slug);
            expect(current.version.id).toBe(after.get(target.slug)?.version.id);
        }
    });

    it('sweeps a straggler left on an older version when the current one already grants chat', async () => {
        // Arrange: a row pinned to the pre-HOS-2077 venue Basic version after the publication.
        const { plan } = await currentVersion('venue', 'venue-basico');
        const versions = await db
            .select()
            .from(planVersions)
            .where(eq(planVersions.planId, plan.id));
        const older = versions.find((v) => !v.current);
        const current = versions.find((v) => v.current);
        if (!older || !current) throw new Error('expected an older and a current version');
        const straggler = await anchor({
            vertical: 'venue',
            versionId: older.id,
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
});
