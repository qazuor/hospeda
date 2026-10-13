/**
 * TEST:V8a:14 (HOS-1494, AC:V8a:12) — administrative action 24 over a partner
 * application made WITHOUT an account, through its route, against a real
 * PostgreSQL: the confirmation read says which application's mailbox is
 * replaced; the replacement writes the pseudonym and an audit event whose
 * subject is the application; the account preconditions are never evaluated
 * (the `canCharge` simulator receives no call); and a mailbox that belongs to a
 * live account, the actor's own mailbox, a missing reason, an application
 * already replaced and an actor without its own permission are refused without
 * writing anything.
 */
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';

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
const REASON = 'Ana pidió por correo que borremos su correo de la postulación';
const OWN_PERMISSIONS = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.USER_CLOSE_ON_REQUEST];
const createdUsers: string[] = [];
const createdApplications: string[] = [];

async function admin(email?: string): Promise<string> {
    const { id } = await createOwner(email ? { email } : {});
    createdUsers.push(id);
    return id;
}

async function application(email: string): Promise<string> {
    const result = await getDb().execute(
        sql`INSERT INTO partner_application (email, status) VALUES (${email}, 'PENDING') RETURNING id`
    );
    const id = String(result.rows[0]?.id);
    createdApplications.push(id);
    return id;
}

async function readApplication(id: string) {
    const result = await getDb().execute(
        sql`SELECT email, status, resolved_at, partner_id FROM partner_application WHERE id = ${id}::uuid`
    );
    return result.rows[0];
}

async function events(applicationId: string) {
    const result = await getDb().execute(sql`
        SELECT event_type, entity_type, actor_type, actor_id, reason, changes
        FROM domain_event WHERE entity_id = ${applicationId}`);
    return result.rows;
}

async function call(input: {
    readonly method: 'GET' | 'POST';
    readonly applicationId: string;
    readonly adminId: string;
    readonly permissions?: readonly PermissionEnum[];
    readonly body?: Record<string, unknown>;
}) {
    const response = await app.request(
        `/api/v1/admin/partner-applications/${input.applicationId}/replace-email`,
        {
            method: input.method,
            headers: actorHeaders({
                id: input.adminId,
                role: RoleEnum.ADMIN,
                permissions: input.permissions ?? OWN_PERMISSIONS
            }),
            ...(input.method === 'POST'
                ? { body: JSON.stringify(input.body ?? { reason: REASON }) }
                : {})
        }
    );
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
    for (const id of createdApplications.splice(0)) {
        await db.execute(sql`DELETE FROM partner_application WHERE id = ${id}::uuid`);
    }
    for (const id of createdUsers.splice(0)) {
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:V8a:14 action 24 on an application made without an account', () => {
    it('says whose application it is, replaces its mailbox with a record, and never asks puedeCobrarle', async () => {
        // Arrange
        const adminId = await admin();
        const email = `ana-${crypto.randomUUID()}@example.test`;
        const applicationId = await application(email);
        const before = await readApplication(applicationId);

        // Act
        const preview = await call({ method: 'GET', applicationId, adminId });
        const response = await call({ method: 'POST', applicationId, adminId });

        // Assert
        expect(preview.status).toBe(200);
        expect(preview.body.data).toMatchObject({ applicationId, email, status: 'PENDING' });
        expect(Number.isNaN(Date.parse(String(preview.body.data?.createdAt)))).toBe(false);
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ replaced: true });
        expect(await readApplication(applicationId)).toEqual({
            ...before,
            email: `deleted-application-${applicationId}@pseudonym.invalid`
        });
        const written = await events(applicationId);
        expect(written).toHaveLength(1);
        expect(written[0]).toMatchObject({
            event_type: 'partner_application.email_replaced',
            entity_type: 'partner_application',
            actor_type: 'admin',
            actor_id: adminId,
            reason: REASON,
            changes: [{ field: 'email' }]
        });
        expect(JSON.stringify(written)).not.toContain(email);
        expect(simulator.current?.calls.filter((c) => c.operation === 'canCharge')).toEqual([]);
    });

    it('refuses with 409 APPLICATION_HAS_ACCOUNT when a live account carries the mailbox in another case', async () => {
        // Arrange
        const adminId = await admin();
        const accountEmail = `juan-${crypto.randomUUID()}@example.test`;
        await admin(accountEmail);
        const applicationId = await application(accountEmail.toUpperCase());
        const before = await readApplication(applicationId);

        // Act
        const response = await call({ method: 'POST', applicationId, adminId });

        // Assert
        expect(response.status).toBe(409);
        expect(response.body.error?.code).toBe('ALREADY_EXISTS');
        expect(response.body.error?.reason).toBe('APPLICATION_HAS_ACCOUNT');
        expect(await readApplication(applicationId)).toEqual(before);
        expect(await events(applicationId)).toEqual([]);
    });

    it('refuses a missing or blank reason with 400 and writes nothing', async () => {
        const adminId = await admin();
        const applicationId = await application(`ana-${crypto.randomUUID()}@example.test`);
        const before = await readApplication(applicationId);

        const missing = await call({ method: 'POST', applicationId, adminId, body: {} });
        const blank = await call({ method: 'POST', applicationId, adminId, body: { reason: ' ' } });

        expect(missing.status).toBe(400);
        expect(blank.status).toBe(400);
        expect(await readApplication(applicationId)).toEqual(before);
        expect(await events(applicationId)).toEqual([]);
    });

    it('answers 404 for an application already replaced, and for a missing one', async () => {
        const adminId = await admin();
        const applicationId = await application(`ana-${crypto.randomUUID()}@example.test`);
        expect((await call({ method: 'POST', applicationId, adminId })).status).toBe(200);

        const again = await call({ method: 'POST', applicationId, adminId });
        const preview = await call({ method: 'GET', applicationId, adminId });
        const missing = await call({
            method: 'POST',
            applicationId: crypto.randomUUID(),
            adminId
        });

        expect(again.status).toBe(404);
        expect(again.body.error?.code).toBe('NOT_FOUND');
        expect(preview.status).toBe(404);
        expect(missing.status).toBe(404);
        expect(await events(applicationId)).toHaveLength(1);
    });

    it('answers 403 to the admin whose own mailbox is the application one, and writes nothing', async () => {
        // Arrange
        const email = `soporte-${crypto.randomUUID()}@example.test`;
        const adminId = await admin(email);
        const applicationId = await application(email.toUpperCase());
        const before = await readApplication(applicationId);

        // Act
        const response = await call({ method: 'POST', applicationId, adminId });
        const preview = await call({ method: 'GET', applicationId, adminId });

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(preview.status).toBe(403);
        expect(await readApplication(applicationId)).toEqual(before);
        expect(await events(applicationId)).toEqual([]);
    });

    it('answers 403 to an admin with USER_DELETE + USER_HARD_DELETE but without its own permission', async () => {
        const adminId = await admin();
        const applicationId = await application(`ana-${crypto.randomUUID()}@example.test`);
        const before = await readApplication(applicationId);
        const permissions = [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.USER_DELETE,
            PermissionEnum.USER_HARD_DELETE
        ];

        const response = await call({ method: 'POST', applicationId, adminId, permissions });
        const preview = await call({ method: 'GET', applicationId, adminId, permissions });

        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(preview.status).toBe(403);
        expect(await readApplication(applicationId)).toEqual(before);
        expect(await events(applicationId)).toEqual([]);
    });
});
