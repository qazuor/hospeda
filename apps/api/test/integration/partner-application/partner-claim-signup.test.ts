import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { issuePartnerClaimSecret } from '../../../src/utils/partner-application/partner-claim-secret';
import { testDb } from '../../e2e/setup/test-database';
import { createOwner } from '../listing-publication/publication-routes.helpers';

const app = initApp();

describe('public Partner claim signup', () => {
    const users: string[] = [];
    const partners: string[] = [];
    const emails: string[] = [];
    beforeAll(async () => testDb.setup());
    afterAll(async () => {
        for (const partnerId of partners.splice(0))
            await getDb().execute(sql`DELETE FROM partners WHERE id = ${partnerId}::uuid`);
        for (const userId of users.splice(0)) {
            await getDb().execute(sql`DELETE FROM user_role_audit WHERE user_id = ${userId}::uuid`);
            await getDb().execute(sql`DELETE FROM user_role WHERE user_id = ${userId}::uuid`);
            await getDb().execute(sql`DELETE FROM account WHERE user_id = ${userId}::uuid`);
            await getDb().execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`);
        }
        for (const email of emails.splice(0))
            await getDb().execute(
                sql`DELETE FROM email_outbox WHERE lower(recipient_email) = lower(${email})`
            );
        await testDb.teardown();
    });

    it('looks up a claim mailbox only with a valid token and signs up a verified owner without verification mail', async () => {
        const creator = await createOwner();
        users.push(creator.id);
        const email = `hos2299-${randomUUID()}@example.test`;
        emails.push(email);
        const inserted = await getDb().execute(sql`
            INSERT INTO partners (slug, name, type, lifecycle_state, created_by_id, updated_by_id)
            VALUES (${`hos2299-${randomUUID()}`}, 'HOS-2299 claim', 'business', 'ACTIVE', ${creator.id}::uuid, ${creator.id}::uuid)
            RETURNING id`);
        const partnerId = String(inserted.rows[0]?.id);
        partners.push(partnerId);
        const issued = await issuePartnerClaimSecret({ partnerId, email });
        expect(issued).not.toBeNull();
        const secret = issued?.secret as string;
        const lookup = await app.request('/api/v1/public/partner-claims/lookup', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ partnerId, secret })
        });
        expect(lookup.status, await lookup.clone().text()).toBe(200);
        expect(await lookup.json()).toMatchObject({ data: { email, accountExists: false } });
        const invalid = await app.request('/api/v1/public/partner-claims/lookup', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ partnerId, secret: `${secret}x` })
        });
        expect(invalid.status).toBe(404);
        const invalidSignup = await app.request('/api/v1/public/partner-claims/signup', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ partnerId, secret: `${secret}x`, password: 'StrongPass123!' })
        });
        expect(invalidSignup.status).toBe(404);
        expect(
            (await getDb().execute(sql`SELECT id FROM users WHERE lower(email) = lower(${email})`))
                .rows
        ).toHaveLength(0);

        const signupBody = JSON.stringify({ partnerId, secret, password: 'StrongPass123!' });
        const concurrent = await Promise.all(
            [1, 2].map(() =>
                app.request('/api/v1/public/partner-claims/signup', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                    body: signupBody
                })
            )
        );
        expect(concurrent.map((response) => response.status).sort()).toEqual([200, 409]);
        const created = await getDb().execute(sql`
            SELECT u.id, u.email_verified, p.owner_user_id,
                   array_agg(ur.role::text ORDER BY ur.role::text) AS roles
            FROM users u JOIN partners p ON p.owner_user_id = u.id
            LEFT JOIN user_role ur ON ur.user_id = u.id
            WHERE lower(u.email) = lower(${email})
            GROUP BY u.id, u.email_verified, p.owner_user_id`);
        expect(created.rows).toHaveLength(1);
        expect(created.rows[0]).toMatchObject({
            email_verified: true,
            roles: ['PARTNER_OWNER', 'USER']
        });
        const newUserId = String(created.rows[0]?.id);
        expect(created.rows[0]?.owner_user_id).toBe(newUserId);
        users.push(newUserId);
        expect(
            (
                await getDb().execute(
                    sql`SELECT provider_id FROM account WHERE user_id = ${newUserId}::uuid`
                )
            ).rows
        ).toContainEqual({ provider_id: 'credential' });
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM email_outbox WHERE lower(recipient_email) = lower(${email}) AND template ILIKE '%verif%'`
                )
            ).rows
        ).toHaveLength(0);
        const event = await getDb().execute(
            sql`SELECT event_type, reason, changes FROM domain_event WHERE entity_id = ${partnerId} AND event_type = 'partner.claimed'`
        );
        expect(event.rows).toHaveLength(1);
        expect(event.rows[0]?.reason).toBe('claim_link');
        expect(event.rows[0]?.changes).toContainEqual({
            field: 'owner_user_id',
            old: null,
            new: newUserId
        });
        const secondPartner = await getDb().execute(sql`
            INSERT INTO partners (slug, name, type, lifecycle_state, created_by_id, updated_by_id)
            VALUES (${`hos2299-${randomUUID()}`}, 'HOS-2299 lookup fixture', 'business', 'ACTIVE', ${creator.id}::uuid, ${creator.id}::uuid)
            RETURNING id`);
        const secondPartnerId = String(secondPartner.rows[0]?.id);
        partners.push(secondPartnerId);
        const secondIssued = await issuePartnerClaimSecret({ partnerId: secondPartnerId, email });
        const existingAccountLookup = await app.request('/api/v1/public/partner-claims/lookup', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ partnerId: secondPartnerId, secret: secondIssued?.secret })
        });
        expect(existingAccountLookup.status).toBe(200);
        expect(await existingAccountLookup.json()).toMatchObject({
            data: { email, accountExists: true }
        });
        const existingAccountSignup = await app.request('/api/v1/public/partner-claims/signup', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({
                partnerId: secondPartnerId,
                secret: secondIssued?.secret,
                password: 'AnotherStrong123!'
            })
        });
        expect(existingAccountSignup.status).toBe(409);
        expect(await existingAccountSignup.json()).toMatchObject({
            error: { reason: 'PARTNER_CLAIM_ACCOUNT_EXISTS' }
        });
        const replay = await app.request('/api/v1/public/partner-claims/signup', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ partnerId, secret, password: 'StrongPass123!' })
        });
        expect(replay.status).toBe(409);
        const extraEmail = await app.request('/api/v1/public/partner-claims/signup', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({
                partnerId,
                secret,
                password: 'StrongPass123!',
                email: 'attacker@example.test'
            })
        });
        expect(extraEmail.status).toBe(400);
    });
});
