/**
 * App-level route registration for the provider trade catalog (HOS-919).
 *
 * Asserts every route is mounted on the real app: admin routes reach the auth
 * gate (401) instead of 404, and the public route is reachable by a guest.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

const HEADERS = { 'user-agent': 'vitest', accept: 'application/json' };
const ID = '22222222-2222-4222-8222-222222222222';

describe('Route registration: provider trade catalog (HOS-919)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('mounts the public catalog (not 404, no auth gate)', async () => {
        const res = await app.request('/api/v1/public/host-trade-categories', {
            method: 'GET',
            headers: HEADERS
        });
        expect(res.status).not.toBe(404);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });

    it.each([
        ['admin/host-trade-category-groups'],
        ['admin/host-trade-categories']
    ])('mounts %s behind the auth gate', async (base) => {
        const res = await app.request(`/api/v1/${base}/${ID}/restore`, {
            method: 'POST',
            headers: HEADERS
        });
        expect(res.status).toBe(401);
    });

    it('does not expose write verbs on the public tier', async () => {
        const res = await app.request('/api/v1/public/host-trade-categories', {
            method: 'POST',
            headers: HEADERS
        });
        expect(res.status).toBe(404);
    });
});
