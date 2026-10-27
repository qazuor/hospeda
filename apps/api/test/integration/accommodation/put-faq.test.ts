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
 * PUT /api/v1/protected/accommodations/:id/faqs/:faqId.
 *
 * The route lives in the protected tier. Its listing-access gate authorises the
 * OWNER through the trial plan (see `seedOwnedAccommodation`), and the service
 * then asks for ACCOMMODATION_UPDATE_OWN on an accommodation the actor owns.
 */
describe('PUT /protected/accommodations/:id/faqs/:faqId', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/protected/accommodations';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const ownerPermissions = [PermissionEnum.ACCOMMODATION_UPDATE_OWN];
    const updatedAnswer = 'The updated answer explains the new check-in policy.';
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

    const putFaq = ({
        id,
        faqId,
        actorId,
        body,
        withActor = true
    }: {
        readonly id: string;
        readonly faqId: string;
        readonly actorId: string;
        readonly body: unknown;
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}/${id}/faqs/${faqId}`, {
            method: 'PUT',
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions: ownerPermissions })
                : { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(body)
        });

    const readFaq = async (faqId: string) => {
        const [row] = await getDb()
            .select()
            .from(accommodationFaqs)
            .where(eq(accommodationFaqs.id, faqId));
        return row;
    };

    it('updates the FAQ and persists the change', async () => {
        const faqId = seeded.faqIds[0] ?? '';
        const res = await putFaq({
            id: seeded.id,
            faqId,
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.faq).toMatchObject({ id: faqId, answer: updatedAnswer });
        expect((await readFaq(faqId))?.answer).toBe(updatedAnswer);
    });

    it('keeps the fields the body leaves out', async () => {
        const faqId = seeded.faqIds[0] ?? '';
        const before = await readFaq(faqId);
        const res = await putFaq({
            id: seeded.id,
            faqId,
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(200);
        const after = await readFaq(faqId);
        expect(after?.question).toBe(before?.question);
        expect(after?.createdAt).toEqual(before?.createdAt);
    });

    it('answers 400 when a field breaks the schema', async () => {
        const faqId = seeded.faqIds[0] ?? '';
        const before = await readFaq(faqId);
        const res = await putFaq({
            id: seeded.id,
            faqId,
            actorId: seeded.ownerId,
            body: { answer: 'short' }
        });
        expect(res.status).toBe(400);
        expect((await readFaq(faqId))?.answer).toBe(before?.answer);
    });

    it('answers 400 when the body carries a field the schema does not allow', async () => {
        const res = await putFaq({
            id: seeded.id,
            faqId: seeded.faqIds[0] ?? '',
            actorId: seeded.ownerId,
            body: { displayOrder: 9 }
        });
        expect(res.status).toBe(400);
    });

    it('answers 400 for an invalid UUID in the path', async () => {
        const res = await putFaq({
            id: 'not-a-uuid',
            faqId: seeded.faqIds[0] ?? '',
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(400);
    });

    it('answers 400 for an invalid FAQ UUID in the path', async () => {
        const res = await putFaq({
            id: seeded.id,
            faqId: 'not-a-uuid',
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(400);
    });

    it('answers 404 for an accommodation that does not exist', async () => {
        const res = await putFaq({
            id: NONEXISTENT_UUID,
            faqId: seeded.faqIds[0] ?? '',
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(404);
    });

    it('answers 404 for a FAQ that does not exist', async () => {
        const res = await putFaq({
            id: seeded.id,
            faqId: NONEXISTENT_UUID,
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(404);
    });

    it('answers 404 for a FAQ that belongs to another accommodation', async () => {
        const other = await seedOwnedAccommodation({ faqCount: 1, ownerId: seeded.ownerId });
        const res = await putFaq({
            id: seeded.id,
            faqId: other.faqIds[0] ?? '',
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(404);
        expect((await readFaq(other.faqIds[0] ?? ''))?.answer).not.toBe(updatedAnswer);
    });

    it('answers 401 without an authenticated actor', async () => {
        const res = await putFaq({
            id: seeded.id,
            faqId: seeded.faqIds[0] ?? '',
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer },
            withActor: false
        });
        expect(res.status).toBe(401);
    });

    it('refuses a user who does not own the accommodation and writes nothing', async () => {
        const stranger = await createMockActorUser({ label: 'faq-stranger' });
        const faqId = seeded.faqIds[0] ?? '';
        const res = await putFaq({
            id: seeded.id,
            faqId,
            actorId: stranger.id,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(404);
        expect((await readFaq(faqId))?.answer).not.toBe(updatedAnswer);
    });

    const softDeleteFaq = async (faqId: string): Promise<void> => {
        await getDb()
            .update(accommodationFaqs)
            .set({ deletedAt: new Date() })
            .where(eq(accommodationFaqs.id, faqId));
    };

    it('answers 404 for a soft-deleted FAQ (HOS-1907)', async () => {
        const faqId = seeded.faqIds[0] ?? '';
        await softDeleteFaq(faqId);
        const res = await putFaq({
            id: seeded.id,
            faqId,
            actorId: seeded.ownerId,
            body: { answer: updatedAnswer }
        });
        expect(res.status).toBe(404);
    });
});
