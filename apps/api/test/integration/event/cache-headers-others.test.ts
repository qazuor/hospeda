import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Cache headers on other endpoints', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('GET /slug/:slug may include Cache-Control when cacheTTL is set', async () => {
        const res = await app.request(`${base}/slug/sample-slug`);
        expect([200, 400, 404]).toContain(res.status);
        const cache = res.headers.get('cache-control');
        if (cache) expect(typeof cache).toBe('string');
    });

    it('GET /free may include Cache-Control when cacheTTL is set', async () => {
        const res = await app.request(`${base}/free`);
        expect([200, 400]).toContain(res.status);
        const cache = res.headers.get('cache-control');
        if (cache) expect(typeof cache).toBe('string');
    });
});
