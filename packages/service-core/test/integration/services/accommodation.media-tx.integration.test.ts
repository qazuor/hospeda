/**
 * Regression tests for SPEC-204 FIX 1 — T-011h / T-011i
 *
 * Before the fix, `AccommodationService.create()` and `update()` only opened a
 * transaction when `amenityIds` or `featureIds` were present in the payload.
 * A media-only payload skipped the transaction, so `_afterCreate`/`_afterUpdate`
 * reached the `!ctx.tx` guard and threw `INTERNAL_ERROR` instead of syncing rows.
 *
 * These tests reproduce the exact failure path (B-1):
 *   T-011-h  — create() with a `media` payload and NO junction fields succeeds
 *              and writes rows to `accommodation_media`.
 *   T-011-i  — update() with a `media`-only payload (no junction fields) succeeds
 *              and does NOT write `accommodation_media` (SPEC-204 cutover: the
 *              gallery is managed by the granular media endpoints, not the bulk
 *              update path).
 *
 * IMPORTANT: The bug only manifests when the service opens its OWN transaction
 * (i.e. no external ctx.tx). Therefore these tests do NOT use
 * `withServiceTestTransaction` and do NOT pass `ctx = { tx }` to the service.
 * Instead, seed data is inserted COMMITTED to the DB and manually cleaned up
 * in afterEach so the service's self-managed transaction can see the seed rows.
 */
import { accommodationMedia, accommodations, destinations, eq, users } from '@repo/db';
import type { AccommodationCreateInput, AccommodationUpdateInput } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';

const dbAvailable = isServiceTestDbAvailable();

// ---------------------------------------------------------------------------
// Shared actor + service
// ---------------------------------------------------------------------------

let service: AccommodationService;

beforeAll(() => {
    if (!dbAvailable) return;
    getServiceTestDb();
    service = new AccommodationService({ logger: createLoggerMock() });
});

afterAll(async () => {
    if (!dbAvailable) return;
    await closeServiceTestPool();
});

// ---------------------------------------------------------------------------
// Cleanup tracking: IDs to hard-delete after each test (committed rows)
// ---------------------------------------------------------------------------

/** IDs seeded / created in the current test — cleaned up in afterEach. */
const cleanup: {
    accommodationIds: string[];
    destinationIds: string[];
    userIds: string[];
} = {
    accommodationIds: [],
    destinationIds: [],
    userIds: []
};

afterEach(async () => {
    if (!dbAvailable) return;
    const db = getServiceTestDb();

    // Delete in FK-safe order: accommodation_media rows cascade when the
    // accommodation row is hard-deleted (FK ON DELETE CASCADE).
    for (const id of cleanup.accommodationIds) {
        await db.delete(accommodations).where(eq(accommodations.id, id));
    }
    for (const id of cleanup.destinationIds) {
        await db.delete(destinations).where(eq(destinations.id, id));
    }
    for (const id of cleanup.userIds) {
        await db.delete(users).where(eq(users.id, id));
    }
    cleanup.accommodationIds.length = 0;
    cleanup.destinationIds.length = 0;
    cleanup.userIds.length = 0;
});

// ---------------------------------------------------------------------------
// Seed helpers — committed inserts (no rollback tx)
// ---------------------------------------------------------------------------

/**
 * Seeds a committed User + Destination pair visible to the service's own tx.
 * Returns their IDs and registers them for afterEach cleanup.
 */
