/**
 * TEST:V7:3 (HOS-1484) — administrative action 5 cancels only a rejected
 * Partner application's wait, records the decision, and lets the owner submit
 * again while leaving the rejection itself unchanged.
 */
import { domainEventModel, getDb, partnerApplicationModel, sql } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { submitPartnerApplication } from '../../../src/services/partner-application/partner-application-submission.service';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import {
    createApplicationEmail,
    deleteApplications,
    insertRejected
} from './partner-application.helpers';

const app = initApp();
const REASON = '  Owner confirmed access to the mailbox  ';
const GRANTED_PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.PARTNER_RESOLVE_APPLICATION
];
const testEmails: string[] = [];
const applicationIds: string[] = [];
const adminIds: string[] = [];

async function admin(email?: string): Promise<string> {
    const created = await createOwner(email ? { email } : {});
    adminIds.push(created.id);
    return created.id;
}

function email(): string {
    const value = createApplicationEmail();
    testEmails.push(value);
    return value;
}

async function rejectedApplication(value: string): Promise<string> {
    const id = await insertRejected({ email: value, resolvedDaysAgo: 1 });
    applicationIds.push(id);
    return id;
}

async function pendingApplication(value: string): Promise<string> {
    const result = await getDb().execute(sql`
        INSERT INTO partner_application (email, status, deadlines_version)
        VALUES (${value}, 'PENDING', (SELECT max("version") FROM "vertical_deadline_version"))
        RETURNING id`);
    const id = String(result.rows[0]?.id);
    applicationIds.push(id);
    return id;
}

async function readApplication(id: string) {
    const result = await getDb().execute(sql`
        SELECT id, status, resolved_at, partner_id, wait_cancelled_at, wait_cancelled_by
        FROM partner_application WHERE id = ${id}::uuid`);
    return result.rows[0];
}

async function readEvents(id: string) {
    const result = await getDb().execute(sql`
        SELECT event_type, entity_type, actor_type, actor_id, reason, changes
        FROM domain_event WHERE entity_id = ${id}`);
    return result.rows;
}

async function cancel(input: {
    readonly applicationId: string;
    readonly adminId: string;
    readonly permissions?: readonly PermissionEnum[];
    readonly reason?: string;
}) {
    const response = await app.request(
        `/api/v1/admin/partner-applications/${input.applicationId}/cancel-wait`,
        {
            method: 'POST',
            headers: actorHeaders({
                id: input.adminId,
                role: RoleEnum.ADMIN,
                permissions: input.permissions ?? GRANTED_PERMISSIONS
            }),
            body: JSON.stringify({ reason: input.reason ?? REASON })
        }
    );
    return { status: response.status, body: await response.json() };
}

