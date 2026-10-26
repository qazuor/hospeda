import { destinationReviews, eq, getDb } from '@repo/db';
import type { DestinationRatingInput } from '@repo/schemas';
import { DestinationRatingSchema, PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    ADMIN_GATE_PERMISSIONS,
    buildMockActorHeaders,
    createMockActorUser
} from '../helpers/mock-admin-actor';
import { seedPublicDestinations } from '../helpers/seed-public-destinations';

// The mock-actor headers are only honoured when CI is unset.
delete process.env.CI;

/** Every rating category the destination schema declares, each scored 4. */
const SEEDED_RATING = Object.fromEntries(
    Object.keys(DestinationRatingSchema.shape).map((key) => [key, 4])
) as DestinationRatingInput;

/**
 * Integration tests for the admin destination review CRUD routes.
 *
 * Reviews are registered as a sub-resource of destinations:
 *   GET    /api/v1/admin/destinations/reviews/:id
 *   PUT    /api/v1/admin/destinations/reviews/:id
 *   DELETE /api/v1/admin/destinations/reviews/:id
 *   POST   /api/v1/admin/destinations/reviews/:id/restore
 *   DELETE /api/v1/admin/destinations/reviews/:id/hard
 *
 * Every route has its own permission gate (VIEW, UPDATE + MODERATE, DELETE,
 * RESTORE, HARD_DELETE), and the service adds its own check on top. The
 * `/:id` gates are registered path-wide, so the full actor holds all of them.
 */