async function seedCommittedUserAndDestination(): Promise<{
    userId: string;
    destinationId: string;
}> {
    const db = getServiceTestDb();
    const userId = crypto.randomUUID();
    const destinationId = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await db.insert(users).values({
        id: userId,
        email: `media-tx-owner-${uid}@example.com`,
        displayName: 'Media TX Owner',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await db.insert(destinations).values({
        id: destinationId,
        slug: `media-tx-dest-${uid}`,
        name: 'Media TX Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/media-tx/dest-${uid}`,
        summary: 'Media TX destination summary',
        description: 'Media TX destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/media-tx-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);

    // Register for cleanup
    cleanup.userIds.push(userId);
    cleanup.destinationIds.push(destinationId);

    return { userId, destinationId };
}

/**
 * Seeds a committed Accommodation row (no media rows yet).
 * Registers it for afterEach cleanup.
 */
async function seedCommittedAccommodation(opts: {
    userId: string;
    destinationId: string;
}): Promise<{ accommodationId: string }> {
    const db = getServiceTestDb();
    const accommodationId = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await db.insert(accommodations).values({
        id: accommodationId,
        slug: `media-tx-acc-${uid}`,
        name: 'Media TX Accommodation',
        summary: 'Media TX accommodation summary',
        description: 'Media TX accommodation description',
        type: 'HOTEL',
        ownerId: opts.userId,
        destinationId: opts.destinationId,
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/media-tx-accommodation.jpg'
            }
        },
        lifecycleState: 'ACTIVE',
        visibility: 'PUBLIC',
        ownerSuspended: false
    } as typeof accommodations.$inferInsert);

    cleanup.accommodationIds.push(accommodationId);

    return { accommodationId };
}

// ---------------------------------------------------------------------------
// Minimal media fixture (valid JSONB structure)
// ---------------------------------------------------------------------------

const MEDIA_PAYLOAD = {
    featuredImage: {
        url: 'https://cdn.example.com/regression-featured.jpg',
        moderationState: 'APPROVED' as const
    },
    gallery: [
        {
            url: 'https://cdn.example.com/regression-gal-0.jpg',
            moderationState: 'APPROVED' as const
        }
    ]
};

// ---------------------------------------------------------------------------
// T-011-h — create() media-only: must NOT throw INTERNAL_ERROR
// ---------------------------------------------------------------------------

describe('SPEC-204 FIX 1 regression — AccommodationService media-only tx', () => {
    it.skipIf(!dbAvailable)(
        'T-011-h: create() with media payload and no junction fields succeeds and writes accommodation_media rows',
        async () => {
            // Arrange: seed destination + owner COMMITTED so the service's own
            // tx can see them when it calls _assertDestinationIsCity.
            const { userId, destinationId } = await seedCommittedUserAndDestination();
            const actor = createSuperAdminActor({ id: userId });

            const createInput = {
                name: 'Media-Only Regression Hotel',
                slug: `media-only-regression-${crypto.randomUUID().slice(0, 8)}`,
                summary: 'Regression test accommodation for SPEC-204 FIX 1',
                description: 'Tests that a media-only create payload opens a transaction.',
                type: 'HOTEL',
                ownerId: userId,
                destinationId,
                location: {
                    state: 'Entre Rios',
                    country: 'Argentina',
                    coordinates: { lat: '-32.48', long: '-58.23' }
                },
                media: MEDIA_PAYLOAD,
                lifecycleState: 'DRAFT',
                visibility: 'PRIVATE'
                // Intentionally NO amenityIds or featureIds — pure media payload.
            } as unknown as AccommodationCreateInput;

            // Act — no ctx.tx so the service must open its own transaction.
            // Before FIX 1, this threw ServiceError(INTERNAL_ERROR) because
            // needsMedia was not included in the needsTx condition.
            const result = await service.create(actor, createInput);

            // Assert: no error, accommodation created
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            if (!result.data) throw new Error('expected result.data to be defined');

            const accommodationId = result.data.id;
            // Register for cleanup (created by service, not manually seeded)
            cleanup.accommodationIds.push(accommodationId);

            // Assert: accommodation_media rows were written (1 featured + 1 gallery)
            const db = getServiceTestDb();
            const rows = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, accommodationId));

            expect(rows.length).toBe(2);

            const featured = rows.find((r) => r.isFeatured);
            expect(featured).toBeDefined();
            expect(featured?.url).toBe('https://cdn.example.com/regression-featured.jpg');
            expect(featured?.state).toBe('visible');

            const gallery = rows.find((r) => !r.isFeatured);
            expect(gallery).toBeDefined();
            expect(gallery?.url).toBe('https://cdn.example.com/regression-gal-0.jpg');
            expect(gallery?.state).toBe('visible');
        }
    );

    // -----------------------------------------------------------------------
    // T-011-i — update() media-only: must NOT throw INTERNAL_ERROR
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-011-i: update() with media-only payload succeeds and does NOT write accommodation_media rows (gallery managed by granular endpoints)',
        async () => {
            // Arrange: seed user + destination + accommodation COMMITTED.
            const { userId, destinationId } = await seedCommittedUserAndDestination();
            const { accommodationId } = await seedCommittedAccommodation({ userId, destinationId });
            const actor = createSuperAdminActor({ id: userId });

            const updatedMedia = {
                featuredImage: {
                    url: 'https://cdn.example.com/update-regression-featured.jpg',
                    moderationState: 'APPROVED' as const
                }
                // No gallery — just a featured image update
            };

            const updateInput = {
                media: updatedMedia
                // Intentionally NO amenityIds or featureIds — pure media payload.
            } as AccommodationUpdateInput;

            // Act — no ctx.tx so the service must open its own transaction.
            // Before FIX 1, this threw ServiceError(INTERNAL_ERROR).
            const result = await service.update(actor, accommodationId, updateInput);

            // Assert: no error, accommodation updated
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();

            // SPEC-204 cutover: UPDATE no longer manages the gallery, so a
            // media-only update must NOT write any accommodation_media rows.
            // The accommodation was seeded without media rows; it stays empty.
            const db = getServiceTestDb();
            const rows = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, accommodationId));

            expect(rows.length).toBe(0);
        }
    );
});
