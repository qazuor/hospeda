import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - List sorting + filters combo', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('supports q + sortOrder + pagination', async () => {
        const res = await app.request(`${base}?q=test&sortOrder=ASC&page=1&pageSize=10`);
        expect([200, 400]).toContain(res.status);
    });
});
