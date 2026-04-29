/**
 * SPEC-080 — OwnerPromotionService.getById() relation-loading integration test.
 *
 * Verifies against a real PostgreSQL database that OwnerPromotionService
 * .getById() resolves `owner` and `accommodation` into populated nested objects.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedOwnerPromotion,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — OwnerPromotionService.getById relation loading', () => {
    let service: OwnerPromotionService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new OwnerPromotionService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'returns populated `owner` and `accommodation` objects (not FK strings)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedOwnerPromotion(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.promotionId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                expect(result.data.id).toBe(seeded.promotionId);
                expect(result.data.ownerId).toBe(seeded.ownerId);
                expect(result.data.accommodationId).toBe(seeded.accommodationId);

                const data = result.data as unknown as {
                    owner?: { id?: string } | null;
                    accommodation?: { id?: string } | null;
                };
                expect(data.owner?.id).toBe(seeded.ownerId);
                expect(data.accommodation?.id).toBe(seeded.accommodationId);
            });
        }
    );

    it.skipIf(!dbAvailable)('throws NOT_FOUND when the promotion does not exist', async () => {
        await withServiceTestTransaction(async (tx) => {
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            await expect(service.getById(actor, crypto.randomUUID(), ctx)).rejects.toThrow(
                /not found/i
            );
        });
    });
});
