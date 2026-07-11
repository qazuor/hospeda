/**
 * HOS-113 T-036 — "near POI" accommodation search integration test (AC-4),
 * against a real PostgreSQL database (the ephemeral
 * `hospeda_service_integration_test` DB provisioned by `global-setup.ts`).
 *
 * `AccommodationService._executeSearch` calls
 * `AccommodationModel.searchWithRelations` WITHOUT forwarding `ctx.tx`
 * (unlike `getById`/`getByField`), so this suite cannot use
 * `withServiceTestTransaction`'s rollback isolation the way other
 * SPEC-080 integration tests do — a row inserted inside an uncommitted
 * transaction on one pooled connection is invisible to a `search()` call
 * that queries via the globally-set `db` client on a different connection.
 * Instead this file inserts real (committed) rows directly against the
 * ephemeral test DB and removes them in `afterEach`, mirroring the
 * commit-then-cleanup pattern `packages/db/test/integration/helpers.ts`
 * documents as `withCleanSlate` for the same class of visibility problem.
 *
 * Covers AC-4: `poiSlug`-filtered search returns accommodations
 * ranked/filtered by distance to the resolved point of interest, and an
 * unknown `poiSlug` yields a clean `NOT_FOUND` rather than a silent empty
 * page.
 */
import { accommodations, destinations, eq, pointsOfInterest, users } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';

const dbAvailable = isServiceTestDbAvailable();

/** Base center point (Concepción del Uruguay area, matches other HOS-113 fixtures). */
const POI_LAT = -32.4825;
const POI_LONG = -58.2372;

/**
 * Approximate km-per-degree-of-latitude at this latitude (~111.3km); used to
 * place accommodations at deliberately-controlled distances from the POI by
 * offsetting latitude only (longitude held constant), so a plain haversine
 * distance is ~ |deltaLat| * KM_PER_DEGREE.
 */
const KM_PER_DEGREE_LAT = 111.3;

function latOffsetForKm(km: number): number {
    return km / KM_PER_DEGREE_LAT;
}

