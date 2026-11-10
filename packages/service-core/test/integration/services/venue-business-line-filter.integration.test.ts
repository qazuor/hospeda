/**
 * HOS-1787 leaf 7.1 — venue admin business-line filter against a REAL
 * ephemeral PostgreSQL database.
 *
 * The unit tests compile the `@>` clause through `PgDialect` but never execute
 * it. This suite proves the clause actually selects the right rows: two seeded
 * listings, only one carrying `nightlife`, and the filtered `adminList` must
 * return exactly the one that does.
 *
 * Uses `withServiceTestTransaction`, so every insert rolls back and the
 * ephemeral DB stays clean. `VenueService.adminList` forwards `ctx.tx` to the
 * model calls, so the uncommitted rows are visible to the query.
 *
 * @module venue-business-line-filter.integration.test
 */
import { eq, venues } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VenueService } from '../../../src/services/venue/venue.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedVenue,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

const adminActor: Actor = {
    id: '00000000-0000-4000-a000-00000000ad01',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.VENUE_VIEW_ALL]
};

describe('Venue admin business-line filter (HOS-1787 7.1) — real DB', () => {
    let service: VenueService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new VenueService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it('returns only the listings that carry the requested line', async () => {
        if (!dbAvailable) return;

        await withServiceTestTransaction(async (tx) => {
            const foodOnly = await seedVenue(tx);
            const foodAndNight = await seedVenue(tx);

            await tx
                .update(venues)
                .set({ businessLines: ['food', 'nightlife'] })
                .where(eq(venues.id, foodAndNight.venueId));

            const ctx = { tx, hookState: {} } as ServiceContext;

            const filtered = await service.adminList(
                adminActor,
                { businessLine: 'nightlife' },
                ctx
            );
            expect(filtered.error).toBeUndefined();
            const filteredIds = (filtered.data?.items ?? []).map((item) => item.id);
            expect(filteredIds).toContain(foodAndNight.venueId);
            expect(filteredIds).not.toContain(foodOnly.venueId);

            const unfiltered = await service.adminList(adminActor, {}, ctx);
            expect(unfiltered.error).toBeUndefined();
            const unfilteredIds = (unfiltered.data?.items ?? []).map((item) => item.id);
            expect(unfilteredIds).toContain(foodOnly.venueId);
            expect(unfilteredIds).toContain(foodAndNight.venueId);
        });
    });
});
