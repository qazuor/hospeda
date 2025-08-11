import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - like/unlike sequence', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';
    const id = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        app = initApp();
    });

    it('like then unlike should both return success or acceptable errors', async () => {
        const like = await app.request(`${base}/${id}/like`, { method: 'POST' });
        expect([200, 400, 404]).toContain(like.status);

        const unlike = await app.request(`${base}/${id}/unlike`, { method: 'POST' });
        expect([200, 400, 404]).toContain(unlike.status);
    });
});
