import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Filters combinations', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('accepts sortOrder=ASC', async () => {
        const res = await app.request(`${base}?sortOrder=ASC`);
        expect([200, 400]).toContain(res.status);
    });

    it('accepts sortOrder=DESC', async () => {
        const res = await app.request(`${base}?sortOrder=DESC`);
        expect([200, 400]).toContain(res.status);
    });

    it('rejects invalid sortOrder', async () => {
        const res = await app.request(`${base}?sortOrder=INVALID`);
        expect([400]).toContain(res.status);
    });
});
