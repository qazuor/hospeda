import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /accommodations/:id (getById)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 for an existing id (happy path)', async () => {
        const id = crypto.randomUUID();
        const res = await app.request(`${base}/${id}`, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('id');
        expect(body.data).toHaveProperty('name');
    });

    it('returns 400 for invalid id format', async () => {
        const res = await app.request(`${base}/not-a-uuid`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(400);
    });
});
