/**
 * Over-cap photos are hidden publicly and come back (HOS-2495 T-032, AC-14,
 * AC-15, AC-18).
 *
 * A real venue with a cover and 20 approved gallery rows is read through the
 * real public route. The owner's effective set is the PRODUCTION one: the real
 * `readEffectiveSet` over real plan and add-on catalog rows, folded from a
 * coverage simulator, and cached in the production snapshot cache (a functional
 * in-memory stand-in for Redis only). The cap is never stated by the test: a
 * pack is added or removed from the owner's coverage and a real coverage notice
 * is emitted. The first read leaves a snapshot cached, so the gallery can only
 * change if the real revalidation listener invalidates it. No gallery row is
 * ever written.
 */
import { randomUUID } from 'node:crypto';
import { type CoverageSource, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import type { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import {
    addons,
    addonVersionLimits,
    addonVersions,
    asc,
    eq,
    getDb,
    plans,
    planVersionLimits,
    planVersions,
    venueMedia,
    venues
} from '@repo/db';
import {
    LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL,
    PublicationStatusEnum,
    VerticalEnum
} from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock } from '../../../src/utils/clock';
import { peekEffectiveSetForUser } from '../../../src/utils/effective-set-cache';
import { validateApiEnv } from '../../../src/utils/env';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';
import {
    drainListingGalleryRevalidations,
    subscribeListingGalleryRevalidation
} from '../../../src/utils/listing-media/gallery-coverage-revalidation';
import { testDb } from '../../e2e/setup/test-database';
import {
    createOwner,
    createVerticalDestination,
    createVerticalListing
} from '../listing-publication/publication-routes.helpers';

const state = vi.hoisted(() => ({
    billing: undefined as BillingForVerticalsSimulator | undefined,
    redis: new Map<string, string>(),
    revalidations: [] as { entityType: string; id: string }[]
}));

/** The ioredis operations the effective-set snapshot cache uses, in memory. */
vi.mock('../../../src/utils/redis', () => ({
    getRedisClient: async () => ({
        get: async (key: string) => state.redis.get(key) ?? null,
        hget: async (key: string, field: string) => state.redis.get(`${key}#${field}`) ?? null,
        hset: async (key: string, field: string, value: string) => {
            state.redis.set(`${key}#${field}`, value);
            return 1;
        },
        pexpire: async () => 1,
        incr: async (key: string) => {
            const next = Number(state.redis.get(key) ?? '0') + 1;
            state.redis.set(key, String(next));
            return next;
        }
    })
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    getRevalidationService: () => ({
        scheduleRevalidation: (input: { entityType: string; id: string }) =>
            state.revalidations.push(input)
    })
}));

/** Production `readEffectiveSet` and snapshot cache; only the coverage is simulated. */
vi.mock('../../../src/utils/listing-access/ports', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/listing-access/ports')>();
    const { planCatalogModel } = await import('@repo/db');
    const { effectiveSetSnapshotCodec, readEffectiveSet } = await import('@repo/verticals');
    const { createApiEffectiveSetCache } = await import('../../../src/utils/effective-set-cache');
    let cache: ReturnType<typeof createApiEffectiveSetCache<unknown>> | undefined;
    return {
        ...actual,
        getListingAccessPorts: () => ({
            ...actual.getListingAccessPorts(),
            effectiveSet: async ({
                userId,
                vertical
            }: {
                userId: string;
                vertical: VerticalEnum;
            }) => {
                cache ??= createApiEffectiveSetCache(effectiveSetSnapshotCodec);
                return readEffectiveSet({
                    reader: planCatalogModel,
                    billing: state.billing as BillingForVerticalsSimulator,
                    trials: { findTrial: async () => null },
                    userId,
                    vertical,
                    cache: cache as never
                });
            }
        })
    };
});

const now = new Date('2026-11-20T12:00:00.000Z');
const SINCE = new Date('2026-10-01T00:00:00.000Z');
const PHOTO_KEY = LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL[VerticalEnum.VENUE];
const cleanup: { venueId: string }[] = [];