async function checkDatabasePreconditions(): Promise<void> {
    const trigger = await getDb().execute(sql`
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'partner_application_wait_active' AND NOT tgisinternal`);
    expect(
        trigger.rows,
        'Required partner_application_wait_active trigger is missing'
    ).toHaveLength(1);
    const deadline = await getDb().execute(sql`
        SELECT 1 FROM vertical_deadline_version WHERE "values" ? '9' LIMIT 1`);
    expect(
        deadline.rows,
        'Required PLAZO:9 value is missing from vertical_deadline_version'
    ).toHaveLength(1);
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    await checkDatabasePreconditions();
});
afterEach(async () => {
    const db = getDb();
    for (const id of applicationIds) {
        try {
            await db.execute(sql`DELETE FROM domain_event WHERE entity_id = ${id}`);
        } catch {
            // The append-only trigger intentionally keeps events for test-owned ids.
        }
    }
    for (const value of testEmails.splice(0)) await deleteApplications({ email: value });
    applicationIds.splice(0);
    for (const id of adminIds.splice(0)) {
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:V7:3 partner application rejection wait cancellation', () => {
    it('(a) keeps REJECTED intact, records one event, and lets PP1 create PENDING', async () => {
        const adminId = await admin();
        const value = email();
        const id = await rejectedApplication(value);
        const before = await readApplication(id);

        const response = await cancel({ applicationId: id, adminId });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: { cancelled: true },
            metadata: { requestId: expect.any(String), timestamp: expect.any(String) }
        });
        const after = await readApplication(id);
        expect(after).toMatchObject({
            id,
            status: 'REJECTED',
            resolved_at: before?.resolved_at,
            partner_id: null,
            wait_cancelled_by: adminId
        });
        expect(after?.wait_cancelled_at).not.toBeNull();
        const written = await readEvents(id);
        expect(written).toHaveLength(1);
        expect(written[0]).toEqual({
            event_type: 'partner_application.wait_cancelled',
            entity_type: 'partner_application',
            actor_type: 'admin',
            actor_id: adminId,
            reason: REASON.trim(),
            changes: [{ field: 'wait_cancelled_at' }, { field: 'wait_cancelled_by' }]
        });

        expect(await submitPartnerApplication({ email: value })).toEqual({ submitted: true });
        const rows = await getDb().execute(sql`
            SELECT status FROM partner_application WHERE lower(email) = lower(${value}) ORDER BY status`);
        expect(rows.rows).toEqual([{ status: 'PENDING' }, { status: 'REJECTED' }]);
    });

    it('(b) keeps PP1 blocked by an active rejection wait', async () => {
        const value = email();
        const id = await rejectedApplication(value);
        let thrown: unknown;
        try {
            await submitPartnerApplication({ email: value });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ServiceError);
        expect(thrown).toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: 'PARTNER_APPLICATION_UNAVAILABLE'
        });
        expect(await readApplication(id)).toMatchObject({
            status: 'REJECTED',
            wait_cancelled_at: null
        });
    });

    it('(c) rejects PARTNER_MANAGE alone before writing cancellation or an event', async () => {
        const adminId = await admin();
        const id = await rejectedApplication(email());
        const response = await cancel({
            applicationId: id,
            adminId,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_MANAGE]
        });
        expect(response.status).toBe(403);
        expect(await readApplication(id)).toMatchObject({
            wait_cancelled_at: null,
            wait_cancelled_by: null
        });
        expect(await readEvents(id)).toEqual([]);
    });

    it('(d) refuses a PENDING application with WAIT_NOT_ACTIVE and no event', async () => {
        const adminId = await admin();
        const id = await pendingApplication(email());
        const response = await cancel({ applicationId: id, adminId });
        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            error: { reason: 'PARTNER_APPLICATION_WAIT_NOT_ACTIVE' }
        });
        expect(await readEvents(id)).toEqual([]);
    });

    it('(e) refuses an already cancelled rejection and keeps exactly one event', async () => {
        const adminId = await admin();
        const id = await rejectedApplication(email());
        expect((await cancel({ applicationId: id, adminId })).status).toBe(200);
        const repeated = await cancel({ applicationId: id, adminId });
        expect(repeated.status).toBe(409);
        expect(repeated.body).toMatchObject({
            error: { reason: 'PARTNER_APPLICATION_WAIT_NOT_ACTIVE' }
        });
        expect(await readEvents(id)).toHaveLength(1);
    });

    it('(f) answers 404 for a missing application', async () => {
        const response = await cancel({
            applicationId: crypto.randomUUID(),
            adminId: await admin()
        });
        expect(response.status).toBe(404);
    });

    it('(g) answers 400 for a whitespace-only reason', async () => {
        const response = await cancel({
            applicationId: crypto.randomUUID(),
            adminId: await admin(),
            reason: '   '
        });
        expect(response.status).toBe(400);
    });

    it("(h) refuses an admin whose mailbox is the application's mailbox", async () => {
        const value = email();
        const adminId = await admin(value.toUpperCase());
        const id = await rejectedApplication(value);
        const response = await cancel({ applicationId: id, adminId });
        expect(response.status).toBe(403);
        expect(await readEvents(id)).toEqual([]);
    });

    it('(i) serializes concurrent cancellation attempts and records one event', async () => {
        const adminId = await admin();
        const id = await rejectedApplication(email());
        const originalCancelWait = partnerApplicationModel.cancelWait.bind(partnerApplicationModel);
        let writers = 0;
        let releaseWriters: (() => void) | undefined;
        const writerGate = new Promise<void>((resolve) => {
            releaseWriters = resolve;
        });
        const fallback = setTimeout(() => releaseWriters?.(), 1000);
        const cancelWaitSpy = vi
            .spyOn(partnerApplicationModel, 'cancelWait')
            .mockImplementation(async (args) => {
                writers += 1;
                if (writers === 2) releaseWriters?.();
                await writerGate;
                await originalCancelWait(args);
            });

        try {
            const responses = await Promise.all([
                cancel({ applicationId: id, adminId }),
                cancel({ applicationId: id, adminId })
            ]);
            expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
            expect(await readApplication(id)).toMatchObject({
                status: 'REJECTED',
                wait_cancelled_by: adminId
            });
            expect(await readEvents(id)).toHaveLength(1);
        } finally {
            clearTimeout(fallback);
            cancelWaitSpy.mockRestore();
        }
    });

    it('(j) rolls back the cancellation when inserting its event fails', async () => {
        const adminId = await admin();
        const id = await rejectedApplication(email());
        const before = await readApplication(id);
        const eventInsertSpy = vi
            .spyOn(domainEventModel, 'insert')
            .mockRejectedValue(new Error('Simulated event insert failure'));

        try {
            const response = await cancel({ applicationId: id, adminId });
            expect(response.status).toBe(500);
            expect(await readApplication(id)).toMatchObject({
                status: 'REJECTED',
                resolved_at: before?.resolved_at,
                partner_id: null,
                wait_cancelled_at: null,
                wait_cancelled_by: null
            });
            expect(await readEvents(id)).toEqual([]);
        } finally {
            eventInsertSpy.mockRestore();
        }
    });
});
