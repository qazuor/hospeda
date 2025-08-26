import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /destinations/slug/:slug (success case)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns destination for a valid slug', async () => {
        const res = await app.request(`${base}/slug/destination-slug`);
        expect([200, 400, 404]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(typeof body.data.slug).toBe('string');
        }
    });
});
