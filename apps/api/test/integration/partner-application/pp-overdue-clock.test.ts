/** TEST:V7:6 — advancing time marks pending applications overdue without transitions. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, listPartnerApplicationsForPanel, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock, systemClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import { createApplicationEmail, insertPending } from './partner-application.helpers';

const app = initApp();
const DAY_MS = 24 * 60 * 60 * 1000;
const emails: string[] = [];
const applicationIds: string[] = [];
const partnerIds: string[] = [];
const userIds: string[] = [];
let deadlineVersion = 0;
let deadlineDays = 0;

function email(): string {
    const value = createApplicationEmail();
    emails.push(value);
    return value;
}

async function readApplication(id: string) {
    const result = await getDb().execute(sql`
        SELECT status, resolved_at, partner_id
        FROM partner_application WHERE id = ${id}::uuid`);
    return result.rows[0];
}

async function readCreatedAt(id: string): Promise<Date> {
    const result = await getDb().execute(sql`
        SELECT created_at FROM partner_application WHERE id = ${id}::uuid`);
    return new Date(result.rows[0]?.created_at as Date);
}

async function approve(applicationId: string, actorId: string, name: string) {
    return app.request(`/api/v1/admin/partner-applications/${applicationId}/approve`, {
        method: 'POST',
        headers: actorHeaders({
            id: actorId,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.PARTNER_RESOLVE_APPLICATION
            ]
        }),
        body: JSON.stringify({ reason: 'Clock test approval', name, type: 'business' })
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    const result = await getDb().execute(sql`
        SELECT version, ("values" -> '8' ->> 'days')::int AS days
        FROM vertical_deadline_version
        WHERE version = (SELECT max(version) FROM vertical_deadline_version)`);
    const row = result.rows[0];
    expect(row, 'Current deadline version is missing').toBeDefined();
    expect(row?.days, 'Current deadline version must define PLAZO:8').toEqual(expect.any(Number));
    deadlineVersion = Number(row?.version);
    deadlineDays = Number(row?.days);
});

afterEach(async () => {
    injectClock({ clock: systemClock });
    const db = getDb();
    for (const id of applicationIds.splice(0)) {
        await db.execute(sql`DELETE FROM partner_application WHERE id = ${id}::uuid`);
    }
    for (const id of partnerIds.splice(0)) {
        await db.execute(sql`DELETE FROM partners WHERE id = ${id}::uuid`);
    }
    for (const id of userIds.splice(0)) {
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
    for (const value of emails.splice(0)) {
        const applicant = await db.execute(
            sql`SELECT id FROM users WHERE lower(email) = lower(${value})`
        );
        for (const row of applicant.rows) {
            const id = String(row.id);
            await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
            await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
            await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
        }
        await db.execute(sql`DELETE FROM partner_application WHERE lower(email) = lower(${value})`);
    }
});

afterAll(async () => testDb.teardown());

describe('TEST:V7:6 time does not transition partner applications', () => {
    it('(a,b) marks only overdue pending rows and preserves their state at the strict deadline edge', async () => {
        const firstEmail = email();
        const secondEmail = email();
        const firstId = await insertPending({
            email: firstEmail,
            deadlinesVersion: deadlineVersion
        });
        const secondId = await insertPending({
            email: secondEmail,
            deadlinesVersion: deadlineVersion
        });
        applicationIds.push(firstId, secondId);
        const createdAt = await readCreatedAt(firstId);
        const clock = createAdjustableClock({ start: createdAt });
        injectClock({ clock });

        const atCreation = await listPartnerApplicationsForPanel({
            view: 'pending',
            now: clock.now(),
            page: 1,
            pageSize: 100
        });
        for (const id of [firstId, secondId]) {
            expect(atCreation.items.find((item) => item.id === id)?.overdue).toBe(false);
        }

        clock.advance({ ms: deadlineDays * DAY_MS });
        const atDeadline = await listPartnerApplicationsForPanel({
            view: 'pending',
            now: clock.now(),
            page: 1,
            pageSize: 100
        });
        for (const id of [firstId, secondId]) {
            expect(atDeadline.items.find((item) => item.id === id)?.overdue).toBe(false);
        }

        clock.advance({ ms: DAY_MS / 24 });
        const overdue = await listPartnerApplicationsForPanel({
            view: 'pending',
            now: clock.now(),
            page: 1,
            pageSize: 100
        });
        for (const id of [firstId, secondId]) {
            expect(overdue.items.find((item) => item.id === id)?.overdue).toBe(true);
            expect(await readApplication(id)).toEqual({
                status: 'PENDING',
                resolved_at: null,
                partner_id: null
            });
        }
    });

    it('(c) an approved unclaimed application remains a private draft after 400 days', async () => {
        const owner = await createOwner();
        userIds.push(owner.id);
        const prefix = `pp1485-${randomUUID().slice(0, 8)}`;
        const activeId = randomUUID();
        const activeName = `${prefix} active directory control`;
        const draftName = `${prefix} approved private draft`;
        await getDb().execute(sql`
            INSERT INTO partners (id, slug, name, type, lifecycle_state)
            VALUES (${activeId}::uuid, ${`${prefix}-active`}, ${activeName}, 'business', 'ACTIVE')`);
        partnerIds.push(activeId);

        const applicantEmail = email();
        const applicationId = await insertPending({
            email: applicantEmail,
            deadlinesVersion: deadlineVersion
        });
        applicationIds.push(applicationId);
        const clock = createAdjustableClock({ start: new Date() });
        injectClock({ clock });
        const approvedResponse = await approve(applicationId, owner.id, draftName);
        expect(approvedResponse.status).toBe(200);
        const approvedBody = (await approvedResponse.json()) as {
            data?: { approved?: boolean; partnerId?: string };
        };
        expect(approvedBody.data?.approved).toBe(true);
        const draftId = approvedBody.data?.partnerId;
        expect(draftId).toEqual(expect.any(String));
        if (!draftId) throw new Error('Approval response did not include partnerId');
        partnerIds.push(draftId);

        clock.advance({ ms: 400 * DAY_MS });
        const state = await getDb().execute(sql`
            SELECT pa.status, p.owner_user_id, p.lifecycle_state
            FROM partner_application pa JOIN partners p ON p.id = pa.partner_id
            WHERE pa.id = ${applicationId}::uuid`);
        expect(state.rows).toEqual([
            { status: 'APPROVED', owner_user_id: null, lifecycle_state: 'DRAFT' }
        ]);

        const subscriptionColumns = await getDb().execute(sql`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'subscription'`);
        const columnNames = subscriptionColumns.rows.map((row) => String(row.column_name));
        expect(columnNames).toContain('user_id');
        expect(columnNames).not.toContain('partner_id');
        expect(columnNames).not.toContain('partner');
        const partnerOwnedSubscriptions = await getDb().execute(sql`
            SELECT id FROM subscription WHERE user_id = ${draftId}::uuid`);
        expect(partnerOwnedSubscriptions.rows).toEqual([]);
        const qResponse = await app.request(`/api/v1/public/partners?q=${prefix}`, {
            method: 'GET',
            headers: { 'user-agent': 'pp-overdue-clock-test' }
        });
        expect(qResponse.status).toBe(400);
        const publicResponse = await app.request('/api/v1/public/partners?pageSize=100', {
            method: 'GET',
            headers: { 'user-agent': 'pp-overdue-clock-test' }
        });
        expect(publicResponse.status).toBe(200);
        const publicBody = (await publicResponse.json()) as {
            data?: { items?: Array<{ id: string }> };
        };
        const publicIds = publicBody.data?.items?.map((item) => item.id) ?? [];
        expect(publicIds).toContain(activeId);
        expect(publicIds).not.toContain(draftId);
    });

    it('declares no partner application cron job in the schedule manifest', () => {
        const manifestPath = resolve(
            import.meta.dirname,
            '../../../src/cron/schedules.manifest.ts'
        );
        expect(readFileSync(manifestPath, 'utf8')).not.toMatch(/partner_application/);
    });
});
