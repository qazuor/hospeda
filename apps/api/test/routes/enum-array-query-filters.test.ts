/**
 * Route-level contract for enum-backed array query filters (HOS-1974).
 *
 * `apps/api/docs/error-contract.md`: a malformed input is a 400 and never
 * `INTERNAL_ERROR`. Before HOS-1974 these filters only split the CSV and
 * forwarded raw strings, so a value outside the enum was never rejected at
 * the edge. They now share `createEnumArrayQueryParam`, so:
 *  - a value outside the enum answers 400 and the service is never reached;
 *  - a valid value in lower case answers 200 and reaches the service
 *    upper-cased.
 *
 * Only the public routes that are wired to a service are exercised here
 * (amenity `types`, event-location `venueTypes`); the schema-level cases for
 * the rest live in `packages/schemas/test/api/http`.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const searchSpies = vi.hoisted(() => ({
    amenity: vi.fn(),
    eventLocation: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AmenityService: vi.fn().mockImplementation(function () {
            return {
                search: async (_actor: unknown, query: Record<string, unknown>) => {
                    searchSpies.amenity(query);
                    return { data: { items: [], total: 0 } };
                }
            };
        }),
        EventLocationService: vi.fn().mockImplementation(function () {
            return {
                search: async (_actor: unknown, query: Record<string, unknown>) => {
                    searchSpies.eventLocation(query);
                    return { data: { items: [], total: 0 } };
                }
            };
        })
    };
});

const { initApp } = await import('../../src/app.js');

const HEADERS = { 'user-agent': 'vitest', accept: 'application/json' };

describe('enum-backed array query filters (HOS-1974)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/v1/public/amenities ?types=', () => {
        const BASE = '/api/v1/public/amenities';

        it('answers 400 (not 500) for a value outside the enum, without reaching the service', async () => {
            // Act
            const res = await app.request(`${BASE}?types=NOT_A_TYPE`, { headers: HEADERS });

            // Assert
            expect(res.status).toBe(400);
            expect(searchSpies.amenity).not.toHaveBeenCalled();
        });

        it('answers 400 when only one item of the list is invalid', async () => {
            const res = await app.request(`${BASE}?types=kitchen,nope`, { headers: HEADERS });

            expect(res.status).toBe(400);
        });

        it('answers 200 for a lower-case valid value and forwards it upper-cased', async () => {
            const res = await app.request(`${BASE}?types=kitchen,safety`, { headers: HEADERS });

            expect(res.status).toBe(200);
            expect(searchSpies.amenity).toHaveBeenCalledTimes(1);
            expect(searchSpies.amenity.mock.calls[0]?.[0]).toMatchObject({
                types: ['KITCHEN', 'SAFETY']
            });
        });
    });

    describe('GET /api/v1/public/event-locations ?venueTypes=', () => {
        const BASE = '/api/v1/public/event-locations';

        it('answers 400 (not 500) for a value outside the enum, without reaching the service', async () => {
            const res = await app.request(`${BASE}?venueTypes=NOT_A_VENUE`, { headers: HEADERS });

            expect(res.status).toBe(400);
            expect(searchSpies.eventLocation).not.toHaveBeenCalled();
        });

        it('answers 200 for a lower-case valid value and forwards it upper-cased', async () => {
            const res = await app.request(`${BASE}?venueTypes=restaurant,bar`, {
                headers: HEADERS
            });

            expect(res.status).toBe(200);
            expect(searchSpies.eventLocation.mock.calls[0]?.[0]).toMatchObject({
                venueTypes: ['RESTAURANT', 'BAR']
            });
        });
    });
});
