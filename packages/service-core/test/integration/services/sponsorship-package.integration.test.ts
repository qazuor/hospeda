/**
 * SPEC-080 — SponsorshipPackageService.getById() relation-loading integration test.
 *
 * Verifies against a real PostgreSQL database that SponsorshipPackageService
 * .getById() resolves `eventLevel` (the sponsorship_levels FK) into a
 * populated nested object.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SponsorshipPackageService } from '../../../src/services/sponsorship/sponsorshipPackage.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedSponsorshipPackage,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — SponsorshipPackageService.getById relation loading', () => {
    let service: SponsorshipPackageService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new SponsorshipPackageService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'returns a populated `eventLevel` object (not just an FK string)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedSponsorshipPackage(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.packageId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                expect(result.data.id).toBe(seeded.packageId);
                const data = result.data as unknown as {
                    eventLevelId?: string | null;
                    eventLevel?: { id?: string } | null;
                };
                expect(data.eventLevelId).toBe(seeded.levelId);
                expect(data.eventLevel?.id).toBe(seeded.levelId);
            });
        }
    );

    it.skipIf(!dbAvailable)('throws NOT_FOUND when the package does not exist', async () => {
        await withServiceTestTransaction(async (tx) => {
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            await expect(service.getById(actor, crypto.randomUUID(), ctx)).rejects.toThrow(
                /not found/i
            );
        });
    });
});
