import { accommodations, eq, getDb } from '@repo/db';
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
 * PUT /api/v1/protected/accommodations/:id.
 *
 * The update route lives in the protected tier (the public tier is read-only).
 * The owner is authorised through the listing-access chain (the seeded trial
 * supplies it, see `seedOwnedAccommodation`) and the ownership middleware.
 */
describe('PUT /protected/accommodations/:id (update)', () => {
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
        seeded = await seedOwnedAccommodation();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const put = ({
        id,
        actorId,
        body,
        withActor = true
    }: {
        readonly id: string;
        readonly actorId: string;
        readonly body: unknown;
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions: ownerPermissions })
                : { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(body)
        });

    const readName = async (id: string): Promise<string | undefined> => {
        const [row] = await getDb().select().from(accommodations).where(eq(accommodations.id, id));
        return row?.name;
    };

    it('updates the accommodation and persists the change', async () => {
        const res = await put({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: { name: 'Hotel Azul Renovado' }
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ id: seeded.id, name: 'Hotel Azul Renovado' });
        expect(await readName(seeded.id)).toBe('Hotel Azul Renovado');
    });

    it('answers 400 for an invalid accommodation type', async () => {
        const res = await put({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: { type: 'INVALID_TYPE' }
        });
        expect(res.status).toBe(400);
        expect(await readName(seeded.id)).toBe(seeded.name);
    });

    it('answers 400 for an invalid UUID in the path', async () => {
        const res = await put({
            id: 'not-a-uuid',
            actorId: seeded.ownerId,
            body: { name: 'Hotel Azul Renovado' }
        });
        expect(res.status).toBe(400);
    });

    it('answers 404 for an accommodation that does not exist', async () => {
        const res = await put({
            id: NONEXISTENT_UUID,
            actorId: seeded.ownerId,
            body: { name: 'Hotel Azul Renovado' }
        });
        expect(res.status).toBe(404);
    });

    it('answers 401 without an authenticated actor', async () => {
        const res = await put({
            id: seeded.id,
            actorId: seeded.ownerId,
            body: { name: 'Hotel Azul Renovado' },
            withActor: false
        });
        expect(res.status).toBe(401);
        expect(await readName(seeded.id)).toBe(seeded.name);
    });

    it('refuses a user who does not own the accommodation and writes nothing', async () => {
        const stranger = await createMockActorUser({ label: 'acc-update-stranger' });
        const res = await put({
            id: seeded.id,
            actorId: stranger.id,
            body: { name: 'Hotel Azul Renovado' }
        });
        expect(res.status).toBe(404);
        expect(await readName(seeded.id)).toBe(seeded.name);
    });
});
