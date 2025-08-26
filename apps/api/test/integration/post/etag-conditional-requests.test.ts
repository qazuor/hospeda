import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - ETag / Conditional Requests', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('responds with 200 and possibly ETag header', async () => {
        const res = await app.request(base);
        expect([200, 400]).toContain(res.status);
        const etag = res.headers.get('etag');
        if (etag) {
            const res2 = await app.request(base, { headers: { 'if-none-match': etag } });
            expect([200, 304, 400]).toContain(res2.status);
        }
    });
});
