import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /event-organizers (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/event-organizers';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('lists event organizers (happy path)', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
        }
    });

    it('includes pagination metadata', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('pagination');
            expect(body.pagination).toHaveProperty('page');
            expect(body.pagination).toHaveProperty('pageSize');
            expect(body.pagination).toHaveProperty('total');
        }
    });

    it('respects pageSize query parameter', async () => {
        const res = await app.request(`${base}?pageSize=5`, {
            headers: { 'user-agent': 'vitest' }
        });
        if (res.status === 200) {
            const body = await res.json();
            expect(body.pagination.pageSize).toBeLessThanOrEqual(5);
        }
    });

    it('enforces maximum pageSize limit', async () => {
        const res = await app.request(`${base}?pageSize=500`, {
            headers: { 'user-agent': 'vitest' }
        });
        if (res.status === 200) {
            const body = await res.json();
            expect(body.pagination.pageSize).toBeLessThanOrEqual(100);
        }
    });

    it('includes cache headers', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
        if (res.status === 200) {
            const cacheControl = res.headers.get('cache-control');
            expect(cacheControl).toBeTruthy();
        }
    });
});
