/**
 * SPEC-080 — DestinationReviewService.getById() relation-loading integration test.
 *
 * Verifies against a real PostgreSQL database that DestinationReviewService
 * .getById() resolves `user` and `destination` into populated nested objects.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedDestinationReview,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — DestinationReviewService.getById relation loading', () => {
    let service: DestinationReviewService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new DestinationReviewService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'returns populated `user` and `destination` objects (not FK strings)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedDestinationReview(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.reviewId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                expect(result.data.id).toBe(seeded.reviewId);
                expect(result.data.userId).toBe(seeded.userId);
                expect(result.data.destinationId).toBe(seeded.destinationId);

                const data = result.data as unknown as {
                    user?: { id?: string } | null;
                    destination?: { id?: string } | null;
                };
                expect(data.user?.id).toBe(seeded.userId);
                expect(data.destination?.id).toBe(seeded.destinationId);
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
