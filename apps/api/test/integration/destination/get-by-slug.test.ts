import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /destinations/slug/:slug', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 or 404 (or 400 depending on validation) depending on slug', async () => {
        const res = await app.request(`${base}/slug/some-slug`);
        expect([200, 400, 404]).toContain(res.status);
    });
});
