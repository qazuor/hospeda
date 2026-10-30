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
 * PATCH /api/v1/admin/event-organizers/:id. The route gate asks for EVENT_ORGANIZER_UPDATE and the service asks for EVENT_ORGANIZER_MANAGE.
 *
 * HOS-1908 (fixed): the factory used to register the GET /:id gate for every
 * method on the shared `/:id` path, so PATCH also demanded VIEW. The editor
 * below therefore holds UPDATE without VIEW, and the last test pins that UPDATE
 * alone is enough.
 */
describe('PATCH /admin/event-organizers/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/admin/event-organizers';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    // No VIEW on purpose: PATCH needs only its own gate (HOS-1908).
    const editor: readonly PermissionEnum[] = [
        ...ADMIN_GATE_PERMISSIONS,
        PermissionEnum.EVENT_ORGANIZER_UPDATE,
        PermissionEnum.EVENT_ORGANIZER_MANAGE
    ];
    const without = (permission: PermissionEnum): readonly PermissionEnum[] =>
        editor.filter((candidate) => candidate !== permission);
    let actorId: string;
    let rowId: string;
    let seededValue: string | null | undefined;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        actorId = (await createMockActorUser({ label: 'event-organizer-patch' })).id;
        rowId = await seedRow();
        seededValue = await readField(rowId);
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const seedRow = async (): Promise<string> => {
        const suffix = randomUUID().slice(0, 8);
        const rows = await getDb()
            .insert(eventOrganizers)
            .values({
                name: `Organizer ${suffix}`,
                slug: `organizer-${suffix}`
            })
            .returning({ id: eventOrganizers.id });
        const id = rows[0]?.id;
        if (!id) throw new Error('seed event organizer: insert failed');
        return id;
    };

    const patch = ({
        id,
        permissions,
        body,
        withActor = true
    }: {
        readonly id: string;
        readonly permissions: readonly PermissionEnum[];
        readonly body: unknown;
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}/${id}`, {
            method: 'PATCH',
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions, role: RoleEnum.ADMIN })
                : { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(body)
        });

    const readField = async (id: string): Promise<string | null | undefined> => {
        const [row] = await getDb()
            .select({ value: eventOrganizers.name })
            .from(eventOrganizers)
            .where(eq(eventOrganizers.id, id));
        return row?.value;
    };

    it('answers 401 without an authenticated actor', async () => {
        const res = await patch({
            id: rowId,
            permissions: editor,
            body: { name: 'Updated Value' },
            withActor: false
        });
        expect(res.status).toBe(401);
    });

    it('answers 403 when the actor lacks the route permission (EVENT_ORGANIZER_UPDATE)', async () => {
        const res = await patch({
            id: rowId,
            permissions: without(PermissionEnum.EVENT_ORGANIZER_UPDATE),
            body: { name: 'Updated Value' }
        });
        expect(res.status).toBe(403);
        expect(await readField(rowId)).toBe(seededValue);
    });

    it('answers 403 when the actor lacks the service permission (EVENT_ORGANIZER_MANAGE)', async () => {
        const res = await patch({
            id: rowId,
            permissions: without(PermissionEnum.EVENT_ORGANIZER_MANAGE),
            body: { name: 'Updated Value' }
        });
        expect(res.status).toBe(403);
        expect(await readField(rowId)).toBe(seededValue);
    });

    it('answers 400 for an invalid UUID', async () => {
        const res = await patch({
            id: 'not-a-uuid',
            permissions: editor,
            body: { name: 'Updated Value' }
        });
        expect(res.status).toBe(400);
    });

    it('answers 400 when the body breaks the schema', async () => {
        const res = await patch({
            id: rowId,
            permissions: editor,
            body: { invalidField: 'value' }
        });
        expect(res.status).toBe(400);
        expect(await readField(rowId)).toBe(seededValue);
    });

    it('answers 404 for an event organizer that does not exist', async () => {
        const res = await patch({
            id: NONEXISTENT_UUID,
            permissions: editor,
            body: { name: 'Updated Value' }
        });
        expect(res.status).toBe(404);
    });

    it('updates the event organizer and persists the change', async () => {
        const res = await patch({
            id: rowId,
            permissions: editor,
            body: { name: 'Updated Value' }
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.id).toBe(rowId);
        expect(await readField(rowId)).toBe('Updated Value');
    });

    it('PATCH succeeds with UPDATE alone, without VIEW (HOS-1908)', async () => {
        expect(editor).not.toContain(PermissionEnum.EVENT_ORGANIZER_VIEW);
        const res = await patch({
            id: rowId,
            permissions: editor,
            body: { name: 'Updated Value' }
        });
        expect(res.status).toBe(200);
        expect(await readField(rowId)).toBe('Updated Value');
    });
});
