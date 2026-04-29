/**
 * SPEC-080 — AccommodationReviewService.getById() relation-loading integration test.
 *
 * Verifies against a real PostgreSQL database that AccommodationReviewService
 * .getById() resolves `user` and `accommodation` into populated nested objects.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodationReview,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — AccommodationReviewService.getById relation loading', () => {
    let service: AccommodationReviewService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new AccommodationReviewService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'returns populated `user` and `accommodation` objects (not FK strings)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedAccommodationReview(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.reviewId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                expect(result.data.id).toBe(seeded.reviewId);
                expect(result.data.userId).toBe(seeded.userId);
                expect(result.data.accommodationId).toBe(seeded.accommodationId);

                const data = result.data as unknown as {
                    user?: { id?: string } | null;
                    accommodation?: { id?: string } | null;
                };
                expect(data.user?.id).toBe(seeded.userId);
                expect(data.accommodation?.id).toBe(seeded.accommodationId);
            });
        }
    );

    it.skipIf(!dbAvailable)('throws NOT_FOUND when the review does not exist', async () => {
        await withServiceTestTransaction(async (tx) => {
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            await expect(service.getById(actor, crypto.randomUUID(), ctx)).rejects.toThrow(
                /not found/i
            );
        });
    });
});
