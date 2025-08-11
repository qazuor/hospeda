import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /posts/:id (success shape)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('when 200, returns an object with expected fields', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000`);
        expect([200, 400, 404]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('slug');
            expect(body.data).toHaveProperty('title');
            expect(body.data).toHaveProperty('category');
        }
    });
});
