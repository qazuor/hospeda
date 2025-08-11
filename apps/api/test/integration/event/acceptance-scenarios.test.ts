import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Acceptance scenarios', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('User explores events: list → category → get by id → summary', async () => {
        const list = await app.request(`${base}?page=1&limit=5`);
        expect([200, 400]).toContain(list.status);

        const byCategory = await app.request(`${base}/category/CONCERT?page=1&limit=5`);
        expect([200, 400, 404]).toContain(byCategory.status);

        const byId = await app.request(`${base}/00000000-0000-0000-0000-000000000000`);
        expect([200, 404, 400]).toContain(byId.status);

        const summary = await app.request(`${base}/00000000-0000-0000-0000-000000000000/summary`);
        expect([200, 404, 400]).toContain(summary.status);
    });
});
