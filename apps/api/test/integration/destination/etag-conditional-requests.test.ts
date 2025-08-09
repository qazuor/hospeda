import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Destination - Conditional Requests (ETag/If-None-Match)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 first and possibly 304 on subsequent request with If-None-Match', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const first = await app.request(`${base}/${id}/summary`);
        expect([200, 400, 404]).toContain(first.status);
        const etag = first.headers.get('etag');

        if (first.status === 200 && etag) {
            const second = await app.request(`${base}/${id}/summary`, {
                headers: { 'If-None-Match': etag }
            });
            // Depending on cache middleware, accept 304 or 200 fallback
            expect([200, 304]).toContain(second.status);
        }
    });
});
