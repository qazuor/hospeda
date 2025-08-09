import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /destinations/:id/summary', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('returns summary or 404 (or 400 depending on validation)', async () => {
        const res = await app.request(`${base}/00000000-0000-0000-0000-000000000000/summary`);
        expect([200, 400, 404]).toContain(res.status);
    });
});
