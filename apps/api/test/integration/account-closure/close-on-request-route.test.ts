/**
 * TEST:V8a:12 (HOS-1494, AC:V8a:10) — administrative action 24 through its
 * route, against a real PostgreSQL and the `canCharge` SIMULATOR of the
 * billing-verticals contract (H7): while `puedeCobrarle` answers yes, a listing
 * stays outside `PURGED` or a partner presence holds content, the closure is
 * refused with 409 and writes NOTHING (the user row, its credentials and the
 * audit log are untouched); once nothing blocks, it passes.
 */
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination
} from '../listing-publication/publication-routes.helpers';

const simulator = vi.hoisted(() => ({
    current: undefined as
        | import('@repo/billing-verticals-contract/testing').BillingForVerticalsSimulator
        | undefined
}));
vi.mock('../../../src/utils/listing-access/ports', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/listing-access/ports')>();
    return {
        ...actual,
        getListingAccessPorts: () => {
            const ports = actual.getListingAccessPorts();
            return {
                ...ports,
                billing: {
                    ...ports.billing,
                    canCharge: (args: { readonly userId: string }) => {
                        if (!simulator.current) throw new Error('no simulator');
                        return simulator.current.canCharge(args);
                    }
                }
            };
        }
    };
});

const app = initApp();
const REASON = 'Juan pidió por correo que demos de baja su cuenta';
const createdUsers: string[] = [];
const createdListings: string[] = [];
const createdPartners: string[] = [];

function path(userId: string): string {
    return `/api/v1/admin/users/${userId}/close-on-request`;
}

function supportHeaders(id: string, permissions?: readonly PermissionEnum[]) {
    return actorHeaders({
        id,
        role: RoleEnum.ADMIN,
        permissions: permissions ?? [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.USER_CLOSE_ON_REQUEST
        ]
    });
}

async function account(): Promise<string> {
    const { id } = await createOwner();
    createdUsers.push(id);
    await getDb().execute(sql`INSERT INTO account (id, account_id, provider_id, user_id, password)
        VALUES (${crypto.randomUUID()}, ${id}, 'credential', ${id}, 'hash')`);
    return id;
}

async function listing(ownerId: string, status: PublicationStatusEnum): Promise<string> {
    const id = await createListing({
        ownerId,
        destinationId: await createVerticalDestination(),
        status: PublicationStatusEnum.DRAFT,
        complete: false
    });
    createdListings.push(id);
    await getDb().execute(
        sql`UPDATE accommodations SET publication_status = ${status} WHERE id = ${id}::uuid`
    );
    return id;
}

async function partner(ownerUserId: string, logoUrl: string | null): Promise<void> {
    const result = await getDb().execute(sql`
        INSERT INTO partners (slug, name, type, owner_user_id, logo_url)
        VALUES (${`v8a3-${crypto.randomUUID()}`}, 'V8a.3 partner', 'business', ${ownerUserId}, ${logoUrl})
        RETURNING id`);
    createdPartners.push(String(result.rows[0]?.id));
}

/** Everything a refused closure must leave untouched. */
async function footprint(userId: string) {
    const user = await getDb().execute(sql`SELECT * FROM users WHERE id = ${userId}::uuid`);
    const accounts = await getDb().execute(
        sql`SELECT id FROM account WHERE user_id = ${userId}::uuid`
    );
    const events = await getDb().execute(
        sql`SELECT id FROM domain_event WHERE entity_id = ${userId}`
    );
    return { user: user.rows, accounts: accounts.rows.length, events: events.rows.length };
}

/** The permissions `role_permission` grants a role, as the actor middleware resolves them. */
async function rolePermissions(role: RoleEnum): Promise<PermissionEnum[]> {
    const rows = await getDb().execute(
        sql`SELECT permission::text AS permission FROM role_permission WHERE role = ${role}`
    );
    return rows.rows.map((row) => String(row.permission) as PermissionEnum);
}

async function holdRole(userId: string, role: RoleEnum): Promise<void> {
    await getDb().execute(
        sql`INSERT INTO user_role (user_id, role) VALUES (${userId}::uuid, ${role})`
    );
}

