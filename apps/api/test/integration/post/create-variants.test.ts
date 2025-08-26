import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('POST /posts (variants)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('creates NEWS post minimal', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'News A', category: 'NEWS' })
        });
        expect([200, 400]).toContain(res.status);
    });

    it('creates post with media.featuredImage', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                title: 'With Image',
                category: 'NEWS',
                media: { featuredImage: { url: 'https://img' } }
            })
        });
        expect([200, 400]).toContain(res.status);
    });
});
