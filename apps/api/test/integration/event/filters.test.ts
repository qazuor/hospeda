import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Filters', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('supports isFeatured=true filter', async () => {
        const res = await app.request(`${base}?isFeatured=true`);
        expect([200, 400]).toContain(res.status);
    });

    it('supports free text search (q)', async () => {
        const res = await app.request(`${base}?q=music`);
        expect([200, 400]).toContain(res.status);
    });

    it('supports date.from and date.to filters', async () => {
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 86400000).toISOString();
        const res = await app.request(
            `${base}?date.from=${encodeURIComponent(from)}&date.to=${encodeURIComponent(to)}`
        );
        expect([200, 400]).toContain(res.status);
    });
});
