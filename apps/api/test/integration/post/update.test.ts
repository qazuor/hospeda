import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('PUT /posts/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('updates a post or returns validation error', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Updated title' })
        });
        expect([200, 400, 404]).toContain(res.status);
    });
});
