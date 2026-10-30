/**
 * TEST:V8a:15 (HOS-1494, AC:V8a:13) — administrative actions 23 (purge a
 * listing at its owner's request) and 24 (close an account at its owner's
 * request) are support acts: each one asks for its OWN permission, a reason, and
 * is never run by an account on itself. An owner who is also staff gets «sin
 * permiso» (403, step 3) from their own staff account, and another account with
 * the permission does it. Every refusal leaves the listing and the account as
 * they were. Against a real PostgreSQL, with the `canCharge` simulator of the
 * billing-verticals contract.
 *
 * The system actor (which never reaches a route with headers) is covered by the
 * unit tests of both services.
 */
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AccountClosureService } from '../../../src/services/account-closure/account-closure.service';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    ensurePublicationCatalog,
    readResponse
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
const REASON = 'El dueño pidió la baja por correo';
const createdUsers: string[] = [];
const createdListings: string[] = [];

async function user(): Promise<string> {
    const { id } = await createOwner();
    createdUsers.push(id);
    return id;
}

async function draftListing(ownerId: string): Promise<string> {
    const id = await createListing({
        ownerId,
        destinationId: await createVerticalDestination(),
        status: PublicationStatusEnum.DRAFT,
        complete: false
    });
    createdListings.push(id);
    return id;
}

function headers(id: string, permissions: readonly PermissionEnum[]) {
    return actorHeaders({
        id,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions]
    });
}

/** Action 23 on one accommodation listing. */
async function purge(input: {
    readonly listingId: string;
    readonly adminId: string;
    readonly permissions: readonly PermissionEnum[];
    readonly body?: Record<string, unknown>;
}) {
    return readResponse(
        await app.request(`/api/v1/admin/accommodations/${input.listingId}/purge`, {
            method: 'POST',
            headers: headers(input.adminId, input.permissions),
            body: JSON.stringify(input.body ?? { reason: REASON })
        })
    );
}

/** Action 24 on one account (the GET preview or the POST closure). */
async function close(input: {
    readonly method: 'GET' | 'POST';
    readonly userId: string;
    readonly adminId: string;
    readonly permissions: readonly PermissionEnum[];
    readonly body?: Record<string, unknown>;
}) {
    return readResponse(
        await app.request(`/api/v1/admin/users/${input.userId}/close-on-request`, {
            method: input.method,
            headers: headers(input.adminId, input.permissions),
            ...(input.method === 'POST'
                ? { body: JSON.stringify(input.body ?? { reason: REASON }) }
                : {})
        })
    );
}

