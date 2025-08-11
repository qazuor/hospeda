import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Filters combinations', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('category + isFeatured + q', async () => {
        const res = await app.request(`${base}?category=CONCERT&isFeatured=true&q=live`);
        expect([200, 400]).toContain(res.status);
    });

    it('date range + q', async () => {
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 2 * 86400000).toISOString();
        const res = await app.request(
            `${base}?date.from=${encodeURIComponent(from)}&date.to=${encodeURIComponent(to)}&q=music`
        );
        expect([200, 400]).toContain(res.status);
    });
});
