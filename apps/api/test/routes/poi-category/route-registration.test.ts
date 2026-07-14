/**
 * App-level route registration test for the POI-category catalog
 * (HOS-144 NG-1).
 *
 * Asserts the admin route is actually mounted at
 * `/api/v1/admin/poi-categories` on the real app instance — reaches the auth
 * gate (401/403) instead of 404. Mirrors
 * `test/routes/point-of-interest/route-registration.test.ts`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('Route registration: poi-category (HOS-144 NG-1)', () => {
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

    it('should NOT mount a public tier (no /api/v1/public/poi-categories)', async () => {
        const res = await app.request('/api/v1/public/poi-categories', {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(404);
    });
});
