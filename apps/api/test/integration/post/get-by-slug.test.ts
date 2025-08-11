import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /posts/slug/:slug', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 or 404 depending on slug', async () => {
        const res = await app.request(`${base}/slug/sample-slug`);
        expect([200, 400, 404]).toContain(res.status);
    });
});
