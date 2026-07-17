/**
 * App-level route registration test for the POI-category catalog
 * (HOS-144 NG-1 admin tier + HOS-147 public tier).
 *
 * Asserts each route is actually mounted on the real app instance — the admin
 * route reaches the auth gate (401/403) instead of 404, and the public route
 * (HOS-147) reaches its handler instead of 404. Mirrors
 * `test/routes/point-of-interest/route-registration.test.ts`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('Route registration: poi-category (HOS-144 NG-1 + HOS-147)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('should mount an admin tier (GET /api/v1/admin/poi-categories reaches auth gate, not 404)', async () => {
        const res = await app.request('/api/v1/admin/poi-categories', {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(404);
        expect([401, 403]).toContain(res.status);
    });

    it('should mount a public tier (GET /api/v1/public/poi-categories is registered, not 404) — HOS-147', async () => {
        const res = await app.request('/api/v1/public/poi-categories', {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        // Public read: no auth gate. The route is mounted, so it reaches its
        // handler rather than 404 (the handler itself may 200 or, without an
        // initialized DB in this app-level test, surface a 5xx — either way it
        // is NOT a 404, which is what proves registration).
        expect(res.status).not.toBe(404);
    });
});
