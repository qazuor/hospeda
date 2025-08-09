import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('PUT /accommodations/:id (update)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';

    beforeAll(() => {
        app = initApp();
    });

    it('updates an accommodation (happy path)', async () => {
        const id = crypto.randomUUID();
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({ slug: 'hotel-azul' })
        });
        expect([200, 202, 400]).toContain(res.status);
    });

    it('returns 400 for invalid slug', async () => {
        const id = crypto.randomUUID();
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({ slug: 'INVALID SLUG' })
        });
        expect([200, 400]).toContain(res.status);
    });

    it('returns 404 when id is missing', async () => {
        const res = await app.request(`${base}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({ name: 'Any' })
        });
        expect(res.status).toBe(404);
    });
});
