import { accommodationFaqs, eq, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { buildMockActorHeaders, createMockActorUser } from '../helpers/mock-admin-actor';
import {
    type SeededOwnedAccommodation,
    seedOwnedAccommodation
} from '../helpers/seed-owned-accommodation';

// The mock-actor headers are only honoured when CI is unset.
delete process.env.CI;

/**
 * GET /api/v1/protected/accommodations/:id/faqs.
 *
 * The route lives in the protected tier (the public tier has no FAQ endpoint;
 * public readers get FAQs embedded in the accommodation detail). The service
 * reads the accommodation with its FAQs and gates it with the generic view
 * check, so any signed-in actor may read a PUBLISHED accommodation's FAQs.
 */
describe('GET /protected/accommodations/:id/faqs', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/protected/accommodations';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const hostPermissions = [PermissionEnum.ACCOMMODATION_VIEW_OWN];
    let seeded: SeededOwnedAccommodation;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        seeded = await seedOwnedAccommodation({ faqCount: 2 });
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const getFaqs = ({
        id,
        actorId,
        withActor = true
    }: {
        readonly id: string;
        readonly actorId: string;
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}/${id}/faqs`, {
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions: hostPermissions })
                : { 'user-agent': 'vitest', accept: 'application/json' }
        });

    it('returns the seeded FAQs of the owner accommodation', async () => {
        const res = await getFaqs({ id: seeded.id, actorId: seeded.ownerId });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.faqs).toHaveLength(2);
        expect(body.data.faqs.map((faq: { id: string }) => faq.id).sort()).toEqual(
            [...seeded.faqIds].sort()
        );
        expect(body.data.faqs[0]).toMatchObject({
            question: expect.any(String),
            answer: expect.any(String),
            createdAt: expect.any(String)
        });
    });

    it('returns an empty list for an accommodation without FAQs', async () => {
        await getDb()
            .delete(accommodationFaqs)
            .where(eq(accommodationFaqs.accommodationId, seeded.id));
        const res = await getFaqs({ id: seeded.id, actorId: seeded.ownerId });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.faqs).toEqual([]);
    });

    it('lets another signed-in user read the FAQs of a published accommodation', async () => {
        const other = await createMockActorUser({ label: 'faq-reader' });
        const res = await getFaqs({ id: seeded.id, actorId: other.id });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.faqs).toHaveLength(2);
    });

    it('answers 404 for an accommodation that does not exist', async () => {
        const res = await getFaqs({ id: NONEXISTENT_UUID, actorId: seeded.ownerId });
        expect(res.status).toBe(404);
    });

    it('answers 400 for an invalid UUID', async () => {
        const res = await getFaqs({ id: 'not-a-uuid', actorId: seeded.ownerId });
        expect(res.status).toBe(400);
    });

    it('answers 401 without an authenticated actor', async () => {
        const res = await getFaqs({ id: seeded.id, actorId: seeded.ownerId, withActor: false });
        expect(res.status).toBe(401);
    });
});
