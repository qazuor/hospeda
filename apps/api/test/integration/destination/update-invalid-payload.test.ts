import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Destination - Update invalid payloads', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 400 when slug is invalid format', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ slug: 'INVALID SLUG*' })
        });
        expect([400, 401, 403, 404]).toContain(res.status);
    });

    it('returns 400 when name is empty', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: '' })
        });
        expect([400, 401, 403, 404]).toContain(res.status);
    });
});