/**
 * A 15-photo venue plan version and a +20 photo pack version, as real catalog rows.
 * Catalog rows are immutable once committed, so they stay in the throwaway test
 * database, which the global teardown drops.
 */
async function seedCatalog() {
    return getDb().transaction(async (db) => {
        const [plan] = await db
            .insert(plans)
            .values({
                vertical: VerticalEnum.VENUE,
                slug: `hos2495-${randomUUID()}`,
                name: 'Photo plan'
            })
            .returning({ id: plans.id });
        const planId = (plan as { id: string }).id;
        const [planVersion] = await db
            .insert(planVersions)
            .values({
                planId,
                vertical: VerticalEnum.VENUE,
                rank: Math.floor(Math.random() * 100_000_000) + 1_000,
                sellable: false,
                current: false,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        const planVersionId = (planVersion as { id: string }).id;
        await db.insert(planVersionLimits).values({ planVersionId, key: PHOTO_KEY, value: 15 });
        const [addon] = await db
            .insert(addons)
            .values({ slug: `hos2495-pack-${randomUUID()}`, name: 'Photo pack' })
            .returning({ id: addons.id });
        const addonId = (addon as { id: string }).id;
        const [addonVersion] = await db
            .insert(addonVersions)
            .values({
                addonId,
                validity: 'WHILE_SUBSCRIPTION_ALIVE',
                validityDays: null,
                scopeType: 'VERTICAL_SUBSCRIPTION'
            })
            .returning({ id: addonVersions.id });
        const addonVersionId = (addonVersion as { id: string }).id;
        await db.insert(addonVersionLimits).values({ addonVersionId, key: PHOTO_KEY, value: 20 });
        return { planVersionId, addonVersionId };
    });
}

const subscription = (planVersionId: string): CoverageSource =>
    CoverageSourceSchema.parse({
        type: 'SUBSCRIPTION',
        reference: { kind: 'PLAN_VERSION', planVersionId },
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: 'NO_KNOWN_DATE',
        charged: true,
        floor: null
    });

const pack = (addonVersionId: string): CoverageSource =>
    CoverageSourceSchema.parse({
        type: 'ADDON',
        reference: { kind: 'ADDON_VERSION', addonVersionId },
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: 'NO_KNOWN_DATE',
        charged: null,
        floor: null
    });
let stop: (() => void) | undefined;

async function seedVenueWithGallery(count: number) {
    const owner = await createOwner();
    const destinationId = await createVerticalDestination();
    // `complete` (the default) adds the featured cover row.
    const venueId = await createVerticalListing({
        vertical: VerticalEnum.VENUE,
        ownerId: owner.id,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    if (count > 0) {
        await getDb()
            .insert(venueMedia)
            .values(
                Array.from({ length: count }, (_, index) => ({
                    venueId,
                    url: `https://example.test/hos2495-${index}.jpg`,
                    moderationState: 'APPROVED' as const,
                    state: 'visible' as const,
                    isFeatured: false,
                    sortOrder: index + 1
                }))
            );
    }
    const [row] = await getDb()
        .select({ slug: venues.slug })
        .from(venues)
        .where(eq(venues.id, venueId));
    cleanup.push({ venueId });
    return { ownerId: owner.id, venueId, slug: (row as { slug: string }).slug };
}

async function readPublic(slug: string) {
    const response = await initApp().request(`/api/v1/public/venues/slug/${slug}`, {
        headers: { 'user-agent': 'vitest' }
    });
    const body = (await response.json()) as {
        data: { media: { featuredImage: { url: string } | null; gallery: { url: string }[] } };
    };
    return { status: response.status, media: body.data.media };
}

async function galleryRows(venueId: string) {
    return getDb()
        .select({ url: venueMedia.url, state: venueMedia.state, sortOrder: venueMedia.sortOrder })
        .from(venueMedia)
        .where(eq(venueMedia.venueId, venueId))
        .orderBy(asc(venueMedia.sortOrder));
}

/** Sets the owner's covered sources, then announces it as billing does. */
async function coverageChanged(ownerId: string, sources: readonly CoverageSource[]) {
    state.billing?.setCoverage({
        userId: ownerId,
        vertical: VerticalEnum.VENUE,
        response: { covered: true, sources: [...sources] }
    });
    await getCoverageNotices().emitCoverageChanged({
        userId: ownerId,
        vertical: VerticalEnum.VENUE,
        sourceType: 'ADDON',
        change: 'CHANGED'
    });
    await drainListingGalleryRevalidations();
}

const urls = (count: number) =>
    Array.from({ length: count }, (_, index) => `https://example.test/hos2495-${index}.jpg`);

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
    const { BillingForVerticalsSimulator } = await import(
        '@repo/billing-verticals-contract/testing'
    );
    state.billing = new BillingForVerticalsSimulator();
    stop = subscribeListingGalleryRevalidation();
});
afterEach(async () => {
    state.revalidations.length = 0;
    state.redis.clear();
    for (const { venueId } of cleanup.splice(0)) {
        await getDb().delete(venueMedia).where(eq(venueMedia.venueId, venueId));
        await getDb().delete(venues).where(eq(venues.id, venueId));
    }
});
afterAll(async () => {
    stop?.();
    await testDb.teardown();
});

describe('HOS-2495 over-cap photos are hidden publicly and reappear', () => {
    it('shows 15 of 20 at the plan cap, 20 after a pack, 15 again when it expires; rows never change', async () => {
        // Arrange: a real plan (15) and pack (+20) in the catalog; the owner holds the plan.
        const { planVersionId, addonVersionId } = await seedCatalog();
        const { ownerId, venueId, slug } = await seedVenueWithGallery(20);
        state.billing?.setCoverage({
            userId: ownerId,
            vertical: VerticalEnum.VENUE,
            response: { covered: true, sources: [subscription(planVersionId)] }
        });
        const rowsBefore = await galleryRows(venueId);

        // Act + Assert: plan cap 15, and the first read leaves a snapshot cached.
        const capped = await readPublic(slug);
        expect(capped.status).toBe(200);
        expect(capped.media.gallery.map(({ url }) => url)).toEqual(urls(15));
        expect(capped.media.featuredImage?.url).toBe('https://example.test/matrix.jpg');
        expect(await peekEffectiveSetForUser({ userId: ownerId, vertical: 'venue' })).toBeDefined();

        // Act + Assert: a pack (+20) is covered and the notice leaves; the stale
        // snapshot is evicted, the cap folds to 35 and all 20 are back.
        await coverageChanged(ownerId, [subscription(planVersionId), pack(addonVersionId)]);
        expect(state.revalidations.map(({ entityType, id }) => ({ entityType, id }))).toEqual([
            { entityType: 'venue', id: venueId }
        ]);
        const restored = await readPublic(slug);
        expect(restored.media.gallery.map(({ url }) => url)).toEqual(urls(20));
        expect(await peekEffectiveSetForUser({ userId: ownerId, vertical: 'venue' })).toBeDefined();

        // Act + Assert: the pack expires, the same 15 are shown again.
        await coverageChanged(ownerId, [subscription(planVersionId)]);
        const again = await readPublic(slug);
        expect(again.media.gallery.map(({ url }) => url)).toEqual(urls(15));
        expect(again.media.featuredImage?.url).toBe('https://example.test/matrix.jpg');

        // Assert: no gallery row was moved, hidden or deleted (20 + the cover).
        expect(rowsBefore).toHaveLength(21);
        expect(await galleryRows(venueId)).toEqual(rowsBefore);
    });

    it('purges nothing for an owner whose only listing is a DRAFT', async () => {
        // Arrange
        const { ownerId, venueId } = await seedVenueWithGallery(2);
        await getDb()
            .update(venues)
            .set({ publicationStatus: PublicationStatusEnum.DRAFT })
            .where(eq(venues.id, venueId));

        // Act
        await coverageChanged(ownerId, []);

        // Assert
        expect(state.revalidations).toEqual([]);
    });
});