/** The listing and the account as a refusal must leave them. */
async function footprint(input: { readonly userId: string; readonly listingId?: string }) {
    const db = getDb();
    const account = await db.execute(
        sql`SELECT email, display_name, slug, deleted_at FROM users WHERE id = ${input.userId}::uuid`
    );
    const events = await db.execute(
        sql`SELECT id FROM domain_event WHERE entity_id IN (${input.userId}, ${input.listingId ?? input.userId})`
    );
    const listing = input.listingId
        ? await db.execute(
              sql`SELECT publication_status, deleted_at FROM accommodations WHERE id = ${input.listingId}::uuid`
          )
        : undefined;
    return { account: account.rows, events: events.rows.length, listing: listing?.rows };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    await ensurePublicationCatalog(VerticalEnum.ACCOMMODATION);
});
beforeEach(() => {
    simulator.current = new BillingForVerticalsSimulator();
});
afterEach(async () => {
    const db = getDb();
    for (const id of createdListings.splice(0)) {
        await db.execute(sql`DELETE FROM accommodations WHERE id = ${id}::uuid`);
    }
    for (const id of createdUsers.splice(0)) {
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:V8a:15 actions 23 and 24 are support acts, each with its own permission and never on oneself', () => {
    it('23 on the staff account own listing answers «sin permiso» and changes nothing', async () => {
        // Arrange: the owner of the listing is also staff, with the permission of action 23
        const staff = await user();
        const listingId = await draftListing(staff);
        const before = await footprint({ userId: staff, listingId });

        // Act
        const response = await purge({
            listingId,
            adminId: staff,
            permissions: [PermissionEnum.LISTING_PURGE_ON_REQUEST]
        });

        // Assert
        expect(response.status).toBe(403);
        expect(await footprint({ userId: staff, listingId })).toEqual(before);
    });

    it('23 without its own permission (foreign edit + delete-any + hard-delete) answers 403', async () => {
        const owner = await user();
        const admin = await user();
        const listingId = await draftListing(owner);
        const before = await footprint({ userId: owner, listingId });

        const response = await purge({
            listingId,
            adminId: admin,
            permissions: [
                PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                PermissionEnum.ACCOMMODATION_DELETE_ANY,
                PermissionEnum.ACCOMMODATION_HARD_DELETE
            ]
        });

        expect(response.status).toBe(403);
        expect(await footprint({ userId: owner, listingId })).toEqual(before);
    });

    it('24 on the staff account itself answers «sin permiso» on the POST and the GET', async () => {
        // Arrange: the staff account holds the permission of action 24
        const staff = await user();
        const permissions = [PermissionEnum.USER_CLOSE_ON_REQUEST];
        const before = await footprint({ userId: staff });

        // Act
        const closing = await close({ method: 'POST', userId: staff, adminId: staff, permissions });
        const preview = await close({ method: 'GET', userId: staff, adminId: staff, permissions });

        // Assert
        expect(closing.status).toBe(403);
        expect(preview.status).toBe(403);
        expect(await footprint({ userId: staff })).toEqual(before);
    });

    it('24 without its own permission (user delete + hard delete + action 23) answers 403', async () => {
        const owner = await user();
        const admin = await user();
        const permissions = [
            PermissionEnum.USER_DELETE,
            PermissionEnum.USER_HARD_DELETE,
            PermissionEnum.LISTING_PURGE_ON_REQUEST
        ];
        const before = await footprint({ userId: owner });

        const closing = await close({ method: 'POST', userId: owner, adminId: admin, permissions });
        const preview = await close({ method: 'GET', userId: owner, adminId: admin, permissions });

        expect(closing.status).toBe(403);
        expect(preview.status).toBe(403);
        expect(await footprint({ userId: owner })).toEqual(before);
    });

    it('24 without its own permission is refused by the service itself, whatever gate a route puts first', async () => {
        // Arrange: defense in depth (H12): a route guarded by another permission never opens action 24
        const owner = await user();
        const admin = await user();
        const actor = {
            id: admin,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.USER_DELETE,
                PermissionEnum.USER_HARD_DELETE,
                PermissionEnum.LISTING_PURGE_ON_REQUEST
            ]
        } as unknown as Actor;
        const before = await footprint({ userId: owner });

        // Act
        const closing = new AccountClosureService().closeOnRequest({
            actor,
            userId: owner,
            reason: REASON
        });

        // Assert
        await expect(closing).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(await footprint({ userId: owner })).toEqual(before);
    });

    it('24 with its own permission on another account with nothing left passes (the gate lets the right one in)', async () => {
        const owner = await user();
        const admin = await user();

        const response = await close({
            method: 'POST',
            userId: owner,
            adminId: admin,
            permissions: [PermissionEnum.USER_CLOSE_ON_REQUEST]
        });

        expect(response.status).toBe(200);
        expect((await footprint({ userId: owner })).account[0]?.deleted_at).not.toBeNull();
    });

    it('23 and 24 without a reason answer 400 even for an actor holding their permission', async () => {
        // Arrange
        const owner = await user();
        const admin = await user();
        const listingId = await draftListing(owner);
        const before = await footprint({ userId: owner, listingId });

        // Act
        const purgeResponse = await purge({
            listingId,
            adminId: admin,
            permissions: [PermissionEnum.LISTING_PURGE_ON_REQUEST],
            body: {}
        });
        const closeResponse = await close({
            method: 'POST',
            userId: owner,
            adminId: admin,
            permissions: [PermissionEnum.USER_CLOSE_ON_REQUEST],
            body: { reason: '   ' }
        });

        // Assert
        expect(purgeResponse.status).toBe(400);
        expect(closeResponse.status).toBe(400);
        expect(await footprint({ userId: owner, listingId })).toEqual(before);
    });
});
