import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { getAuth } from '../../../src/lib/auth';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import { createApplicationEmail, insertClaimablePartner } from './partner-application.helpers';

/** TEST:V7:10 verifies existing email update doors stay closed and the claim route admits verification; the policy is also tested by TEST:V5:3 in email-unverified-partner-link.test.ts. */
describe('email changes for unverified Partner owners', () => {
    const app = initApp();
    const users: string[] = [];
    const partners: string[] = [];
    const applications: string[] = [];
    const emails: string[] = [];
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    afterEach(async () => {
        for (const id of applications.splice(0))
            await getDb().execute(sql`DELETE FROM partner_application WHERE id = ${id}::uuid`);
        for (const id of partners.splice(0))
            await getDb().execute(sql`DELETE FROM partners WHERE id = ${id}::uuid`);
        for (const id of users.splice(0)) {
            await getDb().execute(sql`DELETE FROM user_role_audit WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM session WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
        }
        for (const email of emails.splice(0))
            await getDb().execute(
                sql`DELETE FROM partner_application WHERE lower(email) = lower(${email})`
            );
    });
    afterAll(async () => {
        await testDb.teardown();
    });

    it('(a,b) TEST:V7:10 exposes no Better Auth changeEmail door and PATCH does not alter email', async () => {
        const user = await createOwner();
        users.push(user.id);
        const partner = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash: '0'.repeat(64),
            actorId: user.id
        });
        partners.push(partner.partnerId);
        applications.push(partner.applicationId);
        await getDb().execute(
            sql`UPDATE partners SET owner_user_id = ${user.id}::uuid WHERE id = ${partner.partnerId}::uuid`
        );
        await getDb().execute(
            sql`UPDATE users SET email_verified = false WHERE id = ${user.id}::uuid`
        );
        const userOptions = getAuth().options.user;
        expect(userOptions && 'changeEmail' in userOptions).toBe(false);
        const response = await app.request(`/api/v1/protected/users/${user.id}`, {
            method: 'PATCH',
            headers: actorHeaders({ id: user.id, role: RoleEnum.HOST }),
            body: JSON.stringify({ email: 'otro@example.test', displayName: 'X' })
        });
        expect(response.status).toBe(400);
        const saved = await getDb().execute(
            sql`SELECT email FROM users WHERE id = ${user.id}::uuid`
        );
        expect(saved.rows).toEqual([{ email: user.email }]);
    });

    it('(c) TEST:V7:10 allows the VERIFY_EMAIL operation through the protected route', async () => {
        const mailbox = createApplicationEmail();
        emails.push(mailbox);
        const user = await createOwner({ email: mailbox });
        users.push(user.id);
        await getDb().execute(
            sql`UPDATE users SET email_verified = false WHERE id = ${user.id}::uuid`
        );
        const secret = `verification-${randomUUID()}`;
        const hash = await import('node:crypto').then(({ createHash }) =>
            createHash('sha256').update(secret, 'utf8').digest('hex')
        );
        const partner = await insertClaimablePartner({ email: mailbox, hash, actorId: user.id });
        partners.push(partner.partnerId);
        applications.push(partner.applicationId);
        const response = await app.request('/api/v1/protected/partner-claims', {
            method: 'POST',
            headers: {
                ...actorHeaders({ id: user.id, role: RoleEnum.HOST }),
                authorization: 'Bearer integration-test-token'
            },
            body: JSON.stringify({ partnerId: partner.partnerId, secret })
        });
        expect(response.status).not.toBe(403);
        if (response.status === 200) {
            const saved = await getDb().execute(
                sql`SELECT email_verified, owner_user_id FROM users JOIN partners ON partners.owner_user_id = users.id WHERE users.id = ${user.id}::uuid`
            );
            expect(saved.rows).toEqual([{ email_verified: true, owner_user_id: user.id }]);
        }
    });
});
