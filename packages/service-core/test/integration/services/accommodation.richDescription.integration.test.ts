/**
 * SPEC-187 P2-T3 — AccommodationService richDescription round-trip integration test.
 *
 * Verifies that the service layer carries `richDescription` end-to-end against
 * a real PostgreSQL database (the `hospeda_service_integration_test` ephemeral
 * DB provisioned by `global-setup.ts`).
 *
 * P2-T1 added `richDescription: z.string().max(5000).optional()` to the Zod
 * schema; P2-T2 added the `rich_description` column to the Drizzle schema and
 * generated migration `0009_lovely_mandrill.sql`. The CRUD schemas inherit
 * the field automatically, so the service contract is: a host that owns the
 * accommodation and has permission to update it can persist the field, and
 * `getById` returns it intact.
 *
 * The mock-based unit test in `test/services/accommodation/accommodation.service.test.ts`
 * cannot exercise this path because `service.create` traverses
 * `_beforeCreate` → `_assertDestinationIsCity` which requires a real
 * destination row. That test suite points here for the round-trip evidence.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceContext } from '../../../src/types';
import { createHostActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

/**
 * A markdown snippet small enough to be readable in test output but rich enough
 * to exercise the actual characters a host will paste from the Tiptap editor:
 * heading, bold, newline. SPEC-187 P1-T4 confirmed `renderContent` sanitizes
 * this exact shape into `<h2>` + `<strong>`.
 */
const RICH_DESCRIPTION = '## Premium\n\n**luxury** rooms with spa access.';

describe('SPEC-187 P2-T3 — AccommodationService richDescription round-trip', () => {
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
        'persists richDescription on update and reads it back via getById',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange — seed owner + destination + accommodation
                const seeded = await seedAccommodation(tx);
                // The host actor must own the seeded accommodation so
                // _canUpdate (ACC_UPDATE_OWN) passes.
                const actor = createHostActor({ id: seeded.userId });
                const ctx: ServiceContext = { tx };

                // Act — host updates with richDescription
                const updateResult = await service.update(
                    actor,
                    seeded.accommodationId,
                    { richDescription: RICH_DESCRIPTION },
                    ctx
                );

                // Assert — update returned the new value
                expect(updateResult.error).toBeUndefined();
                expect(updateResult.data).toBeDefined();
                if (!updateResult.data) throw new Error('expected populated update result.data');
                expect(updateResult.data.richDescription).toBe(RICH_DESCRIPTION);

                // Act — re-fetch through the public read path
                const fetched = await service.getById(actor, seeded.accommodationId, ctx);

                // Assert — read returned the SAME value (no normalization, no strip)
                expect(fetched.error).toBeUndefined();
                expect(fetched.data).toBeDefined();
                if (!fetched.data) throw new Error('expected populated fetched result.data');
                expect(fetched.data.richDescription).toBe(RICH_DESCRIPTION);
                // Sanity: the plain description field is untouched.
                expect(fetched.data.description).toBe('Seed accommodation description');
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'returns richDescription as null when the owner has not set one',
        async () => {
            // This is the most important regression test: when the owner
            // does NOT have the entitlement, the public payload must
            // OMIT the field. The service stores NULL in the column by
            // default (Drizzle schema makes it nullable), and the
            // getById call must surface that as null — not undefined
            // (the field is present on the type, just empty). The
            // public route (P2-T6) is the one that turns this null
            // into an omission via the entitlement filter.
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedAccommodation(tx);
                const actor = createHostActor({ id: seeded.userId });
                const ctx: ServiceContext = { tx };

                const fetched = await service.getById(actor, seeded.accommodationId, ctx);

                expect(fetched.error).toBeUndefined();
                expect(fetched.data).toBeDefined();
                if (!fetched.data) throw new Error('expected populated fetched result.data');
                expect(fetched.data.richDescription).toBeNull();
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'accepts a 5000-character richDescription (Zod upper-boundary)',
        async () => {
            // P2-T1 set `.max(5000)` on the Zod schema; the service
            // validates input through that schema on update. This
            // test proves the boundary value passes through end to
            // end against a real column.
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedAccommodation(tx);
                const actor = createHostActor({ id: seeded.userId });
                const ctx: ServiceContext = { tx };

                const maxLengthValue = 'a'.repeat(5000);

                const updateResult = await service.update(
                    actor,
                    seeded.accommodationId,
                    { richDescription: maxLengthValue },
                    ctx
                );

                expect(updateResult.error).toBeUndefined();
                if (!updateResult.data) throw new Error('expected populated update result.data');
                expect(updateResult.data.richDescription).toBe(maxLengthValue);
                expect(updateResult.data.richDescription).toHaveLength(5000);

                const fetched = await service.getById(actor, seeded.accommodationId, ctx);
                if (!fetched.data) throw new Error('expected populated fetched result.data');
                expect(fetched.data.richDescription).toHaveLength(5000);
            });
        }
    );
});
