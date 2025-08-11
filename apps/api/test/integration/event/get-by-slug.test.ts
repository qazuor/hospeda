import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /events/slug/:slug', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200/404 or 400 (validation) depending on slug', async () => {
        const res = await app.request(`${base}/slug/some-slug`);
        expect([200, 404, 400]).toContain(res.status);
    });
});
