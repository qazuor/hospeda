import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { submitPartnerApplication } from '../../../src/services/partner-application/partner-application-submission.service';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../listing-publication/publication-routes.helpers';
import {
    createApplicationEmail,
    deleteApplications,
    insertRejected,
    readApplications
} from './partner-application.helpers';

vi.mock('../../../src/utils/turnstile', () => ({
    getTurnstileSecret: () => 'test-secret',
    verifyCfTurnstileToken: vi.fn().mockResolvedValue({ success: true })
}));

const app = initApp();
const testEmails: string[] = [];
const rememberEmail = () => {
    const email = createApplicationEmail();
    testEmails.push(email);
    return email;
};

async function checkDatabasePreconditions(): Promise<void> {
    const db = getDb();
    const trigger = await db.execute(sql`
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'partner_application_wait_active' AND NOT tgisinternal`);
    expect(
        trigger.rows,
        'Required partner_application_wait_active trigger is missing'
    ).toHaveLength(1);
    const deadline = await db.execute(sql`
        SELECT 1 FROM vertical_deadline_version WHERE "values" ? '9' LIMIT 1`);
    expect(
        deadline.rows,
        'Required PLAZO:9 value is missing from vertical_deadline_version'
    ).toHaveLength(1);
}

async function assertPending(email: string) {
    const rows = await readApplications({ email });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
        email,
        status: 'PENDING',
        partner_id: null,
        resolved_at: null,
        wait_cancelled_at: null
    });
    const current = await getDb().execute(
        sql`SELECT max("version") AS version FROM vertical_deadline_version`
    );
    expect(rows[0]?.deadlines_version).toBe(current.rows[0]?.version);
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    await checkDatabasePreconditions();
});
afterEach(async () => {
    for (const email of testEmails.splice(0)) await deleteApplications({ email });
});
afterAll(async () => testDb.teardown());

describe('TEST:V7:1 PP1 creates PENDING applications', () => {
    it('creates exactly one pending application through the service and saves its written email case', async () => {
        const email = rememberEmail().replace('pp1-', 'PP1-');
        expect(await submitPartnerApplication({ email })).toEqual({ submitted: true });
        await assertPending(email);
    });

    it('creates a pending application through the public route for a guest', async () => {
        const email = rememberEmail();
        const response = await app.request('/api/v1/public/partner-applications', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'pp1-integration-test' },
            body: JSON.stringify({ email, cfTurnstileToken: 'valid-token' })
        });
        expect(response.status).toBe(201);
        expect((await response.json()).data).toEqual({ submitted: true });
        await assertPending(email);
    });

    it('creates a pending application through the route for a verified account actor', async () => {
        const email = rememberEmail();
        const response = await app.request('/api/v1/public/partner-applications', {
            method: 'POST',
            headers: actorHeaders({ id: randomUUID(), role: RoleEnum.USER }),
            body: JSON.stringify({ email, cfTurnstileToken: 'valid-token' })
        });
        expect(response.status).toBe(201);
        expect((await response.json()).data).toEqual({ submitted: true });
        await assertPending(email);
    });

    it('allows a new application after a rejected application’s 30-day wait expired', async () => {
        const email = rememberEmail();
        await insertRejected({ email, resolvedDaysAgo: 40 });
        expect(await submitPartnerApplication({ email })).toEqual({ submitted: true });
        const rows = await readApplications({ email });
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.status).sort()).toEqual(['PENDING', 'REJECTED']);
    });
});
