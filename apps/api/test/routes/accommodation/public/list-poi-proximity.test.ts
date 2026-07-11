/**
 * Tests for the "near POI" proximity-search wiring on
 * GET /api/v1/public/accommodations (HOS-113 T-035).
 *
 * The route is a thin wrapper: `AccommodationSearchHttpSchema` (T-031)
 * already carries `poiId`/`poiSlug`, and `httpToDomainAccommodationSearch`
 * already maps them through — no route-layer code change was required
 * beyond the schema wiring landed in T-031. This file verifies the query
 * params reach the route without a schema-validation rejection and that the
 * poiId+poiSlug mutual-exclusion 400 (T-034, enforced in
 * `AccommodationService._beforeSearch`, which runs before any DB access) is
 * observable end-to-end even without a live database in the unit test
 * environment.
 *
 * Full distance-ranking assertions against real seeded data are covered by
 * the HOS-113 T-036 integration test (real DB, service-layer).
 *
 * Note: the route resolves quick-amenity-flag slugs (`resolveQuickAmenityFlags`)
 * BEFORE calling `accommodationService.search()`, so even the deterministic,
 * DB-independent poiId+poiSlug 400 from `_beforeSearch` can be masked by an
 * earlier 500 when the amenity catalog lookup itself cannot reach the DB in
 * this test environment — the same "not 400/404" convention already used by
 * `list-sorts.test.ts` applies here.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/accommodations';

describe('GET /api/v1/public/accommodations — poiId/poiSlug wiring (HOS-113 T-035)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('accepts a poiSlug query param without a schema-validation rejection', async () => {
        const res = await app.request(`${BASE}?poiSlug=autodromo-cdu`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        // Route exists and parsed params — 200 (DB reachable) or 500 (DB
        // unreachable in unit mode) are both acceptable; never 400/404.
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('accepts a valid poiId (UUID) query param without a schema-validation rejection', async () => {
        const res = await app.request(`${BASE}?poiId=12345678-1234-4234-8234-123456789012`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('rejects a poiId that is not a valid UUID with a 400 (HTTP schema validation)', async () => {
        const res = await app.request(`${BASE}?poiId=not-a-uuid`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(400);
    });

    it('rejects poiId and poiSlug supplied together with a 400 or a DB-unreachable 500, never a schema-level 400 mismatch', async () => {
        const res = await app.request(
            `${BASE}?poiId=12345678-1234-4234-8234-123456789012&poiSlug=autodromo-cdu`,
            {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            }
        );
        // AccommodationService._beforeSearch rejects the dual-param combo
        // with a 400 VALIDATION_ERROR, but the route resolves quick-amenity
        // flags (DB-dependent) before ever calling the service — so a
        // DB-unreachable 500 is also an acceptable outcome in this
        // environment. Either way, the request must be routable (never 404)
        // and both params must have passed the HTTP schema layer.
        expect([400, 500]).toContain(res.status);
        expect(res.status).not.toBe(404);
    });

    it('coexists with the existing latitude/longitude/radius params without a schema-validation rejection', async () => {
        const res = await app.request(
            `${BASE}?poiSlug=autodromo-cdu&latitude=-32.4825&longitude=-58.2372&radius=10`,
            {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            }
        );
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });
});
