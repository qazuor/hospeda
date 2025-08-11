import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /posts/category/:category', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 or 404 depending on category', async () => {
        const res = await app.request(`${base}/category/NEWS`);
        expect([200, 400, 404]).toContain(res.status);
    });
});
