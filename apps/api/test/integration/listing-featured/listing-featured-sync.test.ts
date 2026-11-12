import {
    accommodationMedia,
    accommodations,
    addonInstances,
    destinations,
    eq,
    experiences,
    getDb,
    sql,
    users,
    venues
} from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    _resetRevalidationService,
    getRevalidationService,
    initializeRevalidationService
} from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDailyCoverageReconciler } from '../../../../../packages/verticals/src/publication/coverage-reconciler';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';
import {
    drainListingFeaturedSyncs,
    subscribeListingFeaturedSync
} from '../../../src/utils/listing-featured/featured-sync-listener';
import { getListingFeaturedPorts } from '../../../src/utils/listing-featured/listing-featured-ports';
import { createApiListingInverse } from '../../../src/utils/listing-publication/listing-inverse';
import { getListingReconcilerPorts } from '../../../src/utils/listing-publication/reconciler-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing
} from '../listing-publication/publication-routes.helpers';
import { deleteListingBoosts, seedListingBoost } from './support/featured-addon-fixtures';

const fixedNow = new Date('2026-10-12T05:00:00.000Z');
const nonAccommodationVerticals = [VerticalEnum.VENUE, VerticalEnum.EXPERIENCE] as const;
const created: {
    ownerIds: string[];
    destinationIds: string[];
    accommodations: string[];
    venues: string[];
    experiences: string[];
    instanceIds: string[];
} = {
    ownerIds: [],
    destinationIds: [],
    accommodations: [],
    venues: [],
    experiences: [],
    instanceIds: []
};
const mock = vi.hoisted(() => ({ revalidations: [] as unknown[] }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    const revalidationService = {
        scheduleRevalidation: (input: unknown) => mock.revalidations.push(input)
    };
    return {
        ...actual,
        getRevalidationService: () => revalidationService
    };
});

let stop: (() => void) | undefined;
let schedule: ReturnType<typeof vi.spyOn>;

async function owner(): Promise<string> {
    const result = await createOwner();
    created.ownerIds.push(result.id);
    return result.id;
}

async function destination(): Promise<string> {
    const id = await createVerticalDestination();
    created.destinationIds.push(id);
    return id;
}

async function boost(args: Parameters<typeof seedListingBoost>[0]): Promise<void> {
    const result = await seedListingBoost(args);
    created.instanceIds.push(result.instanceId);
}

async function notice(
    userId: string,
    vertical: VerticalEnum,
    sourceType: 'ADDON' | 'SUBSCRIPTION' = 'ADDON',
    change: 'ADDED' | 'REMOVED' | 'CHANGED' = 'ADDED'
): Promise<void> {
    await getCoverageNotices().emitCoverageChanged({ userId, vertical, sourceType, change });
    await drainListingFeaturedSyncs();
}

async function setFlag(vertical: VerticalEnum, id: string, value: boolean): Promise<void> {
    if (vertical === VerticalEnum.ACCOMMODATION)
        await getDb()
            .update(accommodations)
            .set({ featuredByEntitlement: value })
            .where(eq(accommodations.id, id));
    if (vertical === VerticalEnum.VENUE)
        await getDb().update(venues).set({ featuredByEntitlement: value }).where(eq(venues.id, id));
    if (vertical === VerticalEnum.EXPERIENCE)
        await getDb()
            .update(experiences)
            .set({ featuredByEntitlement: value })
            .where(eq(experiences.id, id));
}

