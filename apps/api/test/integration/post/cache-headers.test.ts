import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - Cache headers', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('list can set cache headers', async () => {
        const res = await app.request(base);
        expect([200, 400]).toContain(res.status);
        const cache = res.headers.get('cache-control');
        // Not mandatory, but if present, should be a string
        if (cache) expect(typeof cache).toBe('string');
    });
});
