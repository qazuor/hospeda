import { destinations, eq, eventLocations, getDb } from '@repo/db';
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
 * DELETE /api/v1/admin/event-locations/:id/hard. The route gate asks for EVENT_LOCATION_HARD_DELETE and the service asks for EVENT_LOCATION_UPDATE.
 */
describe('DELETE /admin/event-locations/:id/hard (hard delete)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/admin/event-locations';
    const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
    const deleter = [
        ...ADMIN_GATE_PERMISSIONS,
        PermissionEnum.EVENT_LOCATION_HARD_DELETE,
        PermissionEnum.EVENT_LOCATION_UPDATE
    ];
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
        actorId = (await createMockActorUser({ label: 'event-location-hard-delete' })).id;
        rowId = await seedRow({});
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const seedDestination = async (): Promise<string> => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const rows = await getDb()
            .insert(destinations)
            .values({
                slug: `dest-${suffix}`,
                name: `Destination ${suffix}`,
                summary: 'Destination seeded for event location admin tests.',
                description: 'Destination seeded for event location admin tests.',
                destinationType: 'CITY',
                path: `/dest-${suffix}`,
                pathIds: '',
                level: 4,
                location: {
                    country: 'AR',
                    state: 'ER',
                    coordinates: { lat: '-32.48', long: '-58.23' }
                }
            })
            .returning({ id: destinations.id });
        return rows[0]?.id ?? '';
    };

    const seedRow = async ({
        deleted = false
    }: {
        readonly deleted?: boolean;
    }): Promise<string> => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const destinationId = await seedDestination();
        const rows = await getDb()
            .insert(eventLocations)
            .values({
                slug: `location-${suffix}`,
                destinationId,
                ...(deleted ? { deletedAt: new Date() } : {})
            })
            .returning({ id: eventLocations.id });
        return rows[0]?.id ?? '';
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
                ? buildMockActorHeaders({ actorId, permissions })
                : { 'user-agent': 'vitest' }
        });

    const countRows = async (id: string): Promise<number> =>
        (
            await getDb()
                .select({ id: eventLocations.id })
                .from(eventLocations)
                .where(eq(eventLocations.id, id))
        ).length;

    it('answers 401 without an authenticated actor', async () => {
        const res = await hardDelete({ id: rowId, permissions: deleter, withActor: false });
        expect(res.status).toBe(401);
        expect(await countRows(rowId)).toBe(1);
    });

    it('answers 403 when the actor lacks the hard-delete permission', async () => {
        const res = await hardDelete({ id: rowId, permissions: ADMIN_GATE_PERMISSIONS });
        expect(res.status).toBe(403);
        expect(await countRows(rowId)).toBe(1);
    });

    it('answers 400 for an invalid UUID', async () => {
        const res = await hardDelete({ id: 'not-a-uuid', permissions: deleter });
        expect(res.status).toBe(400);
    });

    it('answers 404 for an event location that does not exist', async () => {
        const res = await hardDelete({ id: NONEXISTENT_UUID, permissions: deleter });
        expect(res.status).toBe(404);
    });

    it('permanently deletes the event location', async () => {
        const res = await hardDelete({ id: rowId, permissions: deleter });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ success: true });
        expect(await countRows(rowId)).toBe(0);
    });

    // HOS-1903: BaseCrudService.hardDelete returns
    // { count: 0 } for a soft-deleted row (base.crud.write.ts:322), so the route
    // answers success while the row stays in the table.
    it.fails('permanently deletes an event location that was soft-deleted first', async () => {
        const softDeletedId = await seedRow({ deleted: true });
        const res = await hardDelete({ id: softDeletedId, permissions: deleter });
        expect(res.status).toBe(200);
        expect(await countRows(softDeletedId)).toBe(0);
    });
});
