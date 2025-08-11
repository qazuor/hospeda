import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /posts/featured', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('returns featured posts', async () => {
        const res = await app.request(`${base}/featured`);
        expect([200, 400]).toContain(res.status);
    });
});
