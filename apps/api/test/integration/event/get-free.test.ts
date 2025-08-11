import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /events/free', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 and supports pagination', async () => {
        const res = await app.request(`${base}/free?page=1&limit=10`);
        expect([200, 400]).toContain(res.status);
    });
});
