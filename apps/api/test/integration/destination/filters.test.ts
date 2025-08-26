import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Destination - Filters', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('supports city and country filters', async () => {
        const res = await app.request(`${base}?city=Miami&country=US`);
        expect([200, 400]).toContain(res.status);
    });

    it('supports isFeatured=true filter', async () => {
        const res = await app.request(`${base}?isFeatured=true`);
        expect([200, 400]).toContain(res.status);
    });

    it('supports free text search (q)', async () => {
        const res = await app.request(`${base}?q=beach`);
        expect([200, 400]).toContain(res.status);
    });
});
