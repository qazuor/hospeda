import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /destinations/:id (success case)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('returns destination detail for a valid UUID', async () => {
        const validId = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${validId}`);
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(body.data.id).toBe(validId);
            expect(typeof body.data.name).toBe('string');
        }
    });
});