async function featured(vertical: VerticalEnum, id: string): Promise<boolean> {
    const table =
        vertical === VerticalEnum.ACCOMMODATION
            ? 'accommodations'
            : vertical === VerticalEnum.VENUE
              ? 'venues'
              : 'experiences';
    const rows = await getDb().execute(
        sql`SELECT featured_by_entitlement AS featured FROM ${sql.identifier(table)} WHERE id = ${id}::uuid`
    );
    const row = rows.rows[0] as { featured: boolean } | undefined;
    if (!row) throw new Error('Expected listing row');
    return row.featured;
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => fixedNow } });
    initializeRevalidationService({ nodeEnv: 'test', siteUrl: 'http://localhost:4321' });
    const service = getRevalidationService();
    if (!service) throw new Error('Revalidation service was not initialized');
    schedule = vi.spyOn(service, 'scheduleRevalidation').mockImplementation((input) => {
        mock.revalidations.push(input);
    });
    stop = subscribeListingFeaturedSync();
});

beforeEach(() => {
    mock.revalidations = [];
    schedule.mockClear();
});

afterEach(async () => {
    stop && (await drainListingFeaturedSyncs());
    await deleteListingBoosts(created.instanceIds.splice(0));
    for (const id of created.accommodations.splice(0)) {
        await getDb().delete(accommodationMedia).where(eq(accommodationMedia.accommodationId, id));
        await getDb().delete(accommodations).where(eq(accommodations.id, id));
    }
    for (const id of created.venues.splice(0))
        await getDb().delete(venues).where(eq(venues.id, id));
    for (const id of created.experiences.splice(0))
        await getDb().delete(experiences).where(eq(experiences.id, id));
    for (const id of created.destinationIds.splice(0))
        await getDb().delete(destinations).where(eq(destinations.id, id));
    for (const id of created.ownerIds.splice(0)) {
        await getDb().execute(sql`DELETE FROM email_outbox WHERE recipient_user_id = ${id}::uuid`);
        await getDb().delete(users).where(eq(users.id, id));
    }
});

afterAll(async () => {
    stop?.();
    schedule?.mockRestore();
    _resetRevalidationService();
    await testDb.teardown();
});

