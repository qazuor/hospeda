/**
 * @file venue-public-business-line-filter.integration.test.ts
 * @description HOS-1787 leaf 6.8 (AC:6:1 data half) — the public venue search
 * filters by business line against a REAL ephemeral PostgreSQL database.
 *
 * The unit suite proves the `@>` clause reaches the model; this suite proves it
 * selects the right rows. A hybrid resto-bar (RESTAURANT with both lines) must
 * appear under each line, a nightclub (BOLICHE) only under `nightlife`, and a
 * cafe only under `food`; the unfiltered list shows all three, and a DRAFT never
 * appears. The count must agree with the page for every query.
 *
 * `withServiceTestTransaction` rolls every insert back. A single shared
 * `destinationId` isolates the fixtures from any other row in the shared test
 * database, so `total` can be asserted exactly.
 *
 * @module venue-public-business-line-filter.integration.test
 */
import { eq, venues } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VenueService } from '../../../src/services/venue/venue.service';
import type { ServiceContext } from '../../../src/types';
import { createGuestActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedVenue,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('Venue public business-line filter (HOS-1787 6.8) — real DB', () => {
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

    it.skipIf(!dbAvailable)(
        'returns each listing under its lines, hides drafts, and counts what it lists',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const restoBar = await seedVenue(tx, {
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                });
                const boliche = await seedVenue(tx, {
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                });
                const cafe = await seedVenue(tx, {
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                });
                const draft = await seedVenue(tx); // DRAFT by default

                // One destination for the four fixtures: anything else the
                // shared database holds is filtered out, so `total` is exact.
                const destinationId = restoBar.destinationId;

                await tx
                    .update(venues)
                    .set({ businessLines: ['food', 'nightlife'], destinationId })
                    .where(eq(venues.id, restoBar.venueId));

                // BOLICHE and its line move together: the CHECK requires the pair.
                await tx
                    .update(venues)
                    .set({ type: 'BOLICHE', businessLines: ['nightlife'], destinationId })
                    .where(eq(venues.id, boliche.venueId));

                await tx
                    .update(venues)
                    .set({ type: 'CAFE', businessLines: ['food'], destinationId })
                    .where(eq(venues.id, cafe.venueId));

                await tx
                    .update(venues)
                    .set({ businessLines: ['food', 'nightlife'], destinationId })
                    .where(eq(venues.id, draft.venueId));

                const ctx = { tx, hookState: {} } as ServiceContext;
                const actor = createGuestActor({ id: crypto.randomUUID() });

                const nightlife = await service.search(
                    actor,
                    { destinationId, businessLine: 'nightlife', page: 1, pageSize: 100 },
                    ctx
                );
                expect(nightlife.error).toBeUndefined();
                const nightlifeIds = (nightlife.data?.items ?? []).map((item) => item.id);
                expect(nightlifeIds).toContain(restoBar.venueId);
                expect(nightlifeIds).toContain(boliche.venueId);
                expect(nightlifeIds).not.toContain(cafe.venueId);
                expect(nightlifeIds).not.toContain(draft.venueId);
                expect(nightlife.data?.total).toBe(nightlifeIds.length);
                expect(nightlife.data?.total).toBe(2);

                const food = await service.search(
                    actor,
                    { destinationId, businessLine: 'food', page: 1, pageSize: 100 },
                    ctx
                );
                expect(food.error).toBeUndefined();
                const foodIds = (food.data?.items ?? []).map((item) => item.id);
                expect(foodIds).toContain(restoBar.venueId);
                expect(foodIds).toContain(cafe.venueId);
                expect(foodIds).not.toContain(boliche.venueId);
                expect(foodIds).not.toContain(draft.venueId);
                expect(food.data?.total).toBe(foodIds.length);
                expect(food.data?.total).toBe(2);

                const unfiltered = await service.search(
                    actor,
                    { destinationId, page: 1, pageSize: 100 },
                    ctx
                );
                expect(unfiltered.error).toBeUndefined();
                const allIds = (unfiltered.data?.items ?? []).map((item) => item.id);
                expect(allIds).toContain(restoBar.venueId);
                expect(allIds).toContain(boliche.venueId);
                expect(allIds).toContain(cafe.venueId);
                expect(allIds).not.toContain(draft.venueId);
                expect(unfiltered.data?.total).toBe(allIds.length);
                expect(unfiltered.data?.total).toBe(3);
            });
        }
    );
});
