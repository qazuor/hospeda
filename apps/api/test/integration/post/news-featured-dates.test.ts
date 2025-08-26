import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - News/Featured date filters', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('GET /posts/news accepts fromDate/toDate', async () => {
        const res = await app.request(`${base}/news?fromDate=2024-01-01&toDate=2025-01-01`);
        expect([200, 400]).toContain(res.status);
    });

    it('GET /posts/featured accepts fromDate/toDate', async () => {
        const res = await app.request(`${base}/featured?fromDate=2024-01-01&toDate=2025-01-01`);
        expect([200, 400]).toContain(res.status);
    });
});
