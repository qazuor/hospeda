import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    type SeededPublicAccommodation,
    seedPublicAccommodation
} from '../helpers/seed-public-accommodation';

describe('GET /accommodations/:id (getById)', () => {
    let app: ReturnType<typeof initApp>;
    let seeded: SeededPublicAccommodation;
    const base = '/api/v1/public/accommodations';
    const missingId = '99999999-9999-4999-8999-999999999999';

    beforeAll(async () => {
        await testDb.setup();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        seeded = await seedPublicAccommodation();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('returns 200 for an existing id (happy path)', async () => {
        const res = await app.request(`${base}/${seeded.id}`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ id: seeded.id, name: seeded.name, slug: seeded.slug });
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
        const res = await app.request(`${base}/${missingId}`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    });

    it('returns 400 for invalid id format', async () => {
        const res = await app.request(`${base}/not-a-uuid`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(400);
    });
});
