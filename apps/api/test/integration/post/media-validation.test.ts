import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - Media validation in create/update', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';
    const id = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('rejects create with invalid media.featuredImage shape', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Bad', category: 'NEWS', media: { featuredImage: {} } })
        });
        expect([400]).toContain(res.status);
    });

    it('rejects update with invalid media.gallery item', async () => {
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ media: { featuredImage: { url: 'x' }, gallery: [{}] } })
        });
        expect([400, 404]).toContain(res.status);
    });
});
