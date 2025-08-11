import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Pagination bounds', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('page must be >= 1', async () => {
        const res = await app.request(`${base}?page=0`);
        expect([400]).toContain(res.status);
    });

    it('limit must be within bounds', async () => {
        const tooHigh = await app.request(`${base}?limit=1000`);
        expect([400]).toContain(tooHigh.status);

        const negative = await app.request(`${base}?limit=-5`);
        expect([400]).toContain(negative.status);
    });
});