describe('Admin DestinationReview CRUD Routes', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/admin/destinations/reviews';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const fullPermissions: readonly PermissionEnum[] = [
        ...ADMIN_GATE_PERMISSIONS,
        PermissionEnum.DESTINATION_REVIEW_VIEW,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_MODERATE,
        PermissionEnum.DESTINATION_REVIEW_DELETE,
        PermissionEnum.DESTINATION_REVIEW_RESTORE,
        PermissionEnum.DESTINATION_REVIEW_HARD_DELETE
    ];
    const without = (permission: PermissionEnum): readonly PermissionEnum[] =>
        fullPermissions.filter((candidate) => candidate !== permission);

    let actorId: string;
    let parentId: string;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        actorId = (await createMockActorUser({ label: 'destination-review-admin-crud' })).id;
        parentId = await seedParent();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const seedParent = async (): Promise<string> => {
        const { destinations } = await seedPublicDestinations({ count: 1 });
        const id = destinations[0]?.id;
        if (!id) throw new Error('destination-review admin crud: destination seed failed');
        return id;
    };

    const seedReview = async ({
        deleted = false
    }: {
        readonly deleted?: boolean;
    } = {}): Promise<string> => {
        const rows = await getDb()
            .insert(destinationReviews)
            .values({
                destinationId: parentId,
                userId: actorId,
                title: 'Seeded review',
                content: 'Seeded review content for the admin CRUD tests.',
                rating: SEEDED_RATING,
                averageRating: 4,
                ...(deleted ? { deletedAt: new Date() } : {})
            })
            .returning({ id: destinationReviews.id });
        const id = rows[0]?.id;
        if (!id) throw new Error('destination-review admin crud: review insert failed');
        return id;
    };

    const send = ({
        method,
        path,
        permissions = fullPermissions,
        body,
        withActor = true
    }: {
        readonly method: 'GET' | 'PUT' | 'DELETE' | 'POST';
        readonly path: string;
        readonly permissions?: readonly PermissionEnum[];
        readonly body?: unknown;
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}${path}`, {
            method,
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions })
                : { 'content-type': 'application/json', 'user-agent': 'vitest' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });

    const readRow = async (id: string) => {
        const [row] = await getDb()
            .select()
            .from(destinationReviews)
            .where(eq(destinationReviews.id, id));
        return row;
    };

    describe('GET /admin/destinations/reviews/:id', () => {
        it('returns the seeded review', async () => {
            const id = await seedReview();
            const res = await send({ method: 'GET', path: `/${id}` });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.id).toBe(id);
            expect(body.data.title).toBe('Seeded review');
        });

        it('answers 404 for a review that does not exist', async () => {
            const res = await send({ method: 'GET', path: `/${NONEXISTENT_UUID}` });
            expect(res.status).toBe(404);
        });

        it('answers 400 for a non-UUID id', async () => {
            const res = await send({ method: 'GET', path: '/not-a-valid-uuid' });
            expect(res.status).toBe(400);
        });

        it('answers 401 when unauthenticated', async () => {
            const id = await seedReview();
            const res = await send({ method: 'GET', path: `/${id}`, withActor: false });
            expect(res.status).toBe(401);
        });

        it('answers 403 when the actor lacks the view permission', async () => {
            const id = await seedReview();
            const res = await send({
                method: 'GET',
                path: `/${id}`,
                permissions: without(PermissionEnum.DESTINATION_REVIEW_VIEW)
            });
            expect(res.status).toBe(403);
        });
    });

    describe('PUT /admin/destinations/reviews/:id', () => {
        const payload = { title: 'Updated title', content: 'Updated review content.' };

        it('updates the review and persists the change', async () => {
            const id = await seedReview();
            const res = await send({ method: 'PUT', path: `/${id}`, body: payload });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.title).toBe(payload.title);
            expect((await readRow(id))?.title).toBe(payload.title);
        });

        it('answers 404 for a review that does not exist', async () => {
            const res = await send({
                method: 'PUT',
                path: `/${NONEXISTENT_UUID}`,
                body: payload
            });
            expect(res.status).toBe(404);
        });

        it('answers 400 for an invalid UUID in the path', async () => {
            const res = await send({ method: 'PUT', path: '/not-a-uuid', body: payload });
            expect(res.status).toBe(400);
        });

        it('answers 400 when the body carries a field the schema does not allow', async () => {
            const id = await seedReview();
            const res = await send({
                method: 'PUT',
                path: `/${id}`,
                body: { unknownField: 'value' }
            });
            expect(res.status).toBe(400);
        });

        it('answers 401 when unauthenticated', async () => {
            const id = await seedReview();
            const res = await send({
                method: 'PUT',
                path: `/${id}`,
                body: payload,
                withActor: false
            });
            expect(res.status).toBe(401);
        });

        it('answers 403 when the actor lacks the update permission', async () => {
            const id = await seedReview();
            const res = await send({
                method: 'PUT',
                path: `/${id}`,
                body: payload,
                permissions: without(PermissionEnum.DESTINATION_REVIEW_UPDATE)
            });
            expect(res.status).toBe(403);
            expect((await readRow(id))?.title).toBe('Seeded review');
        });
    });

    describe('DELETE /admin/destinations/reviews/:id', () => {
        it('soft-deletes the review', async () => {
            const id = await seedReview();
            const res = await send({ method: 'DELETE', path: `/${id}` });
            expect(res.status).toBe(200);
            expect((await readRow(id))?.deletedAt).toBeInstanceOf(Date);
        });

        it('answers 404 for a review that does not exist', async () => {
            const res = await send({ method: 'DELETE', path: `/${NONEXISTENT_UUID}` });
            expect(res.status).toBe(404);
        });

        it('answers 401 when unauthenticated', async () => {
            const id = await seedReview();
            const res = await send({ method: 'DELETE', path: `/${id}`, withActor: false });
            expect(res.status).toBe(401);
            expect((await readRow(id))?.deletedAt).toBeNull();
        });

        it('answers 403 when the actor lacks the delete permission', async () => {
            const id = await seedReview();
            const res = await send({
                method: 'DELETE',
                path: `/${id}`,
                permissions: without(PermissionEnum.DESTINATION_REVIEW_DELETE)
            });
            expect(res.status).toBe(403);
            expect((await readRow(id))?.deletedAt).toBeNull();
        });
    });

    describe('POST /admin/destinations/reviews/:id/restore', () => {
        it('restores a soft-deleted review (POST answers 201)', async () => {
            const id = await seedReview({ deleted: true });
            const res = await send({ method: 'POST', path: `/${id}/restore` });
            expect(res.status).toBe(201);
            expect((await readRow(id))?.deletedAt).toBeNull();
        });

        it('answers 404 for a review that does not exist', async () => {
            const res = await send({ method: 'POST', path: `/${NONEXISTENT_UUID}/restore` });
            expect(res.status).toBe(404);
        });

        it('answers 400 for an invalid UUID in the path', async () => {
            const res = await send({ method: 'POST', path: '/not-a-uuid/restore' });
            expect(res.status).toBe(400);
        });

        it('answers 403 when the actor lacks the restore permission', async () => {
            const id = await seedReview({ deleted: true });
            const res = await send({
                method: 'POST',
                path: `/${id}/restore`,
                permissions: without(PermissionEnum.DESTINATION_REVIEW_RESTORE)
            });
            expect(res.status).toBe(403);
            expect((await readRow(id))?.deletedAt).toBeInstanceOf(Date);
        });
    });

    describe('DELETE /admin/destinations/reviews/:id/hard', () => {
        it('permanently deletes the review', async () => {
            const id = await seedReview();
            const res = await send({ method: 'DELETE', path: `/${id}/hard` });
            expect(res.status).toBe(200);
            expect(await readRow(id)).toBeUndefined();
        });

        it('answers 404 for a review that does not exist', async () => {
            const res = await send({ method: 'DELETE', path: `/${NONEXISTENT_UUID}/hard` });
            expect(res.status).toBe(404);
        });

        it('answers 401 when unauthenticated', async () => {
            const id = await seedReview();
            const res = await send({ method: 'DELETE', path: `/${id}/hard`, withActor: false });
            expect(res.status).toBe(401);
            expect(await readRow(id)).toBeDefined();
        });

        it('answers 403 when the actor lacks the hard-delete permission', async () => {
            const id = await seedReview();
            const res = await send({
                method: 'DELETE',
                path: `/${id}/hard`,
                permissions: without(PermissionEnum.DESTINATION_REVIEW_HARD_DELETE)
            });
            expect(res.status).toBe(403);
            expect(await readRow(id)).toBeDefined();
        });
    });
});
