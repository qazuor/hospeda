import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Pagination bounds', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('rejects invalid page', async () => {
        const res = await app.request(`${base}?page=0`);
        expect([400]).toContain(res.status);
    });

    it('rejects invalid limit', async () => {
        const res = await app.request(`${base}?limit=9999`);
        expect([400]).toContain(res.status);
    });
});
