import { accommodations, eq, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { buildMockActorHeaders } from '../helpers/mock-admin-actor';
import {
    type SeededOwnedAccommodation,
    seedOwnedAccommodation
} from '../helpers/seed-owned-accommodation';

// The mock-actor headers are only honoured when CI is unset.
delete process.env.CI;

/**
 * POST /api/v1/protected/accommodations.
 *
 * The create route lives in the protected tier (the public tier is read-only).
 * It needs ACCOMMODATION_CREATE and a listing-access chain that authorises the
 * owner, which the seeded trial supplies (see `seedOwnedAccommodation`).
 */
describe('POST /protected/accommodations (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/protected/accommodations';
    const creatorPermissions = [PermissionEnum.ACCOMMODATION_CREATE];
    let host: SeededOwnedAccommodation;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        host = await seedOwnedAccommodation();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const validBody = () => ({
        name: 'Hotel Azul',
        summary: 'A cozy place near the beach',
        description: 'Comfortable rooms and great views by the sea of the river',
        type: 'HOTEL',
        address: 'Costanera 123',
        latitude: -32.48,
        longitude: -58.23,
        maxGuests: 4,
        bedrooms: 2,
        bathrooms: 1,
        basePrice: 120,
        currency: 'USD',
        ownerId: host.ownerId,
        destinationId: host.destinationId
    });

    const post = ({
        body,
        permissions = creatorPermissions,
        withActor = true
    }: {
        readonly body: unknown;
        readonly permissions?: readonly PermissionEnum[];
        readonly withActor?: boolean;
    }) =>
        app.request(base, {
            method: 'POST',
            headers: withActor
                ? buildMockActorHeaders({ actorId: host.ownerId, permissions })
                : { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(body)
        });

    const countAccommodations = async (): Promise<number> =>
        (await getDb().select({ id: accommodations.id }).from(accommodations)).length;

    it('creates an accommodation and persists it for the owner', async () => {
        const before = await countAccommodations();
        const res = await post({ body: validBody() });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data).toMatchObject({ name: 'Hotel Azul', ownerId: host.ownerId });
        expect(await countAccommodations()).toBe(before + 1);
        const [row] = await getDb()
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, body.data.id));
        expect(row?.name).toBe('Hotel Azul');
        expect(row?.ownerId).toBe(host.ownerId);
    });

    it('accepts optional fields', async () => {
        const res = await post({
            body: {
                ...validBody(),
                name: 'Hotel Verde',
                phone: '+54 3442 123456',
                email: 'hotel@example.com',
                website: 'https://example.com',
                allowsPets: true
            }
        });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.name).toBe('Hotel Verde');
    });

    it('answers 400 when required fields are missing', async () => {
        const before = await countAccommodations();
        const res = await post({
            body: { summary: 'short summary here', description: 'too short', type: 'APARTMENT' }
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
        expect(await countAccommodations()).toBe(before);
    });

    it('answers 400 when the name is empty', async () => {
        const res = await post({ body: { ...validBody(), name: '' } });
        expect(res.status).toBe(400);
    });

    it('answers 400 for an invalid accommodation type', async () => {
        const res = await post({ body: { ...validBody(), type: 'INVALID_TYPE' } });
        expect(res.status).toBe(400);
    });

    it('answers 400 for a destinationId that is not a UUID', async () => {
        const res = await post({ body: { ...validBody(), destinationId: 'not-a-uuid' } });
        expect(res.status).toBe(400);
    });

    it('answers 401 without an authenticated actor', async () => {
        const before = await countAccommodations();
        const res = await post({ body: validBody(), withActor: false });
        expect(res.status).toBe(401);
        expect(await countAccommodations()).toBe(before);
    });

    it('answers 403 when the actor lacks ACCOMMODATION_CREATE', async () => {
        const before = await countAccommodations();
        const res = await post({ body: validBody(), permissions: [] });
        expect(res.status).toBe(403);
        expect(await countAccommodations()).toBe(before);
    });
});
