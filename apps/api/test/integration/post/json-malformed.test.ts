import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Malformed JSON', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 400 for malformed JSON on POST', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{ invalid json'
        });
        expect([400]).toContain(res.status);
    });
});
