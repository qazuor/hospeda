import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Wrong content type on create', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 415 or 400 when content-type is not application/json', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: 'plain text'
        });
        expect([400, 415]).toContain(res.status);
    });
});
