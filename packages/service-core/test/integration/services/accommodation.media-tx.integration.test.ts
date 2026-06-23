/**
 * Regression tests for SPEC-204 FIX 1 — T-011h / T-011i
 *
 * Before the fix, `AccommodationService.create()` and `update()` only opened a
 * transaction when `amenityIds` or `featureIds` were present in the payload.
 * A media-only payload skipped the transaction, so `_afterCreate`/`_afterUpdate`
 * reached the `!ctx.tx` guard and threw `INTERNAL_ERROR` instead of syncing rows.
 *
 * These tests reproduce the exact failure path:
 *   T-011-h  — create() with a `media` payload and NO junction fields succeeds
 *              and writes rows to `accommodation_media`.
 *   T-011-i  — update() with a `media`-only payload (no junction fields) succeeds
 *              and syncs the `accommodation_media` table.
 *
 * Each test runs inside `withServiceTestTransaction` (always rolled back).
 */
import { accommodationMedia, eq } from '@repo/db';
import type { AccommodationCreateInput, AccommodationUpdateInput } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers';

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
            await withServiceTestTransaction(async (tx) => {
                // Arrange: seed destination + owner but NOT the accommodation itself —
                // we let the service create it below.
                const { userId, destinationId } = await seedAccommodation(tx);

                const actor = createSuperAdminActor({ id: userId });
                const ctx: ServiceContext = { tx };

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

                // Act — before FIX 1 this threw ServiceError(INTERNAL_ERROR).
                const result = await service.create(actor, createInput, ctx);

                // Assert: no error, accommodation created
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data to be defined');

                const accommodationId = result.data.id;

                // Assert: accommodation_media rows were written (1 featured + 1 gallery)
                const rows = await tx
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
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-011-i — update() media-only: must NOT throw INTERNAL_ERROR
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-011-i: update() with media-only payload and no junction fields succeeds and syncs accommodation_media rows',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: seed a full accommodation (already has a row in accommodations)
                const { accommodationId, userId } = await seedAccommodation(tx);

                const actor = createSuperAdminActor({ id: userId });
                const ctx: ServiceContext = { tx };

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

                // Act — before FIX 1 this threw ServiceError(INTERNAL_ERROR).
                const result = await service.update(actor, accommodationId, updateInput, ctx);

                // Assert: no error, accommodation updated
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();

                // Assert: accommodation_media rows reflect the updated media
                const rows = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId));

                // Only the featured image was supplied — expect exactly 1 row
                expect(rows.length).toBe(1);
                const featured = rows.find((r) => r.isFeatured);
                expect(featured).toBeDefined();
                expect(featured?.url).toBe(
                    'https://cdn.example.com/update-regression-featured.jpg'
                );
                expect(featured?.state).toBe('visible');
            });
        }
    );
});
