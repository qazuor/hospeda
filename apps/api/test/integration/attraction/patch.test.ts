import { attractions, eq, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
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

// The mock-actor headers are only honoured when CI is unset.
delete process.env.CI;

/**
 * PATCH /api/v1/admin/attractions/:id. The route gate asks for ATTRACTION_UPDATE and the service (attractions reuse the destination permission set) asks for DESTINATION_UPDATE, so a request that should succeed holds both. It also needs ATTRACTION_VIEW: the
 * GET /:id route registers its permission gate on the same `/:id` path for every
 * method, so it runs ahead of the PATCH handler.
 */
describe('PATCH /admin/attractions/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/admin/attractions';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const viewer = [...ADMIN_GATE_PERMISSIONS, PermissionEnum.ATTRACTION_VIEW];
    const editor = [...viewer, PermissionEnum.ATTRACTION_UPDATE, PermissionEnum.DESTINATION_UPDATE];
    let actorId: string;
    let rowId: string;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        actorId = (await createMockActorUser({ label: 'attraction-patch' })).id;
        rowId = await seedRow();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const seedRow = async (): Promise<string> => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const rows = await getDb()
            .insert(attractions)
            .values({
                name: `Attraction ${suffix}`,
                slug: `attraction-${suffix}`
            })
            .returning({ id: attractions.id });
        return rows[0]?.id ?? '';
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
                ? buildMockActorHeaders({ actorId, permissions })
                : { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(body)
        });

    const readField = async (id: string): Promise<string | null | undefined> => {
        const [row] = await getDb()
            .select({ value: attractions.name })
            .from(attractions)
            .where(eq(attractions.id, id));
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

    it('answers 403 when the actor lacks the update permission', async () => {
        const res = await patch({
            id: rowId,
            permissions: viewer,
            body: { name: 'Updated Value' }
        });
        expect(res.status).toBe(403);
        expect(await readField(rowId)).not.toBe('Updated Value');
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
        const res = await patch({ id: rowId, permissions: editor, body: { name: 'ab' } });
        expect(res.status).toBe(400);
        expect(await readField(rowId)).not.toBe('Updated Value');
    });

    it('answers 404 for an attraction that does not exist', async () => {
        const res = await patch({
            id: NONEXISTENT_UUID,
            permissions: editor,
            body: { name: 'Updated Value' }
        });
        expect(res.status).toBe(404);
    });

    it('updates the attraction and persists the change', async () => {
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
});
