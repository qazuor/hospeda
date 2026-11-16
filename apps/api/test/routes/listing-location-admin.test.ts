/**
 * Admin routes of the one-address rule (HOS-1810): exception grant/removal and the
 * repeated-address report, for venues and accommodations.
 */
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types.js';

const mocks = vi.hoisted(() => ({
    grantException: vi.fn(),
    revokeException: vi.fn(),
    listDuplicateGroups: vi.fn(),
    actor: {
        value: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            roles: ['ADMIN'],
            permissions: ['access.panelAdmin', 'listing.locationException.manage']
        } as { id: string; roles: string[]; permissions: string[] }
    }
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db');
    return {
        ...actual,
        listingLocationModel: {
            ...actual.listingLocationModel,
            listDuplicateGroups: mocks.listDuplicateGroups
        }
    };
});

// The grant and the removal now run through service-core (one transaction that also
// writes the audit event); their behavior is covered by the integration suite.
vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        grantLocationException: mocks.grantException,
        revokeLocationException: mocks.revokeException
    };
});
vi.mock('../../src/lib/location-exception-notifications.js', () => ({
    notifyLocationExceptionDecision: vi.fn()
}));

vi.mock('../../src/utils/actor.js', () => ({
    getActorFromContext: () => mocks.actor.value,
    isGuestActor: (actor: { roles: readonly string[] }) => actor.roles.includes('GUEST'),
    createGuestActor: () => ({ id: 'guest', roles: ['GUEST'], permissions: [] })
}));
vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../../src/utils/response-helpers.js', async () => {
    const actual = await vi.importActual<typeof import('../../src/utils/response-helpers.js')>(
        '../../src/utils/response-helpers.js'
    );
    return {
        ...actual,
        // biome-ignore lint/suspicious/noExplicitAny: test-only simplification
        createResponse: (data: unknown, c: any, statusCode = 200) =>
            c.json({ success: true, data }, statusCode)
    };
});

import { adminVenueLocationRoutes } from '../../src/routes/listing-location/index.js';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    roles: ['ADMIN'],
    permissions: ['access.panelAdmin', 'listing.locationException.manage']
};
const post = (body: unknown) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>({ strict: false });
    app.route('/', adminVenueLocationRoutes.listDuplicates);
    app.route('/', adminVenueLocationRoutes.setException);
    app.route('/', adminVenueLocationRoutes.clearException);
    return app;
}

describe('venue one-address admin routes', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.actor.value = { ...ADMIN };
        mocks.grantException.mockResolvedValue(null);
        mocks.revokeException.mockResolvedValue(true);
        mocks.listDuplicateGroups.mockResolvedValue({ items: [], total: 0 });
        app = buildApp();
    });

    it('grants an exception with the admin, the reason and a date', async () => {
        const res = await app.request(
            `/${ID}/location-exception`,
            post({ reason: 'Food court, three venues share the building' })
        );
        expect(res.status).toBe(201);
        expect((await res.json()).data).toEqual({ id: ID, hasException: true });
        expect(mocks.grantException).toHaveBeenCalledWith({
            vertical: 'venue',
            listingId: ID,
            adminId: ADMIN.id,
            reason: 'Food court, three venues share the building'
        });
    });

    it('rejects a missing or too short reason with 400 and writes nothing', async () => {
        expect((await app.request(`/${ID}/location-exception`, post({}))).status).toBe(400);
        expect(
            (await app.request(`/${ID}/location-exception`, post({ reason: 'short' }))).status
        ).toBe(400);
        expect(mocks.grantException).not.toHaveBeenCalled();
    });

    it('answers 400 for a non-UUID id before touching the database', async () => {
        const res = await app.request(
            '/not-a-uuid/location-exception',
            post({ reason: 'A long enough reason' })
        );
        expect(res.status).toBe(400);
        expect(mocks.grantException).not.toHaveBeenCalled();
    });

    it('answers 409 LOCATION_EXCEPTION_NEEDS_KEY for a listing with no comparable address', async () => {
        mocks.grantException.mockRejectedValue(
            new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'no comparable address',
                undefined,
                'LOCATION_EXCEPTION_NEEDS_KEY'
            )
        );
        const res = await app.request(
            `/${ID}/location-exception`,
            post({ reason: 'A long enough reason' })
        );
        expect(res.status).toBe(409);
        expect((await res.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'LOCATION_EXCEPTION_NEEDS_KEY'
        });
    });

    it('answers 404 for a listing that does not exist', async () => {
        mocks.grantException.mockRejectedValue(
            new ServiceError(ServiceErrorCode.NOT_FOUND, 'venue not found')
        );
        const res = await app.request(
            `/${ID}/location-exception`,
            post({ reason: 'A long enough reason' })
        );
        expect(res.status).toBe(404);
    });

    it('answers 403 without the permission and 401 for a guest', async () => {
        mocks.actor.value = { ...ADMIN, permissions: ['access.panelAdmin'] };
        const forbidden = await app.request(
            `/${ID}/location-exception`,
            post({ reason: 'A long enough reason' })
        );
        expect(forbidden.status).toBe(403);

        mocks.actor.value = { id: 'guest', roles: ['GUEST'], permissions: [] };
        const guest = await app.request(
            `/${ID}/location-exception`,
            post({ reason: 'A long enough reason' })
        );
        expect(guest.status).toBe(401);
        expect(mocks.grantException).not.toHaveBeenCalled();
    });

    it('removes an exception', async () => {
        const res = await app.request(`/${ID}/location-exception`, { method: 'DELETE' });
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ id: ID, hasException: false });
        expect(mocks.revokeException).toHaveBeenCalledWith({
            vertical: 'venue',
            listingId: ID,
            adminId: ADMIN.id,
            reason: undefined
        });
    });

    it('lists the repeated-address groups with page and pageSize', async () => {
        mocks.listDuplicateGroups.mockResolvedValue({
            items: [
                {
                    locationKey: 'mitre|1|d',
                    listings: [
                        { id: ID, ownerId: ADMIN.id },
                        { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ownerId: ID }
                    ],
                    ownerCount: 2,
                    sameOwner: false
                }
            ],
            total: 1
        });
        const res = await app.request('/location-duplicates?page=2&pageSize=5');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ total: 1, page: 2, pageSize: 5 });
        expect(body.data.items[0].sameOwner).toBe(false);
        expect(mocks.listDuplicateGroups).toHaveBeenCalledWith({
            vertical: 'venue',
            page: 2,
            pageSize: 5
        });
    });

    it('requires the permission for the report too', async () => {
        mocks.actor.value = { ...ADMIN, permissions: ['access.panelAdmin'] };
        expect((await app.request('/location-duplicates')).status).toBe(403);
    });
});
