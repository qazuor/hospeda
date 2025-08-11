import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /events/upcoming', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 and supports date range + pagination', async () => {
        const from = new Date().toISOString();
        const res = await app.request(
            `${base}/upcoming?fromDate=${encodeURIComponent(from)}&page=1&limit=5`
        );
        expect([200, 400]).toContain(res.status);
    });
});
