import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

vi.mock('../../../src/utils/turnstile', () => ({
    getTurnstileSecret: () => 'test-secret',
    verifyCfTurnstileToken: vi.fn().mockResolvedValue({ success: true })
}));

const app = initApp();
const emails: string[] = [];
const uniqueEmail = () => {
    const email = `v715-${randomUUID()}@example.test`;
    emails.push(email);
    return email;
};

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    for (const email of emails.splice(0)) {
        await getDb().execute(sql`DELETE FROM alliance_leads WHERE lower(email) = lower(${email})`);
        await getDb().execute(
            sql`DELETE FROM partner_application WHERE lower(email) = lower(${email})`
        );
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:V7:15 AC:V7:15 — Partner applications bypass alliance leads', () => {
    it('writes Partner applications only to partner_application and keeps sponsor leads', async () => {
        const partnerEmail = uniqueEmail();
        const rejectedEmail = uniqueEmail();
        const sponsorEmail = uniqueEmail();

        const sponsor = await app.request('/api/v1/public/alliance/leads', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({
                kind: 'sponsor',
                contactName: 'Sponsor test',
                email: sponsorEmail,
                message: 'Sponsor application for integration test'
            })
        });
        expect(sponsor.status).toBe(200);
        const sponsorRows = await getDb().execute(
            sql`SELECT id FROM alliance_leads WHERE email = ${sponsorEmail}`
        );
        expect(sponsorRows.rows).toHaveLength(1);

        const partner = await app.request('/api/v1/public/partner-applications', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ email: partnerEmail, cfTurnstileToken: 'valid-token' })
        });
        expect(partner.status).toBe(201);
        const partnerRows = await getDb().execute(
            sql`SELECT email, partner_id FROM partner_application WHERE email = ${partnerEmail}`
        );
        expect(partnerRows.rows).toEqual([{ email: partnerEmail, partner_id: null }]);

        const invalidPartner = await app.request('/api/v1/public/alliance/leads', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({
                kind: 'partner',
                contactName: 'Partner test',
                email: rejectedEmail,
                message: 'Partner application must use PP1',
                partnerType: 'business'
            })
        });
        expect(invalidPartner.status).toBe(400);
        const invalidRows = await getDb().execute(
            sql`SELECT id FROM alliance_leads WHERE email = ${rejectedEmail}`
        );
        expect(invalidRows.rows).toHaveLength(0);

        const partnerLeadRows = await getDb().execute(
            sql`SELECT id FROM alliance_leads WHERE email = ${partnerEmail}`
        );
        expect(partnerLeadRows.rows).toHaveLength(0);
    });
});
