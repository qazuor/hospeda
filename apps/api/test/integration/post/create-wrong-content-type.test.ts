import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('POST /posts - wrong content type', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 400 when content-type is not application/json', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: 'title=Hello'
        });
        expect([400]).toContain(res.status);
    });
});
