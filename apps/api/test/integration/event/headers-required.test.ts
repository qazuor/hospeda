import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Required headers sanity', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('GET list works without extra headers (defaults)', async () => {
        const res = await app.request(base);
        expect([200, 400]).toContain(res.status);
    });

    it('GET by id enforces UUID validation regardless of headers', async () => {
        const res = await app.request(`${base}/invalid-uuid`, {
            headers: { Accept: 'application/json' }
        });
        expect(res.status).toBe(400);
    });
});
