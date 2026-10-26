import { randomUUID } from 'node:crypto';
import { attractions, eq, getDb } from '@repo/db';
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
 * DELETE /api/v1/admin/attractions/:id/hard. The route gate asks for ATTRACTION_HARD_DELETE and the service (attractions reuse the destination permission set) asks for DESTINATION_DELETE.
 */
describe('DELETE /admin/attractions/:id/hard (hard delete)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/admin/attractions';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const deleter: readonly PermissionEnum[] = [
        ...ADMIN_GATE_PERMISSIONS,
        PermissionEnum.ATTRACTION_HARD_DELETE,
        PermissionEnum.DESTINATION_DELETE
    ];
    const without = (permission: PermissionEnum): readonly PermissionEnum[] =>
        deleter.filter((candidate) => candidate !== permission);
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
        actorId = (await createMockActorUser({ label: 'attraction-hard-delete' })).id;
        rowId = await seedRow({});
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const seedRow = async ({
        deleted = false
    }: {
        readonly deleted?: boolean;
    }): Promise<string> => {
        const suffix = randomUUID().slice(0, 8);
        const rows = await getDb()
            .insert(attractions)
            .values({
                name: `Attraction ${suffix}`,
                slug: `attraction-${suffix}`,
                ...(deleted ? { deletedAt: new Date() } : {})
            })
            .returning({ id: attractions.id });
        const id = rows[0]?.id;
        if (!id) throw new Error('seed attraction: insert failed');
        return id;
    };

    const hardDelete = ({
        id,
        permissions,
        withActor = true
    }: {
        readonly id: string;
        readonly permissions: readonly PermissionEnum[];
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}/${id}/hard`, {
            method: 'DELETE',
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions, role: RoleEnum.ADMIN })
                : { 'user-agent': 'vitest' }
        });

    const countRows = async (id: string): Promise<number> =>
        (
            await getDb()
                .select({ id: attractions.id })
                .from(attractions)
                .where(eq(attractions.id, id))
        ).length;

    it('answers 401 without an authenticated actor', async () => {
        const res = await hardDelete({ id: rowId, permissions: deleter, withActor: false });
        expect(res.status).toBe(401);
        expect(await countRows(rowId)).toBe(1);
    });

    it('answers 403 when the actor lacks the route permission (ATTRACTION_HARD_DELETE)', async () => {
        const res = await hardDelete({
            id: rowId,
            permissions: without(PermissionEnum.ATTRACTION_HARD_DELETE)
        });
        expect(res.status).toBe(403);
        expect(await countRows(rowId)).toBe(1);
    });

    it('answers 403 when the actor lacks the service permission (DESTINATION_DELETE)', async () => {
        const res = await hardDelete({
            id: rowId,
            permissions: without(PermissionEnum.DESTINATION_DELETE)
        });
        expect(res.status).toBe(403);
        expect(await countRows(rowId)).toBe(1);
    });

    it('answers 400 for an invalid UUID', async () => {
        const res = await hardDelete({ id: 'not-a-uuid', permissions: deleter });
        expect(res.status).toBe(400);
    });

    it('answers 404 for an attraction that does not exist', async () => {
        const res = await hardDelete({ id: NONEXISTENT_UUID, permissions: deleter });
        expect(res.status).toBe(404);
    });

    it('permanently deletes the attraction', async () => {
        const res = await hardDelete({ id: rowId, permissions: deleter });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ success: true });
        expect(await countRows(rowId)).toBe(0);
    });

    // HOS-1903: BaseCrudService.hardDelete returns { count: 0 } for a soft-deleted row
    // (base.crud.write.ts:322), so the route answers success while the row stays.
    it('currently answers 200 but keeps a soft-deleted attraction in the table (HOS-1903)', async () => {
        const softDeletedId = await seedRow({ deleted: true });
        const res = await hardDelete({ id: softDeletedId, permissions: deleter });
        expect(res.status).toBe(200);
        expect(await countRows(softDeletedId)).toBe(1);
    });

    // Drop `.fails` (and the test above) once HOS-1903 is fixed.
    it.fails('permanently deletes an attraction that was soft-deleted first (HOS-1903)', async () => {
        const softDeletedId = await seedRow({ deleted: true });
        const res = await hardDelete({ id: softDeletedId, permissions: deleter });
        expect(res.status).toBe(200);
        expect(await countRows(softDeletedId)).toBe(0);
    });
});
