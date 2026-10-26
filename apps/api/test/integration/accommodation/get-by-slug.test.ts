import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    type SeededPublicAccommodation,
    seedPublicAccommodation
} from '../helpers/seed-public-accommodation';

describe('GET /accommodations/slug/:slug (getBySlug)', () => {
    let app: ReturnType<typeof initApp>;
    let seeded: SeededPublicAccommodation;
    const base = '/api/v1/public/accommodations/slug';

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        seeded = await seedPublicAccommodation();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('returns 200 and the accommodation for an existing slug', async () => {
        const res = await app.request(`${base}/${seeded.slug}`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ id: seeded.id, slug: seeded.slug });
    });

    it('returns 404 for a slug that does not exist', async () => {
        const res = await app.request(`${base}/sample-slug-that-does-not-exist`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    });
});
