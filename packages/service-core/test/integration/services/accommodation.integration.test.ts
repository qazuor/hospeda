/**
 * SPEC-080 — AccommodationService.getById() relation-loading integration test.
 *
 * Verifies that against a real PostgreSQL database (the
 * `hospeda_service_integration_test` ephemeral DB provisioned by
 * `global-setup.ts`), AccommodationService.getById() resolves the eager
 * relations declared by `getDefaultListRelations()` — `destination` and
 * `owner` — into populated nested objects rather than bare FK strings.
 *
 * The mocked unit tests cannot catch this regression: a missing or wrong
 * `relations()` definition in `accommodation.dbschema.ts`, a typo in
 * `validRelationKeys`, or a Drizzle relational-query mistake all happen at
 * the Drizzle layer, which mocks bypass entirely.
 */
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

describe('SPEC-080 — AccommodationService.getById relation loading', () => {
    let service: AccommodationService;

    beforeAll(() => {
        if (!dbAvailable) return;
        // Pre-warm the cached test DB and wire it as @repo/db's runtime
        // client (see helpers.getServiceTestDb).
        getServiceTestDb();
        service = new AccommodationService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'returns populated `destination` and `owner` objects (not FK strings)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedAccommodation(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.accommodationId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                // FK columns still match what we seeded.
                expect(result.data.id).toBe(seeded.accommodationId);
                expect(result.data.ownerId).toBe(seeded.userId);
                expect(result.data.destinationId).toBe(seeded.destinationId);

                // Relations are nested objects with at least an id.
                const data = result.data as unknown as {
                    destination?: { id?: string } | null;
                    owner?: { id?: string } | null;
                };
                expect(data.destination?.id).toBe(seeded.destinationId);
                expect(data.owner?.id).toBe(seeded.userId);
            });
        }
    );
});
