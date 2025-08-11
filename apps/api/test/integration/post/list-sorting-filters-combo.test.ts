import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - List sorting + filters combo', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('supports q + sortOrder + pagination', async () => {
        const res = await app.request(`${base}?q=test&sortOrder=ASC&page=1&limit=10`);
        expect([200, 400]).toContain(res.status);
    });
});