describe('HOS-1718 a live LISTING boost features its listing on every public read', () => {
    it('the compare-and-set does not overwrite a flag changed after the listing snapshot', async () => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const id = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(id);
        let changed = false;
        // Act: model a writer that wins after listOwnerListings and before the CAS.
        await getListingFeaturedPorts().unitOfWork.runLocked(
            { userId, vertical: VerticalEnum.ACCOMMODATION },
            async (tx) => {
                const snapshot = await tx.listOwnerListings({
                    vertical: VerticalEnum.ACCOMMODATION,
                    ownerId: userId
                });
                expect(snapshot).toMatchObject([{ id, featured: false }]);
                await getDb()
                    .update(accommodations)
                    .set({ featuredByEntitlement: true })
                    .where(eq(accommodations.id, id));
                changed = await tx.setFeatured({
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: id,
                    from: false,
                    to: true
                });
            }
        );
        // Assert
        expect(changed).toBe(false);
        expect(await featured(VerticalEnum.ACCOMMODATION, id)).toBe(true);
    });

    it('a logically deleted listing is absent from the snapshot and is never written', async () => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const id = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(id);
        await getDb()
            .update(accommodations)
            .set({ deletedAt: fixedNow })
            .where(eq(accommodations.id, id));
        const writes: boolean[] = [];
        // Act
        await getListingFeaturedPorts().unitOfWork.runLocked(
            { userId, vertical: VerticalEnum.ACCOMMODATION },
            async (tx) => {
                const snapshot = await tx.listOwnerListings({
                    vertical: VerticalEnum.ACCOMMODATION,
                    ownerId: userId
                });
                for (const row of snapshot)
                    writes.push(
                        await tx.setFeatured({
                            vertical: VerticalEnum.ACCOMMODATION,
                            listingId: row.id,
                            from: row.featured,
                            to: true
                        })
                    );
                expect(snapshot.map(({ id: listingId }) => listingId)).toEqual([]);
            }
        );
        // Assert
        expect(writes).toEqual([]);
        expect(await featured(VerticalEnum.ACCOMMODATION, id)).toBe(false);
    });

    it('an ADDED notice features the boosted accommodation and schedules its revalidation', async () => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const id = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(id);
        const other = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(other);
        await boost({ ownerId: userId, listingId: id, vertical: VerticalEnum.ACCOMMODATION });
        // Act
        await notice(userId, VerticalEnum.ACCOMMODATION);
        // Assert
        expect(await featured(VerticalEnum.ACCOMMODATION, id)).toBe(true);
        expect(await featured(VerticalEnum.ACCOMMODATION, other)).toBe(false);
        expect(mock.revalidations).toMatchObject([{ entityType: 'accommodation', id }]);
    });

    it('A4 expires the boost and the flag drops', async () => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const id = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(id);
        const seeded = await seedListingBoost({
            ownerId: userId,
            listingId: id,
            vertical: VerticalEnum.ACCOMMODATION,
            endsAt: new Date(fixedNow.getTime() - 1000)
        });
        created.instanceIds.push(seeded.instanceId);
        await setFlag(VerticalEnum.ACCOMMODATION, id, true);
        // Act
        const { expireAddonInstances } = await import(
            '../../../../../packages/service-core/src/services/billing/addon/expire-addon-instances.service'
        );
        const result = await expireAddonInstances(10, {
            clock: { now: () => fixedNow },
            coverageNotices: getCoverageNotices(),
            listing: createApiListingInverse().listing
        });
        await drainListingFeaturedSyncs();
        // Assert
        expect(result.expired).toBe(1);
        expect(await featured(VerticalEnum.ACCOMMODATION, id)).toBe(false);
        expect(mock.revalidations).toMatchObject([{ id }]);
    });

    it('a boost past its end with no expiry run yet already reads as not featured', async () => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const id = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(id);
        await boost({
            ownerId: userId,
            listingId: id,
            vertical: VerticalEnum.ACCOMMODATION,
            endsAt: new Date(fixedNow.getTime() - 1000)
        });
        await setFlag(VerticalEnum.ACCOMMODATION, id, true);
        // Act
        await notice(userId, VerticalEnum.ACCOMMODATION, 'SUBSCRIPTION', 'CHANGED');
        // Assert
        expect(await featured(VerticalEnum.ACCOMMODATION, id)).toBe(false);
    });

    it('a withdrawn boost drops the flag', async () => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const id = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(id);
        const seeded = await seedListingBoost({
            ownerId: userId,
            listingId: id,
            vertical: VerticalEnum.ACCOMMODATION
        });
        created.instanceIds.push(seeded.instanceId);
        await setFlag(VerticalEnum.ACCOMMODATION, id, true);
        await getDb()
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(eq(addonInstances.id, seeded.instanceId));
        // Act
        await notice(userId, VerticalEnum.ACCOMMODATION, 'ADDON', 'REMOVED');
        // Assert
        expect(await featured(VerticalEnum.ACCOMMODATION, id)).toBe(false);
    });

    it('a LISTING addon that does not grant featured_listing features nothing', async () => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const id = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(id);
        await boost({
            ownerId: userId,
            listingId: id,
            vertical: VerticalEnum.ACCOMMODATION,
            grantsFeatured: false
        });
        // Act
        await notice(userId, VerticalEnum.ACCOMMODATION);
        // Assert
        expect(await featured(VerticalEnum.ACCOMMODATION, id)).toBe(false);
        expect(schedule).toHaveBeenCalledTimes(0);
        // Arrange: model a concurrent writer winning the compare-and-set.
        await setFlag(VerticalEnum.ACCOMMODATION, id, true);
        await getDb().execute(
            sql`CREATE OR REPLACE FUNCTION hos1718_suppress_featured_update() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF OLD.featured_by_entitlement = TRUE AND NEW.featured_by_entitlement = FALSE THEN RETURN NULL; END IF; RETURN NEW; END $body$`
        );
        await getDb().execute(
            sql`CREATE TRIGGER hos1718_suppress_featured_update BEFORE UPDATE ON accommodations FOR EACH ROW EXECUTE FUNCTION hos1718_suppress_featured_update()`
        );
        try {
            // Act: the lost CAS must not report a write or schedule revalidation.
            await notice(userId, VerticalEnum.ACCOMMODATION);
            // Assert
            expect(await featured(VerticalEnum.ACCOMMODATION, id)).toBe(true);
            expect(schedule).toHaveBeenCalledTimes(0);
        } finally {
            await getDb().execute(
                sql`DROP TRIGGER IF EXISTS hos1718_suppress_featured_update ON accommodations`
            );
            await getDb().execute(sql`DROP FUNCTION IF EXISTS hos1718_suppress_featured_update()`);
        }
    });

    it.each(
        nonAccommodationVerticals
    )("a venue boost features the venue and leaves the owner's accommodations alone: %s", async (vertical) => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const accommodationId = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(accommodationId);
        const id = await createVerticalListing({
            vertical,
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        if (vertical === VerticalEnum.VENUE) created.venues.push(id);
        else created.experiences.push(id);
        await boost({ ownerId: userId, listingId: id, vertical });
        // Act
        await notice(userId, vertical);
        // Assert
        expect(await featured(vertical, id)).toBe(true);
        expect(await featured(VerticalEnum.ACCOMMODATION, accommodationId)).toBe(false);
    });

    it("another owner's listing is never touched", async () => {
        // Arrange
        const ownerA = await owner();
        const ownerB = await owner();
        const destinationId = await destination();
        const listingA = await createListing({
            ownerId: ownerA,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(listingA);
        const listingB = await createListing({
            ownerId: ownerB,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(listingB);
        await setFlag(VerticalEnum.ACCOMMODATION, listingB, true);
        await boost({ ownerId: ownerA, listingId: listingA, vertical: VerticalEnum.ACCOMMODATION });
        // Act
        await notice(ownerA, VerticalEnum.ACCOMMODATION);
        // Assert
        expect(await featured(VerticalEnum.ACCOMMODATION, listingB)).toBe(true);
    });

    it('the daily reconciler clears a stale flag when the notice was lost', async () => {
        // Arrange
        const userId = await owner();
        const destinationId = await destination();
        const draftId = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        created.accommodations.push(draftId);
        const publishedId = await createListing({
            ownerId: userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(publishedId);
        await setFlag(VerticalEnum.ACCOMMODATION, draftId, true);
        // Act
        const summary = await runDailyCoverageReconciler({ ports: getListingReconcilerPorts() });
        // Assert
        const rows = await getDb()
            .select({ id: accommodations.id, featured: accommodations.featuredByEntitlement })
            .from(accommodations)
            .where(eq(accommodations.ownerId, userId))
            .orderBy(accommodations.id);
        expect(rows).toEqual(
            [
                { id: draftId, featured: false },
                { id: publishedId, featured: false }
            ].sort((a, b) => a.id.localeCompare(b.id))
        );
        expect(summary.featuredChanged).toBe(1);
        // shouldRun is true because coverage is uncovered and one listing is PUBLISHED; featured reconciliation precedes and does not depend on publication changes.
        const inverseOwnerId = await owner();
        const inverseListingId = await createListing({
            ownerId: inverseOwnerId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        created.accommodations.push(inverseListingId);
        await boost({
            ownerId: inverseOwnerId,
            listingId: inverseListingId,
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Act: no notice is emitted; the daily pass must discover the boost.
        const inverse = await runDailyCoverageReconciler({ ports: getListingReconcilerPorts() });
        // Assert
        expect(inverse.featuredChanged).toBe(1);
        const inverseRows = await getDb()
            .select({ id: accommodations.id, featured: accommodations.featuredByEntitlement })
            .from(accommodations)
            .where(eq(accommodations.ownerId, inverseOwnerId))
            .orderBy(accommodations.id);
        expect(inverseRows).toEqual([{ id: inverseListingId, featured: true }]);
    });
});
