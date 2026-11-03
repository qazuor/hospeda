/** TEST:V7:4 (base) — PP2 approves without claiming or granting a role. */
import { domainEventModel, getDb, partnerApplicationModel, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import {
    createApplicationEmail,
    deleteApplications,
    deletePartners,
    insertPending,
    readApplications,
    readPartner
} from './partner-application.helpers';

const app = initApp();
const REASON = '  The application was reviewed  ';
const BODY = { reason: REASON, name: 'HOS1485 Example Partner', type: 'business' } as const;
const GRANTED_PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.PARTNER_RESOLVE_APPLICATION
];
const emails: string[] = [];
const applicationIds: string[] = [];
const partnerIds: string[] = [];
const userIds: string[] = [];

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
    const id = await insertPending({ email: value });
    applicationIds.push(id);
    return id;
}

async function approve(input: {
    readonly id: string;
    readonly actorId: string;
    readonly body?: Record<string, unknown>;
    readonly permissions?: readonly PermissionEnum[];
}) {
    const response = await app.request(`/api/v1/admin/partner-applications/${input.id}/approve`, {
        method: 'POST',
        headers: actorHeaders({
            id: input.actorId,
            role: RoleEnum.ADMIN,
            permissions: input.permissions ?? GRANTED_PERMISSIONS
        }),
        body: JSON.stringify(input.body ?? BODY)
    });
    return { status: response.status, body: await response.json() };
}

async function application(id: string) {
    const result = await getDb().execute(sql`
        SELECT id, status, resolved_at, partner_id FROM partner_application WHERE id = ${id}::uuid`);
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
    for (const id of userIds.splice(0)) {
        const db = getDb();
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
    applicationIds.splice(0);
});
afterAll(async () => testDb.teardown());