describe('HOS-113 T-036 — AccommodationService "near POI" search (AC-4)', () => {
    let service: AccommodationService;
    const insertedAccommodationIds: string[] = [];
    const insertedPoiIds: string[] = [];
    let ownerId: string | undefined;
    let destinationId: string | undefined;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new AccommodationService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    afterEach(async () => {
        if (!dbAvailable) return;
        const db = getServiceTestDb();
        for (const id of insertedAccommodationIds) {
            await db.delete(accommodations).where(eq(accommodations.id, id));
        }
        insertedAccommodationIds.length = 0;
        for (const id of insertedPoiIds) {
            await db.delete(pointsOfInterest).where(eq(pointsOfInterest.id, id));
        }
        insertedPoiIds.length = 0;
        if (destinationId) {
            await db.delete(destinations).where(eq(destinations.id, destinationId));
            destinationId = undefined;
        }
        if (ownerId) {
            await db.delete(users).where(eq(users.id, ownerId));
            ownerId = undefined;
        }
    });

    /** Inserts a committed accommodation at `latOffsetKm` km north of the POI. */
    async function insertAccommodationAt(params: {
        readonly latOffsetKm: number;
        readonly slugSuffix: string;
    }): Promise<string> {
        const db = getServiceTestDb();
        const accommodationId = crypto.randomUUID();
        const lat = POI_LAT + latOffsetForKm(params.latOffsetKm);

        await db.insert(accommodations).values({
            id: accommodationId,
            slug: `t036-acc-${params.slugSuffix}-${accommodationId.slice(0, 8)}`,
            name: `T-036 Accommodation ${params.slugSuffix}`,
            summary: 'HOS-113 T-036 integration test accommodation',
            description: 'HOS-113 T-036 integration test accommodation description',
            type: 'HOTEL',
            ownerId,
            destinationId,
            location: {
                state: 'Entre Rios',
                country: 'Argentina',
                coordinates: { lat: String(lat), long: String(POI_LONG) }
            },
            media: {
                featuredImage: {
                    moderationState: 'APPROVED',
                    url: 'https://example.com/t036-accommodation.jpg'
                }
            },
            lifecycleState: 'ACTIVE',
            visibility: 'PUBLIC',
            ownerSuspended: false
        } as typeof accommodations.$inferInsert);

        insertedAccommodationIds.push(accommodationId);
        return accommodationId;
    }

    /** Inserts a committed point of interest at the fixed base coordinates. */
    async function insertPoi(slug: string): Promise<void> {
        const db = getServiceTestDb();
        await db.insert(pointsOfInterest).values({
            slug,
            lat: POI_LAT,
            long: POI_LONG,
            type: 'STADIUM'
        } as typeof pointsOfInterest.$inferInsert);
        const [row] = await db
            .select({ id: pointsOfInterest.id })
            .from(pointsOfInterest)
            .where(eq(pointsOfInterest.slug, slug));
        if (row) insertedPoiIds.push(row.id);
    }

    async function seedOwnerAndDestination(): Promise<void> {
        const db = getServiceTestDb();
        ownerId = crypto.randomUUID();
        destinationId = crypto.randomUUID();
        const uid = crypto.randomUUID().slice(0, 8);

        await db.insert(users).values({
            id: ownerId,
            email: `t036-owner-${uid}@example.com`,
            displayName: 'T-036 Owner',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        } as typeof users.$inferInsert);

        await db.insert(destinations).values({
            id: destinationId,
            slug: `t036-dest-${uid}`,
            name: 'T-036 Destination',
            destinationType: 'CITY',
            level: 4,
            path: `/t036/dest-${uid}`,
            summary: 'T-036 destination summary',
            description: 'T-036 destination description',
            location: {
                state: 'Entre Rios',
                country: 'Argentina',
                coordinates: { lat: String(POI_LAT), long: String(POI_LONG) }
            },
            media: {
                featuredImage: {
                    moderationState: 'APPROVED',
                    url: 'https://example.com/t036-destination.jpg'
                }
            },
            lifecycleState: 'ACTIVE'
        } as typeof destinations.$inferInsert);
    }

    it.skipIf(!dbAvailable)(
        'returns accommodations ranked/filtered by distance to the resolved POI (AC-4)',
        async () => {
            await seedOwnerAndDestination();
            const poiSlug = `t036-poi-${crypto.randomUUID().slice(0, 8)}`;
            await insertPoi(poiSlug);

            // ~0.3km from the POI — well within the 5km OQ-5 default radius.
            const nearId = await insertAccommodationAt({ latOffsetKm: 0.3, slugSuffix: 'near' });
            // ~3km from the POI — within the default radius, farther than `near`.
            const midId = await insertAccommodationAt({ latOffsetKm: 3, slugSuffix: 'mid' });
            // ~55km from the POI — outside the default 5km radius.
            await insertAccommodationAt({ latOffsetKm: 55, slugSuffix: 'far' });

            const actor = createSuperAdminActor();
            const result = await service.search(actor, {
                poiSlug,
                page: 1,
                pageSize: 10
            });

            expect(result.error).toBeUndefined();
            const items = result.data?.items ?? [];
            const ids = items.map((item) => item.id);

            // The far accommodation (outside the default 5km radius) must be excluded.
            expect(ids).not.toContain(
                insertedAccommodationIds.find((id) => id !== nearId && id !== midId)
            );
            // Both near and mid must be present, near ranked before mid (AC-4 — distance ascending default).
            expect(ids).toContain(nearId);
            expect(ids).toContain(midId);
            expect(ids.indexOf(nearId)).toBeLessThan(ids.indexOf(midId));
        }
    );

    it.skipIf(!dbAvailable)(
        'returns a clean NOT_FOUND for an unknown poiSlug (no silent empty result)',
        async () => {
            const actor = createSuperAdminActor();
            const result = await service.search(actor, {
                poiSlug: `t036-does-not-exist-${crypto.randomUUID()}`,
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        }
    );
});
