import { accommodationFaqs, eq, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { buildMockActorHeaders, createMockActorUser } from '../helpers/mock-actor';
import {
    type SeededOwnedAccommodation,
    seedOwnedAccommodation
} from '../helpers/seed-owned-accommodation';

// The mock-actor headers are only honoured when CI is unset.
delete process.env.CI;

/**
 * POST /api/v1/protected/accommodations/:id/faqs.
 *
 * The route lives in the protected tier. Its listing-access gate authorises the
 * OWNER through the trial plan (see `seedOwnedAccommodation`), and the service
 * then asks for ACCOMMODATION_UPDATE_OWN on an accommodation the actor owns.
 */
describe('POST /protected/accommodations/:id/faqs', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/protected/accommodations';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const ownerPermissions = [PermissionEnum.ACCOMMODATION_UPDATE_OWN];
    const validFaq = {
        question: 'What time is check-in at the hotel?',
        answer: 'Check-in starts at 14:00 and runs until midnight.'
    };
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
        seeded = await seedOwnedAccommodation({ faqCount: 1 });
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const postFaq = ({
        id,
        actorId,
        body,
        permissions = ownerPermissions,
        withActor = true
    }: {
        readonly id: string;
        readonly actorId: string;
        readonly body: unknown;
        readonly permissions?: readonly PermissionEnum[];
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}/${id}/faqs`, {
            method: 'POST',
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions })
                : { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(body)
        });

    const countFaqs = async (): Promise<number> =>
        (
            await getDb()
                .select({ id: accommodationFaqs.id })
                .from(accommodationFaqs)
                .where(eq(accommodationFaqs.accommodationId, seeded.id))
        ).length;

    it('creates the FAQ for the owner and appends it after the existing ones', async () => {
        const res = await postFaq({ id: seeded.id, actorId: seeded.ownerId, body: validFaq });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.faq).toMatchObject(validFaq);
        expect(await countFaqs()).toBe(2);
        const [created] = await getDb()
            .select()
            .from(accommodationFaqs)
            .where(eq(accommodationFaqs.id, body.data.faq.id));
        expect(created?.displayOrder).toBe(1);
    });

    it('accepts an optional category', async () => {
        const res = await postFaq({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: { ...validFaq, category: 'Check-in' }
        });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.faq.category).toBe('Check-in');
    });

    it('answers 400 when a required field is missing', async () => {
        const res = await postFaq({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: { question: validFaq.question }
        });
        expect(res.status).toBe(400);
        expect(await countFaqs()).toBe(1);
    });

    it('answers 400 when the question is shorter than the minimum', async () => {
        const res = await postFaq({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: { ...validFaq, question: 'Short?' }
        });
        expect(res.status).toBe(400);
    });

    it('answers 400 when the answer is longer than the maximum', async () => {
        const res = await postFaq({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: { ...validFaq, answer: 'a'.repeat(2001) }
        });
        expect(res.status).toBe(400);
    });

    it('answers 400 when the body carries a field the schema does not allow', async () => {
        const res = await postFaq({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: { ...validFaq, displayOrder: 5 }
        });
        expect(res.status).toBe(400);
    });

    it('answers 400 for an invalid UUID in the path', async () => {
        const res = await postFaq({
            id: 'not-a-uuid',
            actorId: seeded.ownerId,
            body: validFaq
        });
        expect(res.status).toBe(400);
    });

    it('answers 404 for an accommodation that does not exist', async () => {
        const res = await postFaq({
            id: NONEXISTENT_UUID,
            actorId: seeded.ownerId,
            body: validFaq
        });
        expect(res.status).toBe(404);
    });

    it('answers 401 without an authenticated actor', async () => {
        const res = await postFaq({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: validFaq,
            withActor: false
        });
        expect(res.status).toBe(401);
        expect(await countFaqs()).toBe(1);
    });

    it('refuses a user who does not own the accommodation and writes nothing', async () => {
        const stranger = await createMockActorUser({ label: 'faq-stranger' });
        const res = await postFaq({ id: seeded.id, actorId: stranger.id, body: validFaq });
        expect(res.status).toBe(404);
        expect(await countFaqs()).toBe(1);
    });
});
