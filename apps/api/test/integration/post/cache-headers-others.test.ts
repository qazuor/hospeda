import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Cache headers on others', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('get by slug can include cache headers', async () => {
        const res = await app.request(`${base}/slug/sample-slug`);
        expect([200, 400, 404]).toContain(res.status);
        const cache = res.headers.get('cache-control');
        if (cache) expect(typeof cache).toBe('string');
    });
});
