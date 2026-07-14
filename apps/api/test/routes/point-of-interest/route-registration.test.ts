/**
 * App-level route registration test for points of interest (HOS-113 T-022,
 * updated for HOS-143).
 *
 * Asserts the public route is actually mounted at
 * `/api/v1/public/points-of-interest` on the real app instance and returns
 * the expected paginated envelope shape. HOS-143 mounted the admin CRUD tier
 * (superseding HOS-113 NG-5's "seed-only, no admin tier" assumption), so this
 * also asserts `/api/v1/admin/points-of-interest` now exists (reaches the
 * auth gate instead of 404). The protected tier remains unmounted.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('Route registration: points of interest (HOS-113 T-022)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('should mount GET /api/v1/public/points-of-interest and return 200 with a paginated shape', async () => {
        const res = await app.request('/api/v1/public/points-of-interest', {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            success: boolean;
            data?: { items?: unknown[]; pagination?: { page: number; pageSize: number } };
        };
        expect(body.success).toBe(true);
        expect(body.data).toHaveProperty('items');
        expect(body.data).toHaveProperty('pagination');
    });

    it('should mount an admin tier (GET /api/v1/admin/points-of-interest reaches auth gate, not 404 — HOS-143)', async () => {
        const res = await app.request('/api/v1/admin/points-of-interest', {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(404);
        expect([401, 403]).toContain(res.status);
    });

    it('should NOT mount a protected tier (no /api/v1/protected/points-of-interest — NG-5)', async () => {
        const res = await app.request('/api/v1/protected/points-of-interest', {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(404);
    });
});
