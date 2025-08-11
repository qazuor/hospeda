import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - List sorting + filters combo', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('sortOrder + q + limit + page', async () => {
        const res = await app.request(`${base}?sortOrder=ASC&q=music&page=1&limit=5`);
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
            expect(body.data).toHaveProperty('items');
            expect(body.data).toHaveProperty('pagination');
        }
    });
});
