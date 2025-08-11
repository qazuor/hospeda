import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Malformed JSON handling', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('POST with malformed JSON body should return 400', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{ not: valid json'
        });
        expect([400]).toContain(res.status);
    });

    it('PUT with malformed JSON body should return 400', async () => {
        const res = await app.request(`${base}/00000000-0000-0000-0000-000000000000`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: '{ not: valid json'
        });
        expect([400, 404]).toContain(res.status);
    });
});
