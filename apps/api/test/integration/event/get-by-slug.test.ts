import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /events/slug/:slug', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200/404 or 400 (validation) depending on slug', async () => {
        const res = await app.request(`${base}/slug/some-slug`);
        expect([200, 404, 400]).toContain(res.status);
    });
});
