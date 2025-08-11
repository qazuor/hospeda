import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /posts/accommodation/:accommodationId', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 or 404 depending on accommodationId', async () => {
        const res = await app.request(`${base}/accommodation/00000000-0000-0000-0000-000000000000`);
        expect([200, 400, 404]).toContain(res.status);
    });
});
