/**
 * SPEC-080 — EventService.getById() relation-loading integration test.
 *
 * Verifies against a real PostgreSQL database that EventService.getById()
 * resolves `author`, `location`, and `organizer` into populated nested
 * objects via the relational query API.
 *
 * **Tags excluded by design**: `events.tags` would require resolving
 * `r_entity_tag` polymorphically (entityType+entityId composite reference),
 * which Drizzle's relational query API does not support natively. Loading
 * tags eagerly would need a separate query — out of scope for SPEC-080.
 *
 * Widening from the bootstrap's `{ organizer, location }` to
 * `{ author, organizer, location }` happened during SPEC-080 closure
 * (T-012 follow-up) once we confirmed `validRelationKeys` on EventModel
 * already supports it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedEvent,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — EventService.getById relation loading', () => {
    let service: EventService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new EventService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'returns populated `author`, `location`, and `organizer` objects',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedEvent(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.eventId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                expect(result.data.id).toBe(seeded.eventId);
                const data = result.data as unknown as {
                    authorId?: string;
                    locationId?: string | null;
                    organizerId?: string | null;
                    author?: { id?: string } | null;
                    location?: { id?: string } | null;
                    organizer?: { id?: string } | null;
                };
                // FK columns
                expect(data.authorId).toBe(seeded.authorId);
                expect(data.locationId).toBe(seeded.locationId);
                expect(data.organizerId).toBe(seeded.organizerId);
                // Eagerly-loaded relations
                expect(data.author?.id).toBe(seeded.authorId);
                expect(data.location?.id).toBe(seeded.locationId);
                expect(data.organizer?.id).toBe(seeded.organizerId);
            });
        }
    );

    it.skipIf(!dbAvailable)('throws NOT_FOUND when the event does not exist', async () => {
        await withServiceTestTransaction(async (tx) => {
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            await expect(service.getById(actor, crypto.randomUUID(), ctx)).rejects.toThrow(
                /not found/i
            );
        });
    });
});
