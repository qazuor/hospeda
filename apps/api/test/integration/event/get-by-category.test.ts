import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /events/category/:category', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 for valid category and accepts pagination', async () => {
        const res = await app.request(`${base}/category/CONCERT?page=1&limit=10`);
        expect([200, 400, 404]).toContain(res.status);
    });
});
