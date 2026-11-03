/** TEST:V7:5 (without communication) — PP3 rejects and records its active wait. */
import { getDb, sql } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { submitPartnerApplication } from '../../../src/services/partner-application/partner-application-submission.service';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import {
    createApplicationEmail,
    deleteApplications,
    deletePartners,
    insertPending
} from './partner-application.helpers';

const app = initApp();
const REASON = '  Not approved for this test  ';
const PERMISSIONS = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_RESOLVE_APPLICATION];
const emails: string[] = [];
const applicationIds: string[] = [];
const partnerIds: string[] = [];
const userIds: string[] = [];
const deadlineVersions: number[] = [];
let deadlineBaseline: number | undefined;

function email(): string {
    const value = createApplicationEmail();
    emails.push(value);
    return value;
}

async function admin(value?: string): Promise<string> {
    const owner = await createOwner(value ? { email: value } : {});
    userIds.push(owner.id);
    return owner.id;
}

async function pending(value: string): Promise<string> {
    const id = await insertPending({ email: value, deadlinesVersion: null });
    applicationIds.push(id);
    return id;
}

async function request(input: {
    readonly action: 'approve' | 'reject';
    readonly id: string;
    readonly actorId: string;
    readonly body: Record<string, unknown>;
    readonly permissions?: readonly PermissionEnum[];
}) {
    const response = await app.request(
        `/api/v1/admin/partner-applications/${input.id}/${input.action}`,
        {
            method: 'POST',
            headers: actorHeaders({
                id: input.actorId,
                role: RoleEnum.ADMIN,
                permissions: input.permissions ?? PERMISSIONS
            }),
            body: JSON.stringify(input.body)
        }
    );
    return { status: response.status, body: await response.json() };
}

async function application(id: string) {
    const result = await getDb().execute(sql`
        SELECT id, status, resolved_at, partner_id, deadlines_version, wait_cancelled_at
        FROM partner_application WHERE id = ${id}::uuid`);
    return result.rows[0];
}