describe('TEST:V7:4 PP2 approval without claim', () => {
    it('(a) approves an application without an existing account and writes one audit event', async () => {
        const applicantEmail = email();
        const id = await pending(applicantEmail);
        const actorId = await admin();

        const response = await approve({ id, actorId });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: { approved: true, partnerId: expect.any(String) },
            metadata: { requestId: expect.any(String), timestamp: expect.any(String) }
        });
        const partnerId = (response.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(partnerId);
        expect(await application(id)).toMatchObject({
            id,
            status: 'APPROVED',
            resolved_at: expect.anything(),
            partner_id: partnerId
        });
        const partner = await readPartner({ id: partnerId });
        expect(partner).toMatchObject({
            id: partnerId,
            name: BODY.name,
            type: BODY.type,
            lifecycle_state: 'DRAFT',
            owner_user_id: null,
            claim_secret_hash: null
        });
        expect(String(partner?.slug)).toMatch(/^hos1485-example-partner-/);
        const users = await getDb().execute(sql`
            SELECT id FROM users WHERE lower(email) = lower(${applicantEmail})`);
        expect(users.rows).toHaveLength(1);
        const createdUser = users.rows[0] as { id: string };
        userIds.push(createdUser.id);
        const written = await events(id);
        expect(written).toEqual([
            {
                event_type: 'partner_application.approved',
                entity_type: 'partner_application',
                actor_type: 'admin',
                actor_id: actorId,
                reason: REASON.trim(),
                changes: [
                    { field: 'status', old: 'PENDING', new: 'APPROVED' },
                    { field: 'resolved_at' },
                    { field: 'partner_id', new: partnerId },
                    { field: 'claim_account_user_id', new: createdUser.id }
                ]
            }
        ]);
    });

    it('(b) approves an application whose email belongs to an account without changing or linking it', async () => {
        const existing = await admin();
        const accountEmail = `pp2-existing-${crypto.randomUUID()}@example.test`;
        emails.push(accountEmail);
        const user = await createOwner({ email: accountEmail });
        userIds.push(user.id);
        const beforeUser = await getDb().execute(
            sql`SELECT * FROM users WHERE id = ${user.id}::uuid`
        );
        const id = await pending(accountEmail);

        const response = await approve({ id, actorId: existing });
        expect(response.status).toBe(200);
        const partnerId = (response.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(partnerId);
        expect(await readPartner({ id: partnerId })).toMatchObject({
            id: partnerId,
            lifecycle_state: 'DRAFT',
            owner_user_id: null,
            claim_secret_hash: null
        });
        const role = await getDb().execute(sql`
            SELECT user_id FROM user_role WHERE user_id = ${user.id}::uuid AND role = 'PARTNER_OWNER'`);
        expect(role.rows).toEqual([]);
        const owned = await getDb().execute(sql`
            SELECT id FROM partners WHERE owner_user_id = ${user.id}::uuid`);
        expect(owned.rows).toEqual([]);
        const afterUser = await getDb().execute(
            sql`SELECT * FROM users WHERE id = ${user.id}::uuid`
        );
        expect(afterUser.rows[0]).toEqual(beforeUser.rows[0]);
        expect(await events(id)).toHaveLength(1);
    });

    it('(c) keeps the approved draft out of public results while an active result is present', async () => {
        const actorId = await admin();
        const applicantEmail = email();
        const id = await pending(applicantEmail);
        const response = await approve({
            id,
            actorId,
            body: { ...BODY, name: 'Unique HOS1485 Canary' }
        });
        expect(response.status).toBe(200);
        const approvedId = (response.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(approvedId);

        const active = await getDb().execute(sql`
            INSERT INTO partners (slug, name, type, lifecycle_state, created_by_id, updated_by_id)
            VALUES (${`hos1485-canary-${crypto.randomUUID()}`}, 'HOS1485 Canary Active', 'business', 'ACTIVE', ${actorId}, ${actorId})
            RETURNING id`);
        const activeId = String(active.rows[0]?.id);
        partnerIds.push(activeId);
        const listing = await app.request('/api/v1/public/partners?pageSize=100', {
            headers: { 'user-agent': 'pp2-integration-test' }
        });
        const listed = await listing.json();
        expect(listing.status, JSON.stringify(listed)).toBe(200);
        expect(JSON.stringify(listed)).toContain(activeId);
        expect(JSON.stringify(listed)).not.toContain(approvedId);
    });

    it('(d) returns conflict for already approved and rejected applications without new rows or events', async () => {
        const actorId = await admin();
        const approvedId = await pending(email());
        const first = await approve({ id: approvedId, actorId });
        const approvedPartnerId = (first.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(approvedPartnerId);
        const rejectedEmail = email();
        const rejectedId = await pending(rejectedEmail);
        const rejectResponse = await app.request(
            `/api/v1/admin/partner-applications/${rejectedId}/reject`,
            {
                method: 'POST',
                headers: actorHeaders({
                    id: actorId,
                    role: RoleEnum.ADMIN,
                    permissions: GRANTED_PERMISSIONS
                }),
                body: JSON.stringify({ reason: 'Rejected for test' })
            }
        );
        expect(rejectResponse.status).toBe(200);
        const beforeApproved = await application(approvedId);
        const beforeRejected = await application(rejectedId);
        const partnerCount = (
            await getDb().execute(
                sql`SELECT count(*)::int AS count FROM partners WHERE id = ${approvedPartnerId}::uuid`
            )
        ).rows[0]?.count;
        const approvedEvents = await events(approvedId);
        const rejectedEvents = await events(rejectedId);
        for (const applicationId of [approvedId, rejectedId]) {
            const repeated = await approve({ id: applicationId, actorId });
            expect(repeated.status).toBe(409);
            expect(repeated.body).toMatchObject({
                error: { reason: 'PARTNER_APPLICATION_NOT_PENDING' }
            });
        }
        expect(await application(approvedId)).toEqual(beforeApproved);
        expect(await application(rejectedId)).toEqual(beforeRejected);
        expect(
            (
                await getDb().execute(
                    sql`SELECT count(*)::int AS count FROM partners WHERE id = ${approvedPartnerId}::uuid`
                )
            ).rows[0]?.count
        ).toBe(partnerCount);
        expect(await events(approvedId)).toEqual(approvedEvents);
        expect(await events(rejectedId)).toEqual(rejectedEvents);
    });

    it('(e) rejects an admin without the action 5 permission before writing', async () => {
        const id = await pending(email());
        const response = await approve({
            id,
            actorId: await admin(),
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_MANAGE]
        });
        expect(response.status).toBe(403);
        expect(await application(id)).toMatchObject({
            status: 'PENDING',
            partner_id: null,
            resolved_at: null
        });
        expect(await events(id)).toEqual([]);
    });

    it('(f) answers 404 for an unknown application', async () => {
        expect((await approve({ id: crypto.randomUUID(), actorId: await admin() })).status).toBe(
            404
        );
    });

    it('(g) validates approval reason, name, and partner type', async () => {
        const actorId = await admin();
        const id = await pending(email());
        for (const body of [
            { ...BODY, reason: '   ' },
            { reason: BODY.reason, type: BODY.type },
            { ...BODY, type: 'invalid' }
        ]) {
            expect((await approve({ id, actorId, body })).status).toBe(400);
        }
        expect(await application(id)).toMatchObject({ status: 'PENDING', partner_id: null });
        expect(await events(id)).toEqual([]);
    });

    it('(h) forbids an admin whose email is the applicant email', async () => {
        const value = email();
        const id = await pending(value);
        const actorId = await admin(value);
        expect((await approve({ id, actorId })).status).toBe(403);
        expect(await application(id)).toMatchObject({ status: 'PENDING', partner_id: null });
        expect(await events(id)).toEqual([]);
    });

    it('(i) serializes concurrent approvals so exactly one creates a Partner', async () => {
        const applicantEmail = email();
        const id = await pending(applicantEmail);
        const actorId = await admin();
        let signalFirstInsert!: () => void;
        let releaseFirstInsert!: () => void;
        const firstInsert = new Promise<void>((resolve) => {
            signalFirstInsert = resolve;
        });
        const firstInsertGate = new Promise<void>((resolve) => {
            releaseFirstInsert = resolve;
        });
        let insertCalls = 0;
        const insertPartner =
            partnerApplicationModel.insertUnclaimedPartner.bind(partnerApplicationModel);
        const insertSpy = vi
            .spyOn(partnerApplicationModel, 'insertUnclaimedPartner')
            .mockImplementation(async (args) => {
                insertCalls += 1;
                if (insertCalls === 1) {
                    signalFirstInsert();
                    await firstInsertGate;
                }
                return insertPartner(args);
            });
        const first = approve({
            id,
            actorId,
            body: { ...BODY, name: 'HOS1485 Concurrency' }
        });
        await firstInsert;
        const second = approve({
            id,
            actorId,
            body: { ...BODY, name: 'HOS1485 Concurrency' }
        });
        let lockObserved = false;
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline && !lockObserved && insertCalls < 2) {
            const waiting = await getDb().execute(sql`
                SELECT 1 FROM pg_stat_activity
                WHERE datname = current_database() AND wait_event_type = 'Lock' LIMIT 1`);
            lockObserved = waiting.rows.length > 0;
            if (!lockObserved && insertCalls < 2) {
                await new Promise<void>((resolve) => setTimeout(resolve, 20));
            }
        }
        releaseFirstInsert();
        const results = await Promise.all([first, second]);
        insertSpy.mockRestore();
        expect(lockObserved).toBe(true);
        expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
        const rows = await readApplications({ email: applicantEmail });
        expect(rows).toHaveLength(1);
        const partners = await getDb().execute(sql`
            SELECT id FROM partners WHERE slug LIKE 'hos1485-concurrency-%'`);
        expect(partners.rows).toHaveLength(1);
        partnerIds.push(...partners.rows.map((row) => String(row.id)));
        expect(await events(id)).toHaveLength(1);
    });

    it('(j) rolls back approval and Partner creation when audit insertion fails', async () => {
        const id = await pending(email());
        const actorId = await admin();
        const insertEvent = domainEventModel.insert.bind(domainEventModel);
        const eventSpy = vi.spyOn(domainEventModel, 'insert').mockImplementation(async (args) => {
            await insertEvent(args);
            throw new Error('Injected audit insertion failure');
        });
        const response = await approve({
            id,
            actorId,
            body: { ...BODY, name: 'HOS1485 Audit Atomicity' }
        });
        eventSpy.mockRestore();
        expect(response.status).toBe(500);
        expect(await application(id)).toMatchObject({
            status: 'PENDING',
            resolved_at: null,
            partner_id: null
        });
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM partners WHERE slug LIKE 'hos1485-audit-atomicity-%'`
                )
            ).rows
        ).toEqual([]);
        expect(await events(id)).toEqual([]);
    });
});
