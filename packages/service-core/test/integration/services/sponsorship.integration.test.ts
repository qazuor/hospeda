/**
 * SPEC-080 — SponsorshipService.getById() relation-loading integration test.
 *
 * Verifies against a real PostgreSQL database that SponsorshipService
 * .getById() resolves `sponsorUser`, `level`, and `package` into populated
 * nested objects.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedSponsorship,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — SponsorshipService.getById relation loading', () => {
    let service: SponsorshipService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new SponsorshipService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'returns populated `sponsorUser`, `level`, and `package` objects (not FK strings)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedSponsorship(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.sponsorshipId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                expect(result.data.id).toBe(seeded.sponsorshipId);
                const data = result.data as unknown as {
                    sponsorUserId?: string;
                    levelId?: string;
                    packageId?: string | null;
                    sponsorUser?: { id?: string } | null;
                    level?: { id?: string } | null;
                    package?: { id?: string } | null;
                };
                expect(data.sponsorUserId).toBe(seeded.sponsorId);
                expect(data.levelId).toBe(seeded.levelId);
                expect(data.packageId).toBe(seeded.packageId);
                expect(data.sponsorUser?.id).toBe(seeded.sponsorId);
                expect(data.level?.id).toBe(seeded.levelId);
                expect(data.package?.id).toBe(seeded.packageId);
            });
        }
    );

    it.skipIf(!dbAvailable)('throws NOT_FOUND when the sponsorship does not exist', async () => {
        await withServiceTestTransaction(async (tx) => {
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            await expect(service.getById(actor, crypto.randomUUID(), ctx)).rejects.toThrow(
                /not found/i
            );
        });
    });
});
