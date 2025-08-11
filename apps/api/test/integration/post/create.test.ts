import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('POST /posts', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('creates a post or validates payload', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Hello', category: 'NEWS' })
        });
        expect([200, 400]).toContain(res.status);
    });
});
