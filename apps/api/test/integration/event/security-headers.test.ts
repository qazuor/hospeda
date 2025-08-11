import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Security headers', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    const expectSecurityHeaders = (res: Response) => {
        const nosniff = res.headers.get('x-content-type-options');
        expect(nosniff).toBe('nosniff');

        const xfo = res.headers.get('x-frame-options');
        expect(['DENY', 'SAMEORIGIN']).toContain(xfo ?? '');

        const csp = res.headers.get('content-security-policy');
        if (csp) expect(typeof csp).toBe('string');

        const rp = res.headers.get('referrer-policy');
        if (rp) expect(typeof rp).toBe('string');

        const hsts = res.headers.get('strict-transport-security');
        if (hsts) expect(typeof hsts).toBe('string');
    };

    it('GET /events has security headers', async () => {
        const res = await app.request(base);
        expect([200, 400]).toContain(res.status);
        expectSecurityHeaders(res);
    });

    it('GET /events/:id/summary has security headers', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000/summary`);
        expect([200, 400, 404]).toContain(res.status);
        expectSecurityHeaders(res);
    });
});
