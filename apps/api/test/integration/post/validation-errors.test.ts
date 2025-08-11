import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Validation errors', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('POST /posts should validate required fields', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(400);
    });

    it('PUT /posts/:id should validate payload shape', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 123 })
        });
        expect([400, 404]).toContain(res.status);
    });
});
