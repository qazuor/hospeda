import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

describe('Post - Middleware stack', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    beforeAll(async () => {
        await testDb.setup();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('GET /posts goes through middlewares without crashing', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'middleware-stack' } });
        expect(res.status).toBe(200);
    });
});
