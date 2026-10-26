import { randomUUID } from 'node:crypto';
import { eq, eventOrganizers, getDb } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    ADMIN_GATE_PERMISSIONS,
    buildMockActorHeaders,
    createMockActorUser
} from '../helpers/mock-actor';

// The mock-actor headers are only honoured when CI is unset.
delete process.env.CI;

/**
 * POST /api/v1/admin/event-organizers/:id/restore. The route gate asks for EVENT_ORGANIZER_RESTORE and the service asks for EVENT_ORGANIZER_MANAGE.
 */
describe('POST /admin/event-organizers/:id/restore', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/admin/event-organizers';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const restorer: readonly PermissionEnum[] = [
        ...ADMIN_GATE_PERMISSIONS,
        PermissionEnum.EVENT_ORGANIZER_RESTORE,
        PermissionEnum.EVENT_ORGANIZER_MANAGE
    ];
    const without = (permission: PermissionEnum): readonly PermissionEnum[] =>
        restorer.filter((candidate) => candidate !== permission);
    let actorId: string;
    let deletedRowId: string;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        actorId = (await createMockActorUser({ label: 'event-organizer-restore' })).id;
        deletedRowId = await seedDeletedRow();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const seedDeletedRow = async (): Promise<string> => {
        const suffix = randomUUID().slice(0, 8);
        const rows = await getDb()
            .insert(eventOrganizers)
            .values({
                name: `Organizer ${suffix}`,
                slug: `organizer-${suffix}`,
                deletedAt: new Date()
            })
            .returning({ id: eventOrganizers.id });
        const id = rows[0]?.id;
        if (!id) throw new Error('seed event organizer: insert failed');
        return id;
    };

    const restore = ({
        id,
        permissions,
        withActor = true
    }: {
        readonly id: string;
        readonly permissions: readonly PermissionEnum[];
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}/${id}/restore`, {
            method: 'POST',
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions, role: RoleEnum.ADMIN })
                : { 'user-agent': 'vitest' }
        });

    const readDeletedAt = async (id: string): Promise<Date | null | undefined> => {
        const [row] = await getDb()
            .select({ deletedAt: eventOrganizers.deletedAt })
            .from(eventOrganizers)
            .where(eq(eventOrganizers.id, id));
        return row?.deletedAt;
    };

    it('answers 401 without an authenticated actor', async () => {
        const res = await restore({ id: deletedRowId, permissions: restorer, withActor: false });
        expect(res.status).toBe(401);
        expect(await readDeletedAt(deletedRowId)).toBeInstanceOf(Date);
    });

    it('answers 403 when the actor lacks the route permission (EVENT_ORGANIZER_RESTORE)', async () => {
        const res = await restore({
            id: deletedRowId,
            permissions: without(PermissionEnum.EVENT_ORGANIZER_RESTORE)
        });
        expect(res.status).toBe(403);
        expect(await readDeletedAt(deletedRowId)).toBeInstanceOf(Date);
    });

    it('answers 403 when the actor lacks the service permission (EVENT_ORGANIZER_MANAGE)', async () => {
        const res = await restore({
            id: deletedRowId,
            permissions: without(PermissionEnum.EVENT_ORGANIZER_MANAGE)
        });
        expect(res.status).toBe(403);
        expect(await readDeletedAt(deletedRowId)).toBeInstanceOf(Date);
    });

    it('answers 400 for an invalid UUID', async () => {
        const res = await restore({ id: 'not-a-uuid', permissions: restorer });
        expect(res.status).toBe(400);
    });

    it('answers 404 for an event organizer that does not exist', async () => {
        const res = await restore({ id: NONEXISTENT_UUID, permissions: restorer });
        expect(res.status).toBe(404);
    });

    it('restores a soft-deleted event organizer (POST answers 201) and clears deletedAt', async () => {
        const res = await restore({ id: deletedRowId, permissions: restorer });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.id).toBe(deletedRowId);
        expect(await readDeletedAt(deletedRowId)).toBeNull();
    });
});
