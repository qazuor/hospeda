import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /accommodations/slug/:slug (getBySlug)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations/slug';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 or 404 depending on existence', async () => {
        const res = await app.request(`${base}/sample-slug`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('slug');
    });
});
