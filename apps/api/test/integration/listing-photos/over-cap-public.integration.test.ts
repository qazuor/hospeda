/**
 * Over-cap photos are hidden publicly and come back (HOS-2495 T-032, AC-14,
 * AC-15, AC-18).
 *
 * A real venue with a cover and 20 approved gallery rows is read through the
 * real public route. Only the owner's effective set is injected (what T-030
 * resolves from real catalog rows): cap 15, then 35 after a pack, then 15 again
 * when it expires. Every change is announced with a real coverage notice, and
 * the real gallery revalidation listener evicts the cached responses, so the
 * next read already shows the new gallery. No gallery row is ever written.
 */
import { asc, eq, getDb, venueMedia, venues } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock } from '../../../src/utils/clock';
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
    photoCap: 15,
    revalidations: [] as { entityType: string; id: string }[]
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    getRevalidationService: () => ({
        scheduleRevalidation: (input: { entityType: string; id: string }) =>
            state.revalidations.push(input)
    })
}));

vi.mock('../../../src/utils/listing-access/ports', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/listing-access/ports')>();
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
            }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: true,
                    inheritsTouristVip: false,
                    entries: [
                        { key: 'max_photos_per_venue', value: state.photoCap, strategy: 'SUM' }
                    ]
                })
        })
    };
});

const now = new Date('2026-11-20T12:00:00.000Z');
const cleanup: { venueId: string }[] = [];
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

async function coverageChanged(ownerId: string, photoCap: number) {
    state.photoCap = photoCap;
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
    stop = subscribeListingGalleryRevalidation();
});
afterEach(async () => {
    state.photoCap = 15;
    state.revalidations.length = 0;
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
    it('shows 15 of 20 at cap 15, 20 after a pack, 15 again when it expires; rows never change', async () => {
        // Arrange
        const { ownerId, venueId, slug } = await seedVenueWithGallery(20);
        const rowsBefore = await galleryRows(venueId);

        // Act + Assert: cap 15.
        const capped = await readPublic(slug);
        expect(capped.status).toBe(200);
        expect(capped.media.gallery.map(({ url }) => url)).toEqual(urls(15));
        expect(capped.media.featuredImage?.url).toBe('https://example.test/matrix.jpg');

        // Act + Assert: a pack (+20) lands, the notice purges, all 20 are back.
        await coverageChanged(ownerId, 35);
        expect(state.revalidations.map(({ entityType, id }) => ({ entityType, id }))).toEqual([
            { entityType: 'venue', id: venueId }
        ]);
        const restored = await readPublic(slug);
        expect(restored.media.gallery.map(({ url }) => url)).toEqual(urls(20));

        // Act + Assert: the pack expires, the same 15 are shown again.
        await coverageChanged(ownerId, 15);
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
        await coverageChanged(ownerId, 30);

        // Assert
        expect(state.revalidations).toEqual([]);
    });
});
