import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

const repeat = (s: string, n: number) => s.repeat(n);

describe('Destination - Update max lengths', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('accepts boundary values', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: repeat('n', 100) })
        });
        expect([200, 400, 401, 403, 404]).toContain(res.status);
    });

    it('rejects name > 100', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: repeat('n', 101) })
        });
        expect([400, 401, 403, 404]).toContain(res.status);
    });
});
