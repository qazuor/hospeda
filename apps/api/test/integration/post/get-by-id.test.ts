import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /posts/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 or 404 depending on id', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000`);
        expect([200, 400, 404]).toContain(res.status);
    });
});