async function events(id: string) {
    const result = await getDb().execute(sql`
        SELECT event_type, entity_type, actor_type, actor_id, reason, changes
        FROM domain_event WHERE entity_id = ${id}`);
    return result.rows;
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
    expect(deadline.rows, 'Required PLAZO:9 value is missing').toHaveLength(1);
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    await checkDatabasePreconditions();
});
afterEach(async () => {
    for (const value of emails.splice(0)) await deleteApplications({ email: value });
    await deletePartners({ ids: partnerIds.splice(0) });
    const versionsToDelete = deadlineVersions.splice(0);
    if (versionsToDelete.length > 0) {
        await getDb().transaction(async (tx) => {
            await tx.execute(
                sql`ALTER TABLE vertical_deadline_version DISABLE TRIGGER vertical_deadline_version_immutable`
            );
            for (const version of versionsToDelete) {
                await tx.execute(
                    sql`DELETE FROM vertical_deadline_version WHERE "version" = ${version}`
                );
            }
            await tx.execute(
                sql`ALTER TABLE vertical_deadline_version ENABLE TRIGGER vertical_deadline_version_immutable`
            );
        });
    }
    if (deadlineBaseline !== undefined) {
        const current = await getDb().execute(sql`
            SELECT max("version") AS version FROM vertical_deadline_version`);
        expect(current.rows[0]?.version).toBe(deadlineBaseline);
        deadlineBaseline = undefined;
    }
    for (const id of userIds.splice(0)) {
        const db = getDb();
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
    applicationIds.splice(0);
});
afterAll(async () => testDb.teardown());

describe('TEST:V7:5 PP3 rejection', () => {
    it('(a) rejects, saves the current deadline version, and records one event', async () => {
        const initial = await getDb().execute(sql`
            SELECT max("version") AS version FROM vertical_deadline_version`);
        deadlineBaseline = Number(initial.rows[0]?.version);
        const newerVersions = await getDb().execute(sql`
            INSERT INTO vertical_deadline_version ("version", "values")
            SELECT ${deadlineBaseline + 1}, "values"
            FROM vertical_deadline_version WHERE "version" = ${deadlineBaseline}
            RETURNING "version"`);
        deadlineVersions.push(Number(newerVersions.rows[0]?.version));
        const newestVersion = deadlineBaseline + 2;
        await getDb().execute(sql`
            INSERT INTO vertical_deadline_version ("version", "values")
            SELECT ${newestVersion}, "values"
            FROM vertical_deadline_version WHERE "version" = ${deadlineBaseline + 1}`);
        deadlineVersions.push(newestVersion);
        const value = email();
        const id = await pending(value);
        const actorId = await admin();
        const response = await request({
            action: 'reject',
            id,
            actorId,
            body: { reason: REASON }
        });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: { rejected: true },
            metadata: { requestId: expect.any(String), timestamp: expect.any(String) }
        });
        expect(await application(id)).toMatchObject({
            id,
            status: 'REJECTED',
            resolved_at: expect.anything(),
            partner_id: null,
            deadlines_version: newestVersion,
            wait_cancelled_at: null
        });
        expect(await events(id)).toEqual([
            {
                event_type: 'partner_application.rejected',
                entity_type: 'partner_application',
                actor_type: 'admin',
                actor_id: actorId,
                reason: REASON.trim(),
                changes: [
                    { field: 'status', old: 'PENDING', new: 'REJECTED' },
                    { field: 'resolved_at' },
                    { field: 'deadlines_version' }
                ]
            }
        ]);
    });

    it('(b) leaves the rejection wait for PP1 while a never-rejected email can submit', async () => {
        const value = email();
        const id = await pending(value);
        const actorId = await admin();
        expect(
            (await request({ action: 'reject', id, actorId, body: { reason: REASON } })).status
        ).toBe(200);
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
        const freshEmail = email();
        expect(await submitPartnerApplication({ email: freshEmail })).toEqual({ submitted: true });
        expect(await application(id)).toMatchObject({
            status: 'REJECTED',
            wait_cancelled_at: null
        });
    });

    it('(c) refuses transitions from APPROVED and REJECTED without changing state or adding events', async () => {
        const actorId = await admin();
        const approvedEmail = email();
        const approvedId = await pending(approvedEmail);
        const approval = await request({
            action: 'approve',
            id: approvedId,
            actorId,
            body: { reason: REASON, name: 'PP3 Approved Fixture', type: 'business' }
        });
        expect(approval.status).toBe(200);
        const approvedPartnerId = (approval.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(approvedPartnerId);
        const rejectedId = await pending(email());
        expect(
            (await request({ action: 'reject', id: rejectedId, actorId, body: { reason: REASON } }))
                .status
        ).toBe(200);
        const beforeApproved = await application(approvedId);
        const beforeRejected = await application(rejectedId);
        const approvedEvents = await events(approvedId);
        const rejectedEvents = await events(rejectedId);
        for (const id of [approvedId, rejectedId]) {
            const response = await request({
                action: 'reject',
                id,
                actorId,
                body: { reason: REASON }
            });
            expect(response.status).toBe(409);
            expect(response.body).toMatchObject({
                error: { reason: 'PARTNER_APPLICATION_NOT_PENDING' }
            });
        }
        expect(await application(approvedId)).toEqual(beforeApproved);
        expect(await application(rejectedId)).toEqual(beforeRejected);
        expect(await events(approvedId)).toEqual(approvedEvents);
        expect(await events(rejectedId)).toEqual(rejectedEvents);
    });

    it('(d) denies an admin without action 5 permission', async () => {
        const id = await pending(email());
        const response = await request({
            action: 'reject',
            id,
            actorId: await admin(),
            body: { reason: REASON },
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_MANAGE]
        });
        expect(response.status).toBe(403);
        expect(await application(id)).toMatchObject({
            status: 'PENDING',
            resolved_at: null,
            partner_id: null
        });
        expect(await events(id)).toEqual([]);
    });

    it('(e) answers 404 for an unknown application', async () => {
        const response = await request({
            action: 'reject',
            id: crypto.randomUUID(),
            actorId: await admin(),
            body: { reason: REASON }
        });
        expect(response.status).toBe(404);
    });

    it('(f) rejects a whitespace-only reason', async () => {
        const id = await pending(email());
        const response = await request({
            action: 'reject',
            id,
            actorId: await admin(),
            body: { reason: '   ' }
        });
        expect(response.status).toBe(400);
        expect(await application(id)).toMatchObject({ status: 'PENDING', resolved_at: null });
        expect(await events(id)).toEqual([]);
    });

    it('(g) forbids an admin whose email is the applicant email', async () => {
        const value = email();
        const id = await pending(value);
        const actorId = await admin(value);
        expect(
            (await request({ action: 'reject', id, actorId, body: { reason: REASON } })).status
        ).toBe(403);
        expect(await application(id)).toMatchObject({
            status: 'PENDING',
            resolved_at: null,
            partner_id: null
        });
        expect(await events(id)).toEqual([]);
    });
});
