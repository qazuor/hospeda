/**
 * HOS-2192: owner-requested location exceptions, end to end against the migrated
 * database. The owner asks, the admin approves or rejects, the admin revokes, and
 * every step lands on the audit trail.
 *
 * Venues stand in for both verticals: the two share one set of routes built by
 * `createOwnerLocationRoutes` / `createAdminLocationRoutes`.
 */

import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    createVerticalDestination,
    createVerticalListing,
    readResponse
} from '../listing-publication/publication-routes.helpers';

const app = initApp();
const REASON = 'Es un patio gastronomico con tres locales en la misma direccion';
const KEY = 'san martin|123|dest';
const ADMIN_BASE = '/api/v1/admin/venues';

const users: string[] = [];

async function seedUser(): Promise<string> {
    const user = await createOwner();
    users.push(user.id);
    return user.id;
}

function ownerHeaders(id: string) {
    return actorHeaders({ id });
}

function adminHeaders(
    id: string,
    permissions: readonly PermissionEnum[] = [PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE]
) {
    return actorHeaders({
        id,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions]
    });
}

/** Two venues of one owner on the same address: `published` is live, `draft` wants in. */
async function seedPair(ownerId: string, key: string | null = KEY) {
    const destinationId = await createVerticalDestination();
    const published = await createVerticalListing({
        vertical: VerticalEnum.VENUE,
        ownerId,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    const draft = await createVerticalListing({
        vertical: VerticalEnum.VENUE,
        ownerId,
        destinationId,
        status: PublicationStatusEnum.DRAFT
    });
    await getDb().execute(
        sql`UPDATE venues SET location_key = ${key} WHERE id IN (${published}::uuid, ${draft}::uuid)`
    );
    return { published, draft };
}

function post(path: string, headers: Record<string, string>, body?: unknown) {
    return app.request(path, {
        method: 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

const ask = (id: string, headers: Record<string, string>, reason: unknown = REASON) =>
    post(`/api/v1/protected/venues/${id}/location-exception-request`, headers, { reason });

async function events(listingId: string) {
    const rows = await getDb().execute(
        sql`SELECT action, actor_id AS "actorId", reason, location_key AS "locationKey", request_id AS "requestId"
            FROM location_exception_event WHERE entity_id = ${listingId}::uuid ORDER BY created_at, id`
    );
    return rows.rows as {
        action: string;
        actorId: string | null;
        reason: string | null;
        locationKey: string | null;
        requestId: string | null;
    }[];
}

async function requestRows(listingId: string) {
    const rows = await getDb().execute(
        sql`SELECT id, status, reason, decision_reason AS "decisionReason", decided_by AS "decidedBy"
            FROM location_exception_request WHERE entity_id = ${listingId}::uuid ORDER BY requested_at DESC, id`
    );
    return rows.rows as {
        id: string;
        status: string;
        reason: string;
        decisionReason: string | null;
        decidedBy: string | null;
    }[];
}

async function grantColumns(id: string) {
    const rows = await getDb().execute(
        sql`SELECT location_exception_by AS by, location_exception_key AS key FROM venues WHERE id = ${id}::uuid`
    );
    return rows.rows[0] as { by: string | null; key: string | null };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    for (const userId of users.splice(0)) {
        await getDb().execute(
            sql`DELETE FROM location_exception_event WHERE entity_id IN (SELECT id FROM venues WHERE owner_id = ${userId}::uuid)`
        );
        await getDb().execute(
            sql`DELETE FROM location_exception_request WHERE entity_id IN (SELECT id FROM venues WHERE owner_id = ${userId}::uuid)`
        );
        await getDb().execute(sql`DELETE FROM venues WHERE owner_id = ${userId}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('POST /protected/venues/:id/location-exception-request', () => {
    it('creates a pending request and appends a REQUESTED event', async () => {
        const owner = await seedUser();
        const { draft } = await seedPair(owner);

        const res = await readResponse(await ask(draft, ownerHeaders(owner)));

        expect(res.status).toBe(201);
        expect(await requestRows(draft)).toMatchObject([{ status: 'PENDING', reason: REASON }]);
        expect(await events(draft)).toMatchObject([
            { action: 'REQUESTED', actorId: owner, reason: REASON, locationKey: KEY }
        ]);
    });

    it('answers 404 for a listing of somebody else, never 403 or 409', async () => {
        const owner = await seedUser();
        const stranger = await seedUser();
        const { draft } = await seedPair(owner);

        const res = await readResponse(await ask(draft, ownerHeaders(stranger)));

        expect(res.status).toBe(404);
        expect(await requestRows(draft)).toEqual([]);
    });

    it('answers 400 for a malformed id, 400 for a short reason and 401 without a session', async () => {
        const owner = await seedUser();
        const { draft } = await seedPair(owner);

        expect((await ask('not-a-uuid', ownerHeaders(owner))).status).toBe(400);
        expect((await ask(draft, ownerHeaders(owner), 'corta')).status).toBe(400);
        expect(
            (
                await app.request(`/api/v1/protected/venues/${draft}/location-exception-request`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                    body: JSON.stringify({ reason: REASON })
                })
            ).status
        ).toBe(401);
    });

    it('allows only one pending request per listing', async () => {
        const owner = await seedUser();
        const { draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));

        const second = await readResponse(await ask(draft, ownerHeaders(owner)));

        expect(second.status).toBe(409);
        expect(second.body.error?.code).toBe('ALREADY_EXISTS');
        expect(await requestRows(draft)).toHaveLength(1);
    });

    it('refuses when no other published listing shares the address', async () => {
        const owner = await seedUser();
        const { published, draft } = await seedPair(owner);
        await getDb().execute(
            sql`UPDATE venues SET publication_status = 'DRAFT' WHERE id = ${published}::uuid`
        );

        const res = await readResponse(await ask(draft, ownerHeaders(owner)));

        expect(res.status).toBe(409);
        expect(await requestRows(draft)).toEqual([]);
    });

    it('refuses a listing with no comparable address', async () => {
        const owner = await seedUser();
        const { draft } = await seedPair(owner, null);

        expect((await ask(draft, ownerHeaders(owner))).status).toBe(409);
    });

    it('ignores the duplicate of ANOTHER owner', async () => {
        const owner = await seedUser();
        const other = await seedUser();
        const destinationId = await createVerticalDestination();
        const theirs = await createVerticalListing({
            vertical: VerticalEnum.VENUE,
            ownerId: other,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const mine = await createVerticalListing({
            vertical: VerticalEnum.VENUE,
            ownerId: owner,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        await getDb().execute(
            sql`UPDATE venues SET location_key = ${KEY} WHERE id IN (${theirs}::uuid, ${mine}::uuid)`
        );

        expect((await ask(mine, ownerHeaders(owner))).status).toBe(409);
    });
});

describe('admin queue, approve and reject', () => {
    it('lists the pending request with the colliding listing and the owner reason', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { published, draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));

        const res = await app.request(`${ADMIN_BASE}/location-exception-requests`, {
            headers: adminHeaders(admin)
        });
        const body = (await res.json()) as {
            data: {
                items: {
                    listing: { id: string };
                    collidingListings: { id: string }[];
                    reason: string;
                }[];
            };
        };

        expect(res.status).toBe(200);
        const row = body.data.items.find((item) => item.listing.id === draft);
        expect(row?.reason).toBe(REASON);
        expect(row?.collidingListings.map((c) => c.id)).toEqual([published]);
    });

    it('answers 403 to an admin without the permission and 401 without a session', async () => {
        const admin = await seedUser();

        const forbidden = await app.request(`${ADMIN_BASE}/location-exception-requests`, {
            headers: adminHeaders(admin, [])
        });
        const anonymous = await app.request(`${ADMIN_BASE}/location-exception-requests`, {
            headers: { 'user-agent': 'vitest' }
        });

        expect(forbidden.status).toBe(403);
        expect(anonymous.status).toBe(401);
    });

    it('approves: grants the exception bound to the key and records admin, reason and event', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));
        const [request] = await requestRows(draft);

        const res = await post(
            `${ADMIN_BASE}/location-exception-requests/${request?.id}/approve`,
            adminHeaders(admin),
            {}
        );

        expect(res.status).toBe(200);
        expect(await grantColumns(draft)).toEqual({ by: admin, key: KEY });
        expect(await requestRows(draft)).toMatchObject([
            { status: 'APPROVED', decisionReason: REASON, decidedBy: admin }
        ]);
        expect((await events(draft)).map((e) => e.action)).toEqual(['REQUESTED', 'APPROVED']);
        const view = await app.request(`/api/v1/protected/venues/${draft}`, {
            headers: ownerHeaders(owner)
        });
        const viewBody = (await view.json()) as {
            data: { locationException?: { hasException: boolean } };
        };
        expect(viewBody.data.locationException?.hasException).toBe(true);
    });

    it('approves with an edited reason', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));
        const [request] = await requestRows(draft);
        const edited = 'Confirmado por telefono con la duena del local';

        await post(
            `${ADMIN_BASE}/location-exception-requests/${request?.id}/approve`,
            adminHeaders(admin),
            { reason: edited }
        );

        expect(await requestRows(draft)).toMatchObject([{ decisionReason: edited }]);
        expect((await events(draft)).at(-1)).toMatchObject({ action: 'APPROVED', reason: edited });
    });

    it('rejects with a mandatory reason, leaves the listing alone and lets the owner ask again', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));
        const [request] = await requestRows(draft);
        const url = `${ADMIN_BASE}/location-exception-requests/${request?.id}/reject`;

        expect((await post(url, adminHeaders(admin), {})).status).toBe(400);
        const res = await post(url, adminHeaders(admin), {
            reason: 'Es el mismo local, sumale el rubro en la ficha existente'
        });

        expect(res.status).toBe(200);
        expect(await grantColumns(draft)).toEqual({ by: null, key: null });
        expect(await requestRows(draft)).toMatchObject([{ status: 'REJECTED', decidedBy: admin }]);
        expect((await events(draft)).map((e) => e.action)).toEqual(['REQUESTED', 'REJECTED']);
        expect((await ask(draft, ownerHeaders(owner))).status).toBe(201);
    });

    it('answers 409 when the request is already resolved and 404 when it does not exist', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));
        const [request] = await requestRows(draft);
        const url = `${ADMIN_BASE}/location-exception-requests/${request?.id}/approve`;
        await post(url, adminHeaders(admin), {});

        expect((await post(url, adminHeaders(admin), {})).status).toBe(409);
        expect(
            (
                await post(
                    `${ADMIN_BASE}/location-exception-requests/${randomUUID()}/approve`,
                    adminHeaders(admin),
                    {}
                )
            ).status
        ).toBe(404);
    });

    it('marks the request SUPERSEDED and answers 409 when the listing changed address', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));
        const [request] = await requestRows(draft);
        await getDb().execute(
            sql`UPDATE venues SET location_key = 'otra|9|dest' WHERE id = ${draft}::uuid`
        );

        const res = await post(
            `${ADMIN_BASE}/location-exception-requests/${request?.id}/approve`,
            adminHeaders(admin),
            {}
        );

        expect(res.status).toBe(409);
        expect(await requestRows(draft)).toMatchObject([{ status: 'SUPERSEDED' }]);
        expect(await grantColumns(draft)).toEqual({ by: null, key: null });
    });

    it('a direct grant resolves the pending request as approved', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));

        const res = await post(`${ADMIN_BASE}/${draft}/location-exception`, adminHeaders(admin), {
            reason: 'Concedida directamente por el equipo de soporte'
        });

        expect(res.status).toBe(201);
        expect(await requestRows(draft)).toMatchObject([{ status: 'APPROVED', decidedBy: admin }]);
        expect((await events(draft)).map((e) => e.action)).toEqual(['REQUESTED', 'APPROVED']);
    });

    it('a direct grant without a pending request records a GRANTED event', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);

        await post(`${ADMIN_BASE}/${draft}/location-exception`, adminHeaders(admin), {
            reason: 'Concedida directamente por el equipo de soporte'
        });

        expect(await events(draft)).toMatchObject([
            { action: 'GRANTED', actorId: admin, locationKey: KEY }
        ]);
    });
});

describe('DELETE /admin/venues/:id/location-exception (revoke)', () => {
    async function grantBoth(owner: string, admin: string) {
        const pair = await seedPair(owner);
        await post(`${ADMIN_BASE}/${pair.draft}/location-exception`, adminHeaders(admin), {
            reason: 'Patio gastronomico con dos fichas en la misma direccion'
        });
        await getDb().execute(
            sql`UPDATE venues SET publication_status = 'PUBLISHED' WHERE id = ${pair.draft}::uuid`
        );
        return pair;
    }

    const revoke = (id: string, headers: Record<string, string>, body?: unknown) =>
        app.request(`${ADMIN_BASE}/${id}/location-exception`, {
            method: 'DELETE',
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });

    it('refuses with 409 while two published listings of the owner would share the address', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { published, draft } = await grantBoth(owner, admin);

        const res = await readResponse(await revoke(draft, adminHeaders(admin)));

        expect(res.status).toBe(409);
        expect(res.body.error?.details).toMatchObject({ existingListingId: published });
        expect(await grantColumns(draft)).toEqual({ by: admin, key: KEY });
        expect((await events(draft)).map((e) => e.action)).toEqual(['GRANTED']);
    });

    it('revokes once the other listing is unpublished and keeps the record', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { published, draft } = await grantBoth(owner, admin);
        await getDb().execute(
            sql`UPDATE venues SET publication_status = 'DRAFT' WHERE id = ${published}::uuid`
        );

        const res = await revoke(draft, adminHeaders(admin), {
            reason: 'El local ya no comparte direccion con la otra ficha'
        });

        expect(res.status).toBe(200);
        expect(await grantColumns(draft)).toEqual({ by: null, key: null });
        expect(await events(draft)).toMatchObject([
            { action: 'GRANTED' },
            {
                action: 'REVOKED',
                actorId: admin,
                reason: 'El local ya no comparte direccion con la otra ficha',
                locationKey: KEY
            }
        ]);
    });

    it('revokes without a body and writes no event when there is nothing to revoke', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);

        const res = await revoke(draft, adminHeaders(admin));

        expect(res.status).toBe(200);
        expect(await events(draft)).toEqual([]);
    });

    it('answers 400 to a reason that is present but too short', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);

        expect((await revoke(draft, adminHeaders(admin), { reason: 'corta' })).status).toBe(400);
    });
});

describe('GET /admin/venues/:id/location-exception', () => {
    it('returns the state and the history newest first', async () => {
        const owner = await seedUser();
        const admin = await seedUser();
        const { draft } = await seedPair(owner);
        await ask(draft, ownerHeaders(owner));

        const res = await app.request(`${ADMIN_BASE}/${draft}/location-exception`, {
            headers: adminHeaders(admin)
        });
        const body = (await res.json()) as {
            data: { hasException: boolean; events: { action: string }[] };
        };

        expect(res.status).toBe(200);
        expect(body.data.hasException).toBe(false);
        expect(body.data.events.map((e) => e.action)).toEqual(['REQUESTED']);
    });
});
