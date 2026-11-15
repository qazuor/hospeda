import { createHash, randomUUID } from 'node:crypto';
import { getDb, partnerApplicationModel, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { claimPartnerByLink } from '../../../src/services/partner-application/partner-link-claim.service';
import { testDb } from '../../e2e/setup/test-database';
import { createOwner } from '../listing-publication/publication-routes.helpers';
import { createApplicationEmail, insertClaimablePartner } from './partner-application.helpers';

/** TEST:V7:8 proves claim verification preserves the claim session and its credential only. */
describe('claiming verifies the mailbox account and revokes prior access', () => {
    const users: string[] = [];
    const partners: string[] = [];
    const applications: string[] = [];
    const emails: string[] = [];
    const sessions: string[] = [];
    const accounts: string[] = [];
    const verifications: string[] = [];
    beforeAll(async () => {
        initApp();
        await testDb.setup();
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        for (const id of verifications.splice(0))
            await getDb().execute(sql`DELETE FROM verification WHERE id = ${id}`);
        for (const id of sessions.splice(0))
            await getDb().execute(sql`DELETE FROM session WHERE id = ${id}`);
        for (const id of accounts.splice(0))
            await getDb().execute(sql`DELETE FROM account WHERE id = ${id}`);
        for (const id of applications.splice(0))
            await getDb().execute(sql`DELETE FROM partner_application WHERE id = ${id}::uuid`);
        for (const id of partners.splice(0))
            await getDb().execute(sql`DELETE FROM partners WHERE id = ${id}::uuid`);
        for (const id of users.splice(0)) {
            await getDb().execute(sql`DELETE FROM user_role_audit WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
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

    it('(a) TEST:V7:8 verifies email, keeps S1 and its credential, and removes S2, Google, and verification', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const user = await createOwner({ email });
        users.push(user.id);
        await getDb().execute(
            sql`UPDATE users SET email_verified = false WHERE id = ${user.id}::uuid`
        );
        const secret = `claim-${randomUUID()}`;
        const hash = createHash('sha256').update(secret, 'utf8').digest('hex');
        const fixture = await insertClaimablePartner({ email, hash, actorId: user.id });
        partners.push(fixture.partnerId);
        applications.push(fixture.applicationId);
        const sessionId = 'test-session-id';
        const otherSessionId = `other-${randomUUID()}`;
        sessions.push(sessionId, otherSessionId);
        await getDb().execute(
            sql`INSERT INTO session (id, token, user_id, expires_at, auth_method) VALUES (${sessionId}, ${`token-${randomUUID()}`}, ${user.id}::uuid, now() + interval '1 day', 'credential'), (${otherSessionId}, ${`token-${randomUUID()}`}, ${user.id}::uuid, now() + interval '1 day', 'google')`
        );
        const credentialId = `credential-${randomUUID()}`;
        const googleId = `google-${randomUUID()}`;
        accounts.push(credentialId, googleId);
        await getDb().execute(
            sql`INSERT INTO account (id, account_id, provider_id, user_id) VALUES (${credentialId}, ${user.id}, 'credential', ${user.id}::uuid), (${googleId}, 'google-account', 'google', ${user.id}::uuid)`
        );
        const verificationId = `verification-${randomUUID()}`;
        verifications.push(verificationId);
        await getDb().execute(
            sql`INSERT INTO verification (id, identifier, value, expires_at) VALUES (${verificationId}, ${email}, ${user.id}, now() + interval '1 day')`
        );

        const claimed = await claimPartnerByLink({
            actorUserId: user.id,
            currentSessionId: sessionId,
            partnerId: fixture.partnerId,
            secret
        });
        expect(claimed).toEqual({
            claimed: true,
            partnerId: fixture.partnerId,
            emailVerified: true
        });
        expect(
            (
                await getDb().execute(
                    sql`SELECT email_verified FROM users WHERE id = ${user.id}::uuid`
                )
            ).rows
        ).toEqual([{ email_verified: true }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM session WHERE user_id = ${user.id}::uuid ORDER BY id`
                )
            ).rows
        ).toEqual([{ id: sessionId }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT provider_id FROM account WHERE user_id = ${user.id}::uuid ORDER BY provider_id`
                )
            ).rows
        ).toEqual([{ provider_id: 'credential' }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM verification WHERE lower(identifier) = lower(${email}) OR value = ${user.id}`
                )
            ).rows
        ).toEqual([]);
        const event = await getDb().execute(
            sql`SELECT changes FROM domain_event WHERE entity_id = ${fixture.partnerId} AND event_type = 'partner.claimed'`
        );
        expect(event.rows).toEqual([
            {
                changes: [
                    { field: 'owner_user_id', old: null, new: user.id },
                    { field: 'email_verified', old: false, new: true },
                    { field: 'revoked_session_count', old: null, new: 1 },
                    { field: 'removed_credential_providers', old: null, new: ['google'] }
                ]
            }
        ]);
        expect(JSON.stringify(event.rows)).not.toContain(sessionId);
        expect(JSON.stringify(event.rows)).not.toContain(otherSessionId);
    });

    it.each([
        ['google', ['google']],
        [null, []]
    ] as const)('(b,c) TEST:V7:8 preserves only credential %s', async (authMethod, expectedProviders) => {
        const email = createApplicationEmail();
        emails.push(email);
        const user = await createOwner({ email });
        users.push(user.id);
        await getDb().execute(
            sql`UPDATE users SET email_verified = false WHERE id = ${user.id}::uuid`
        );
        const secret = `claim-${randomUUID()}`;
        const fixture = await insertClaimablePartner({
            email,
            hash: createHash('sha256').update(secret, 'utf8').digest('hex'),
            actorId: user.id
        });
        partners.push(fixture.partnerId);
        applications.push(fixture.applicationId);
        const sessionId = `claim-session-${randomUUID()}`;
        sessions.push(sessionId);
        await getDb().execute(
            sql`INSERT INTO session (id, token, user_id, expires_at, auth_method) VALUES (${sessionId}, ${`token-${randomUUID()}`}, ${user.id}::uuid, now() + interval '1 day', ${authMethod})`
        );
        const credentialId = `account-${randomUUID()}`;
        const googleId = `google-${randomUUID()}`;
        accounts.push(credentialId, googleId);
        await getDb().execute(
            sql`INSERT INTO account (id, account_id, provider_id, user_id) VALUES (${credentialId}, ${user.id}, 'credential', ${user.id}::uuid), (${googleId}, 'google-account', 'google', ${user.id}::uuid)`
        );
        await claimPartnerByLink({
            actorUserId: user.id,
            currentSessionId: sessionId,
            partnerId: fixture.partnerId,
            secret
        });
        expect(
            (await getDb().execute(sql`SELECT id FROM session WHERE user_id = ${user.id}::uuid`))
                .rows
        ).toEqual([{ id: sessionId }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT provider_id FROM account WHERE user_id = ${user.id}::uuid ORDER BY provider_id`
                )
            ).rows
        ).toEqual(expectedProviders.map((provider_id) => ({ provider_id })));
    });

    it('(d) TEST:V7:8 refuses a missing or foreign claim session without changing account access', async () => {
        const email = createApplicationEmail();
        emails.push(email);
        const user = await createOwner({ email });
        const other = await createOwner();
        users.push(user.id, other.id);
        await getDb().execute(
            sql`UPDATE users SET email_verified = false WHERE id = ${user.id}::uuid`
        );
        const secret = `claim-${randomUUID()}`;
        const fixture = await insertClaimablePartner({
            email,
            hash: createHash('sha256').update(secret, 'utf8').digest('hex'),
            actorId: user.id
        });
        partners.push(fixture.partnerId);
        applications.push(fixture.applicationId);
        const otherSession = `other-${randomUUID()}`;
        sessions.push(otherSession);
        await getDb().execute(
            sql`INSERT INTO session (id, token, user_id, expires_at, auth_method) VALUES (${otherSession}, ${`token-${randomUUID()}`}, ${user.id}::uuid, now() + interval '1 day', 'credential')`
        );
        const credentialId = `credential-${randomUUID()}`;
        const googleId = `google-${randomUUID()}`;
        accounts.push(credentialId, googleId);
        await getDb().execute(
            sql`INSERT INTO account (id, account_id, provider_id, user_id) VALUES (${credentialId}, ${user.id}, 'credential', ${user.id}::uuid), (${googleId}, 'google-account', 'google', ${user.id}::uuid)`
        );
        const missing = () =>
            claimPartnerByLink({
                actorUserId: user.id,
                currentSessionId: null,
                partnerId: fixture.partnerId,
                secret
            });
        const foreign = () =>
            claimPartnerByLink({
                actorUserId: user.id,
                currentSessionId: `foreign-${other.id}`,
                partnerId: fixture.partnerId,
                secret
            });
        await expect(missing()).rejects.toMatchObject({ code: ServiceErrorCode.UNAUTHORIZED });
        await expect(foreign()).rejects.toMatchObject({ code: ServiceErrorCode.UNAUTHORIZED });
        expect(
            (
                await getDb().execute(
                    sql`SELECT email_verified FROM users WHERE id = ${user.id}::uuid`
                )
            ).rows
        ).toEqual([{ email_verified: false }]);
        expect(
            (await getDb().execute(sql`SELECT id FROM session WHERE id = ${otherSession}`)).rows
        ).toEqual([{ id: otherSession }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id, provider_id FROM account WHERE user_id = ${user.id}::uuid ORDER BY provider_id`
                )
            ).rows
        ).toEqual([
            { id: credentialId, provider_id: 'credential' },
            { id: googleId, provider_id: 'google' }
        ]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT owner_user_id FROM partners WHERE id = ${fixture.partnerId}::uuid`
                )
            ).rows
        ).toEqual([{ owner_user_id: null }]);
    });

    it('(e) TEST:V7:8 leaves other access intact for an already verified claimant', async () => {
        const user = await createOwner();
        users.push(user.id);
        const secret = `claim-${randomUUID()}`;
        const fixture = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash: createHash('sha256').update(secret, 'utf8').digest('hex'),
            actorId: user.id
        });
        partners.push(fixture.partnerId);
        applications.push(fixture.applicationId);
        const otherSession = `other-${randomUUID()}`;
        sessions.push(otherSession);
        await getDb().execute(
            sql`INSERT INTO session (id, token, user_id, expires_at, auth_method) VALUES (${otherSession}, ${`token-${randomUUID()}`}, ${user.id}::uuid, now() + interval '1 day', 'google')`
        );
        const accountId = `google-${randomUUID()}`;
        accounts.push(accountId);
        await getDb().execute(
            sql`INSERT INTO account (id, account_id, provider_id, user_id) VALUES (${accountId}, 'google-account', 'google', ${user.id}::uuid)`
        );
        await claimPartnerByLink({
            actorUserId: user.id,
            currentSessionId: null,
            partnerId: fixture.partnerId,
            secret
        });
        expect(
            (await getDb().execute(sql`SELECT id FROM session WHERE id = ${otherSession}`)).rows
        ).toEqual([{ id: otherSession }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id, provider_id FROM account WHERE id = ${accountId}`
                )
            ).rows
        ).toEqual([{ id: accountId, provider_id: 'google' }]);
    });

    it('(f) TEST:V7:8 maps the unique owner index race to the one-Partner conflict', async () => {
        const user = await createOwner();
        users.push(user.id);
        const existing = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash: '1'.repeat(64),
            actorId: user.id
        });
        const targetSecret = `claim-${randomUUID()}`;
        const target = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash: createHash('sha256').update(targetSecret, 'utf8').digest('hex'),
            actorId: user.id
        });
        partners.push(existing.partnerId, target.partnerId);
        applications.push(existing.applicationId, target.applicationId);
        await getDb().execute(
            sql`UPDATE partners SET owner_user_id = ${user.id}::uuid WHERE id = ${existing.partnerId}::uuid`
        );
        vi.spyOn(partnerApplicationModel, 'findOwnedPartnerId').mockResolvedValue(null);
        await expect(
            claimPartnerByLink({
                actorUserId: user.id,
                currentSessionId: null,
                partnerId: target.partnerId,
                secret: targetSecret
            })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: 'PARTNER_CLAIM_ACCOUNT_ALREADY_OWNS'
        });
    });
});
