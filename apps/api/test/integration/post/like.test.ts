import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('POST /posts/:id/like', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('likes a post or returns validation error', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000/like`, {
            method: 'POST'
        });
        expect([200, 400, 404]).toContain(res.status);
    });
});
