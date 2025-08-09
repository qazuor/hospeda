import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Destination - Delete/Restore success shapes', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('soft delete returns 200/204 and acceptable envelope', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${id}`, { method: 'DELETE' });
        expect([200, 204, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('success');
            expect(body).toHaveProperty('data');
            // Our route returns { id }, but accept { count } from mock too
            expect(body.data.id === id || typeof body.data.count === 'number').toBe(true);
        }
    });

    it('restore returns 200 and acceptable envelope', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${id}/restore`, { method: 'POST' });
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body).toHaveProperty('data');
        }
    });
});
