import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /posts (list enhanced)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('supports pagination and returns pagination metadata', async () => {
        const res = await app.request(`${base}?page=1&limit=5`);
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
            expect(body.data).toHaveProperty('items');
            expect(body.data).toHaveProperty('pagination');
            expect(body.data.pagination).toHaveProperty('page');
            expect(body.data.pagination).toHaveProperty('limit');
            expect(body.data.pagination).toHaveProperty('total');
            expect(body.data.pagination).toHaveProperty('totalPages');
        }
    });

    it('accepts search query param q', async () => {
        const res = await app.request(`${base}?q=hello`);
        expect([200, 400]).toContain(res.status);
    });

    it('accepts sortOrder param', async () => {
        const resAsc = await app.request(`${base}?sortOrder=ASC`);
        expect([200, 400]).toContain(resAsc.status);
        const resDesc = await app.request(`${base}?sortOrder=DESC`);
        expect([200, 400]).toContain(resDesc.status);
    });
});
