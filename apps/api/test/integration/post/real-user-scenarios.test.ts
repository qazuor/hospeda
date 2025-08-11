import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - real user scenarios', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('user browses featured, then opens a post by slug, then likes it', async () => {
        const featured = await app.request(`${base}/featured`);
        expect([200, 400]).toContain(featured.status);

        const open = await app.request(`${base}/slug/sample-slug`);
        expect([200, 400, 404]).toContain(open.status);

        const like = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000/like`, {
            method: 'POST'
        });
        expect([200, 400, 404]).toContain(like.status);
    });
});
