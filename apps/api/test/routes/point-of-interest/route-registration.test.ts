/**
 * App-level route registration test for points of interest (HOS-113 T-022).
 *
 * Asserts the public route is actually mounted at
 * `/api/v1/public/points-of-interest` on the real app instance and returns
 * the expected paginated envelope shape, and that no protected/admin tier
 * is mounted (NG-5 — seed-only catalog in Phase 1).
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

    it('should NOT mount an admin tier (no /api/v1/admin/points-of-interest — NG-5)', async () => {
        const res = await app.request('/api/v1/admin/points-of-interest', {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(404);
    });

    it('should NOT mount a protected tier (no /api/v1/protected/points-of-interest — NG-5)', async () => {
        const res = await app.request('/api/v1/protected/points-of-interest', {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(404);
    });
});