async function call(input: {
    readonly method: 'GET' | 'POST';
    readonly userId: string;
    readonly adminId: string;
    readonly permissions?: readonly PermissionEnum[];
}) {
    const response = await app.request(path(input.userId), {
        method: input.method,
        headers: supportHeaders(input.adminId, input.permissions),
        ...(input.method === 'POST' ? { body: JSON.stringify({ reason: REASON }) } : {})
    });
    const body = (await response.json()) as {
        readonly data?: Record<string, unknown>;
        readonly error?: { readonly code?: string; readonly reason?: string };
    };
    return { status: response.status, body };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
beforeEach(() => {
    simulator.current = new BillingForVerticalsSimulator();
});
afterEach(async () => {
    const db = getDb();
    for (const id of createdListings.splice(0)) {
        await db.execute(sql`DELETE FROM accommodations WHERE id = ${id}::uuid`);
    }
    for (const id of createdPartners.splice(0)) {
        await db.execute(sql`DELETE FROM partners WHERE id = ${id}::uuid`);
    }
    for (const id of createdUsers.splice(0)) {
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_permission WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:V8a:12 action 24 is refused while something can still charge, a listing or a presence remains', () => {
    it.each([
        'a live subscription',
        'a CANCEL_SCHEDULED whose cancellation no re-read confirmed',
        'a terminal one cancelled by the provider within PLAZO:16',
        'an open CANCELACIÓN_SIN_CONFIRMAR mark'
    ])('refuses with 409 ACCOUNT_CAN_STILL_BE_CHARGED for %s and writes nothing', async () => {
        // Arrange
        const juan = await account();
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        simulator.current?.setCanCharge({ userId: juan, response: { canCharge: true } });
        const before = await footprint(juan);

        // Act
        const preview = await call({ method: 'GET', userId: juan, adminId });
        const response = await call({ method: 'POST', userId: juan, adminId });

        // Assert
        expect(preview.status).toBe(200);
        expect(preview.body.data).toMatchObject({
            userId: juan,
            canCharge: true,
            listingsNotPurged: 0,
            partnerPresenceWithContent: false,
            ready: false
        });
        expect(response.status).toBe(409);
        expect(response.body.error?.code).toBe('ALREADY_EXISTS');
        expect(response.body.error?.reason).toBe('ACCOUNT_CAN_STILL_BE_CHARGED');
        expect(await footprint(juan)).toEqual(before);
        expect(before.accounts).toBe(1);
        expect(before.events).toBe(0);
    });

    it('refuses with 409 ACCOUNT_HAS_LISTINGS while a DRAFT listing remains', async () => {
        const juan = await account();
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        await listing(juan, PublicationStatusEnum.DRAFT);
        const before = await footprint(juan);

        const preview = await call({ method: 'GET', userId: juan, adminId });
        const response = await call({ method: 'POST', userId: juan, adminId });

        expect(preview.body.data).toMatchObject({
            canCharge: false,
            listingsNotPurged: 1,
            partnerPresenceWithContent: false,
            ready: false
        });
        expect(response.status).toBe(409);
        expect(response.body.error?.reason).toBe('ACCOUNT_HAS_LISTINGS');
        expect(await footprint(juan)).toEqual(before);
    });

    it('refuses with 409 ACCOUNT_HAS_PARTNER_PRESENCE while the presence has a logo', async () => {
        const juan = await account();
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        await partner(juan, 'https://example.test/logo.png');
        const before = await footprint(juan);

        const response = await call({ method: 'POST', userId: juan, adminId });

        expect(response.status).toBe(409);
        expect(response.body.error?.reason).toBe('ACCOUNT_HAS_PARTNER_PRESENCE');
        expect(await footprint(juan)).toEqual(before);
    });

    it('passes with the CANCEL_SCHEDULED confirmed, a PURGED listing and an empty presence', async () => {
        // Arrange
        const juan = await account();
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        simulator.current?.setCanCharge({ userId: juan, response: { canCharge: false } });
        await listing(juan, PublicationStatusEnum.PURGED);
        await partner(juan, null);

        // Act
        const preview = await call({ method: 'GET', userId: juan, adminId });
        const response = await call({ method: 'POST', userId: juan, adminId });

        // Assert
        expect(preview.body.data).toMatchObject({
            canCharge: false,
            listingsNotPurged: 0,
            partnerPresenceWithContent: false,
            ready: true
        });
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ closed: true });
        const after = await footprint(juan);
        expect(after.accounts).toBe(0);
        expect(after.events).toBe(1);
        expect(
            simulator.current?.calls.filter((entry) => entry.operation === 'canCharge')
        ).toHaveLength(2);
    });

    it('answers 404 for a missing account and for one already closed, 403 for a system account', async () => {
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        const missing = await call({ method: 'POST', userId: crypto.randomUUID(), adminId });
        expect(missing.status).toBe(404);

        const juan = await account();
        expect((await call({ method: 'POST', userId: juan, adminId })).status).toBe(200);
        const again = await call({ method: 'POST', userId: juan, adminId });
        expect(again.status).toBe(404);
        expect((await call({ method: 'GET', userId: juan, adminId })).status).toBe(404);

        const system = await account();
        await getDb().execute(
            sql`UPDATE users SET is_system_account = true WHERE id = ${system}::uuid`
        );
        const before = await footprint(system);
        const refused = await call({ method: 'POST', userId: system, adminId });
        expect(refused.status).toBe(403);
        expect(refused.body.error?.code).toBe('FORBIDDEN');
        expect((await call({ method: 'GET', userId: system, adminId })).status).toBe(403);
        expect(await footprint(system)).toEqual(before);
    });

    it.each([
        [
            'without its own permission (USER_DELETE + USER_HARD_DELETE)',
            [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.USER_DELETE,
                PermissionEnum.USER_HARD_DELETE
            ]
        ],
        [
            'with the permission of action 23 only',
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_PURGE_ON_REQUEST]
        ]
    ] as const)('answers 403 %s and writes nothing', async (_label, permissions) => {
        const juan = await account();
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        const before = await footprint(juan);

        const response = await call({ method: 'POST', userId: juan, adminId, permissions });

        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(await footprint(juan)).toEqual(before);
    });

    it('answers 403 when support targets its own account (actor = subject)', async () => {
        const adminId = await account();
        const before = await footprint(adminId);

        const response = await call({ method: 'POST', userId: adminId, adminId });

        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(await footprint(adminId)).toEqual(before);
    });

    it('answers 403 SUBJECT_OUTRANKS_ACTOR when an ADMIN targets a SUPER_ADMIN, and writes nothing', async () => {
        // Arrange: support holds every `role_permission` row of SUPER_ADMIN, plus action 24.
        // The role rows alone would let it through; the SUPER_ADMIN hat grants EVERY
        // permission (the actor middleware's resolver), so the subject still outranks it.
        const supportPermissions = [
            ...new Set([
                ...(await rolePermissions(RoleEnum.SUPER_ADMIN)),
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.USER_CLOSE_ON_REQUEST
            ])
        ];
        expect(supportPermissions.length).toBeLessThan(Object.values(PermissionEnum).length);
        const superAdmin = await account();
        await holdRole(superAdmin, RoleEnum.SUPER_ADMIN);
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        const before = await footprint(superAdmin);

        // Act
        const response = await call({
            method: 'POST',
            userId: superAdmin,
            adminId,
            permissions: supportPermissions
        });
        const preview = await call({
            method: 'GET',
            userId: superAdmin,
            adminId,
            permissions: supportPermissions
        });

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(response.body.error?.reason).toBe('SUBJECT_OUTRANKS_ACTOR');
        expect(preview.status).toBe(403);
        expect(await footprint(superAdmin)).toEqual(before);
    });

    it('answers 403 SUBJECT_OUTRANKS_ACTOR for a per-user grant the actor lacks', async () => {
        const subject = await account();
        await getDb().execute(sql`INSERT INTO user_permission (user_id, permission, effect)
            VALUES (${subject}::uuid, ${PermissionEnum.USER_UPDATE_ROLES}, 'grant')`);
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        const before = await footprint(subject);

        const response = await call({ method: 'POST', userId: subject, adminId });

        expect(response.status).toBe(403);
        expect(response.body.error?.reason).toBe('SUBJECT_OUTRANKS_ACTOR');
        expect(await footprint(subject)).toEqual(before);
    });

    it('lets an ADMIN close a peer ADMIN and a SUPER_ADMIN close an ADMIN', async () => {
        // Arrange: the actor holds everything the ADMIN role grants, plus action 24
        const adminPermissions = [
            ...new Set([
                ...(await rolePermissions(RoleEnum.ADMIN)),
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.USER_CLOSE_ON_REQUEST
            ])
        ];
        const peer = await account();
        await holdRole(peer, RoleEnum.ADMIN);
        const other = await account();
        await holdRole(other, RoleEnum.ADMIN);
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);

        // Act
        const byPeer = await call({
            method: 'POST',
            userId: peer,
            adminId,
            permissions: adminPermissions
        });
        const bySuper = await call({
            method: 'POST',
            userId: other,
            adminId,
            permissions: Object.values(PermissionEnum)
        });

        // Assert
        expect(byPeer.status).toBe(200);
        expect(bySuper.status).toBe(200);
    });
});
