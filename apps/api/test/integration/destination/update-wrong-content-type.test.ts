import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Destination - Update with wrong Content-Type', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('PUT should return 400/401/403/404/415 when Content-Type is text/plain', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: { 'content-type': 'text/plain' },
            body: 'name=Invalid'
        });
        expect([400, 401, 403, 404, 415]).toContain(res.status);
    });
});
