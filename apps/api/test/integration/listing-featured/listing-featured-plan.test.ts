import { randomUUID } from 'node:crypto';
import {
    accommodationMedia,
    accommodations,
    billingOptions,
    destinations,
    eq,
    getDb,
    payments,
    plans,
    planVersionEntitlements,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { runDailyCoverageReconciler } from '../../../../../packages/verticals/src/publication/coverage-reconciler';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';
import {
    drainListingFeaturedSyncs,
    subscribeListingFeaturedSync
} from '../../../src/utils/listing-featured/featured-sync-listener';
import { getListingReconcilerPorts } from '../../../src/utils/listing-publication/reconciler-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination
} from '../listing-publication/publication-routes.helpers';
import { deleteListingBoosts, seedListingBoost } from './support/featured-addon-fixtures';

const now = new Date('2026-10-12T05:00:00.000Z');
const state = vi.hoisted(() => ({ revalidations: [] as unknown[] }));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    getRevalidationService: () => ({
        scheduleRevalidation: (input: unknown) => state.revalidations.push(input)
    })
}));
interface Fixture {
    ownerId: string;
    destinationId: string;
    listingIds: string[];
    instanceIds: string[];
    planId?: string;
    versionIds: string[];
    optionIds: string[];
    subscriptionIds: string[];
    paymentIds: string[];
}
const fixtures: Fixture[] = [];
let stop: (() => void) | undefined;

async function fixture(): Promise<Fixture> {
    const owner = await createOwner();
    const destinationId = await createVerticalDestination();
    const value: Fixture = {
        ownerId: owner.id,
        destinationId,
        listingIds: [],
        instanceIds: [],
        versionIds: [],
        optionIds: [],
        subscriptionIds: [],
        paymentIds: []
    };
    fixtures.push(value);
    return value;
}
async function plan(f: Fixture, grants: boolean): Promise<string> {
    const db = getDb();
    const [catalogPlan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `hos1718-plan-${randomUUID()}`,
            name: 'Featured plan'
        })
        .returning({ id: plans.id });
    if (!catalogPlan) throw new Error('Expected plan');
    f.planId = catalogPlan.id;
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: catalogPlan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: 1,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    f.versionIds.push(version.id);
    const entitlements = grants
        ? ['featured_listing', 'publish_accommodations', 'edit_accommodation_info', 'write_reviews']
        : ['publish_accommodations', 'edit_accommodation_info', 'write_reviews'];
    await db.insert(planVersionEntitlements).values(
        entitlements.map((key) => ({
            planVersionId: version.id,
            key,
            planQuota: null,
            trialQuota: null
        }))
    );
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    f.optionIds.push(option.id);
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: f.ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('Expected subscription');
    f.subscriptionIds.push(subscription.id);
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId: subscription.id,
            amount: 250000,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'fake',
            providerFactId: `hos1718-${randomUUID()}`,
            factAt: now
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Expected payment');
    f.paymentIds.push(payment.id);
    return version.id;
}
async function listing(f: Fixture): Promise<string> {
    const id = await createListing({
        ownerId: f.ownerId,
        destinationId: f.destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    f.listingIds.push(id);
    return id;
}
async function featured(id: string): Promise<boolean> {
    const [row] = await getDb()
        .select({ featured: accommodations.featuredByEntitlement })
        .from(accommodations)
        .where(eq(accommodations.id, id));
    if (!row) throw new Error('Expected listing');
    return row.featured;
}
async function notice(f: Fixture): Promise<void> {
    await getCoverageNotices().emitCoverageChanged({
        userId: f.ownerId,
        vertical: VerticalEnum.ACCOMMODATION,
        sourceType: 'SUBSCRIPTION',
        change: 'CHANGED'
    });
    await drainListingFeaturedSyncs();
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
    stop = subscribeListingFeaturedSync();
});
afterEach(async () => {
    state.revalidations.length = 0;
    for (const f of fixtures.splice(0)) {
        await deleteListingBoosts(f.instanceIds);
        if (f.paymentIds.length)
            await getDb()
                .delete(payments)
                .where(eq(payments.subscriptionId, f.subscriptionIds[0] ?? ''));
        if (f.subscriptionIds.length)
            await getDb()
                .delete(subscriptions)
                .where(eq(subscriptions.id, f.subscriptionIds[0] ?? ''));
        if (f.optionIds.length)
            await getDb()
                .delete(billingOptions)
                .where(eq(billingOptions.id, f.optionIds[0] ?? ''));
        if (f.versionIds.length)
            await getDb()
                .delete(planVersions)
                .where(eq(planVersions.id, f.versionIds[0] ?? ''));
        if (f.planId) await getDb().delete(plans).where(eq(plans.id, f.planId));
        for (const id of f.listingIds) {
            await getDb()
                .delete(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, id));
            await getDb().delete(accommodations).where(eq(accommodations.id, id));
        }
        await getDb().delete(destinations).where(eq(destinations.id, f.destinationId));
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE recipient_user_id = ${f.ownerId}::uuid`
        );
        await getDb().delete(users).where(eq(users.id, f.ownerId));
    }
});
afterAll(async () => {
    stop?.();
    await testDb.teardown();
});

describe('HOS-1718 a plan with featured_listing features the owner listings on every public read', () => {
    it('a notice for an owner with a featured plan features all their accommodations', async () => {
        const f = await fixture();
        await plan(f, true);
        const first = await listing(f);
        const second = await listing(f);
        await notice(f);
        expect(await featured(first)).toBe(true);
        expect(await featured(second)).toBe(true);
        expect(state.revalidations).toHaveLength(2);
    });
    it('when the subscription ends only the boosted listing stays featured', async () => {
        const f = await fixture();
        await plan(f, true);
        const boosted = await listing(f);
        const planOnly = await listing(f);
        const boost = await seedListingBoost({
            ownerId: f.ownerId,
            listingId: boosted,
            vertical: VerticalEnum.ACCOMMODATION
        });
        f.instanceIds.push(boost.instanceId);
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, f.subscriptionIds[0] ?? ''));
        await notice(f);
        expect(await featured(boosted)).toBe(true);
        expect(await featured(planOnly)).toBe(false);
    });
    it('the daily reconciler keeps a plan-featured listing on', async () => {
        const f = await fixture();
        await plan(f, true);
        const id = await listing(f);
        await getDb()
            .update(accommodations)
            .set({ featuredByEntitlement: true })
            .where(eq(accommodations.id, id));
        const summary = await runDailyCoverageReconciler({ ports: getListingReconcilerPorts() });
        expect(await featured(id)).toBe(true);
        expect(summary.featuredChanged).toBe(0);
    });
    it('a plan without featured_listing features nothing', async () => {
        const f = await fixture();
        await plan(f, false);
        const id = await listing(f);
        await notice(f);
        expect(await featured(id)).toBe(false);
        expect(state.revalidations).toHaveLength(0);
    });
});
