import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - Middleware stack', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('GET /posts goes through middlewares without crashing', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'middleware-stack' } });
        expect([200, 400]).toContain(res.status);
    });
});
