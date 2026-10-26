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
 * DELETE /api/v1/protected/accommodations/:id/faqs/:faqId.
 *
 * The route lives in the protected tier. Its listing-access gate authorises the
 * OWNER through the trial plan (see `seedOwnedAccommodation`), and the service
 * then asks for ACCOMMODATION_UPDATE_OWN on an accommodation the actor owns.
 * The delete is a soft delete.
 */
describe('DELETE /protected/accommodations/:id/faqs/:faqId', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/protected/accommodations';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const ownerPermissions = [PermissionEnum.ACCOMMODATION_UPDATE_OWN];
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

    const deleteFaq = ({
        id,
        faqId,
        actorId,
        withActor = true
    }: {
        readonly id: string;
        readonly faqId: string;
        readonly actorId: string;
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}/${id}/faqs/${faqId}`, {
            method: 'DELETE',
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions: ownerPermissions })
                : { 'user-agent': 'vitest' }
        });

    const readFaq = async (faqId: string) => {
        const [row] = await getDb()
            .select()
            .from(accommodationFaqs)
            .where(eq(accommodationFaqs.id, faqId));
        return row;
    };

    it('soft-deletes the FAQ and leaves the others untouched', async () => {
        const [target, sibling] = seeded.faqIds;
        const res = await deleteFaq({
            id: seeded.id,
            faqId: target ?? '',
            actorId: seeded.ownerId
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ success: true });
        expect((await readFaq(target ?? ''))?.deletedAt).toBeInstanceOf(Date);
        expect((await readFaq(sibling ?? ''))?.deletedAt).toBeNull();
    });

    it('answers 400 for an invalid accommodation UUID', async () => {
        const res = await deleteFaq({
            id: 'not-a-uuid',
            faqId: seeded.faqIds[0] ?? '',
            actorId: seeded.ownerId
        });
        expect(res.status).toBe(400);
    });

    it('answers 400 for an invalid FAQ UUID', async () => {
        const res = await deleteFaq({
            id: seeded.id,
            faqId: 'not-a-uuid',
            actorId: seeded.ownerId
        });
        expect(res.status).toBe(400);
    });

    it('answers 404 for an accommodation that does not exist', async () => {
        const res = await deleteFaq({
            id: NONEXISTENT_UUID,
            faqId: seeded.faqIds[0] ?? '',
            actorId: seeded.ownerId
        });
        expect(res.status).toBe(404);
    });

    it('answers 404 for a FAQ that does not exist', async () => {
        const res = await deleteFaq({
            id: seeded.id,
            faqId: NONEXISTENT_UUID,
            actorId: seeded.ownerId
        });
        expect(res.status).toBe(404);
    });

    it('answers 404 for a FAQ that belongs to another accommodation', async () => {
        const other = await seedOwnedAccommodation({ faqCount: 1, ownerId: seeded.ownerId });
        const res = await deleteFaq({
            id: seeded.id,
            faqId: other.faqIds[0] ?? '',
            actorId: seeded.ownerId
        });
        expect(res.status).toBe(404);
        expect((await readFaq(other.faqIds[0] ?? ''))?.deletedAt).toBeNull();
    });

    it('answers 401 without an authenticated actor', async () => {
        const faqId = seeded.faqIds[0] ?? '';
        const res = await deleteFaq({
            id: seeded.id,
            faqId,
            actorId: seeded.ownerId,
            withActor: false
        });
        expect(res.status).toBe(401);
        expect((await readFaq(faqId))?.deletedAt).toBeNull();
    });

    it('refuses a user who does not own the accommodation and deletes nothing', async () => {
        const stranger = await createMockActorUser({ label: 'faq-stranger' });
        const faqId = seeded.faqIds[0] ?? '';
        const res = await deleteFaq({ id: seeded.id, faqId, actorId: stranger.id });
        expect(res.status).toBe(404);
        expect((await readFaq(faqId))?.deletedAt).toBeNull();
    });

    // HOS-1907: removeFaq loads the FAQ with BaseModel.findById, which does not filter
    // deleted rows (accommodation.service.ts:2858), so an already deleted FAQ is found
    // and soft-deleted again.
    it('currently answers 200 when an already soft-deleted FAQ is deleted again (HOS-1907)', async () => {
        const faqId = seeded.faqIds[0] ?? '';
        const first = await deleteFaq({ id: seeded.id, faqId, actorId: seeded.ownerId });
        expect(first.status).toBe(200);
        const second = await deleteFaq({ id: seeded.id, faqId, actorId: seeded.ownerId });
        expect(second.status).toBe(200);
    });

    // Drop `.fails` (and the test above) once HOS-1907 is fixed.
    it.fails('answers 404 and keeps deletedAt when a soft-deleted FAQ is deleted again (HOS-1907)', async () => {
        const faqId = seeded.faqIds[0] ?? '';
        const first = await deleteFaq({ id: seeded.id, faqId, actorId: seeded.ownerId });
        expect(first.status).toBe(200);
        const deletedAtBefore = (await readFaq(faqId))?.deletedAt;
        expect(deletedAtBefore).toBeInstanceOf(Date);
        const second = await deleteFaq({ id: seeded.id, faqId, actorId: seeded.ownerId });
        expect(second.status).toBe(404);
        expect((await readFaq(faqId))?.deletedAt).toEqual(deletedAtBefore);
    });
});
