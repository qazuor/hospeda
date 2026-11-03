import { createHash, randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import { createApplicationEmail, insertClaimablePartner } from './partner-application.helpers';

/** TEST:V7:7 and TEST:V7:9 exercise ownership, opaque failures, and one-use claim behavior. */
describe('Partner link claim route', () => {
    const app = initApp();
    const emails: string[] = [];
    const partnerIds: string[] = [];
    const applicationIds: string[] = [];
    const users: string[] = [];
    const secret = `known-${randomUUID()}`;
    const hash = createHash('sha256').update(secret, 'utf8').digest('hex');

    async function claim(actorId: string, partnerId: string, value: string) {
        return app.request('/api/v1/protected/partner-claims', {
            method: 'POST',
            headers: actorHeaders({ id: actorId, role: RoleEnum.HOST }),
            body: JSON.stringify({ partnerId, secret: value })
        });
    }

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });

    afterEach(async () => {
        for (const id of applicationIds.splice(0))
            await getDb().execute(sql`DELETE FROM partner_application WHERE id = ${id}::uuid`);
        for (const id of partnerIds.splice(0))
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

    it('(a) TEST:V7:7 assigns the Partner to the signed-in claimant, not the application mailbox account', async () => {
        const mailbox = createApplicationEmail();
        emails.push(mailbox);
        const a = await createOwner({ email: mailbox });
        const b = await createOwner();
        users.push(a.id, b.id);
        const aSessionId = `a-session-${randomUUID()}`;
        const aAccountId = `a-account-${randomUUID()}`;
        await getDb().execute(
            sql`INSERT INTO session (id, token, user_id, expires_at, auth_method) VALUES (${aSessionId}, ${`token-${randomUUID()}`}, ${a.id}::uuid, now() + interval '1 day', 'credential')`
        );
        await getDb().execute(
            sql`INSERT INTO account (id, account_id, provider_id, user_id) VALUES (${aAccountId}, ${a.id}, 'credential', ${a.id}::uuid)`
        );
        await getDb().execute(
            sql`INSERT INTO user_role (user_id, role, grant_reason) VALUES (${a.id}::uuid, 'USER', 'test-fixture')`
        );
        const fixture = await insertClaimablePartner({ email: mailbox, hash, actorId: b.id });
        partnerIds.push(fixture.partnerId);
        applicationIds.push(fixture.applicationId);
        const response = await claim(b.id, fixture.partnerId, secret);
        expect(response.status).toBe(200);
        const successBody = await response.json();
        expect({ success: successBody.success, data: successBody.data }).toEqual({
            success: true,
            data: { claimed: true, partnerId: fixture.partnerId, emailVerified: true }
        });
        const owner = await getDb().execute(
            sql`SELECT owner_user_id, claim_secret_hash FROM partners WHERE id = ${fixture.partnerId}::uuid`
        );
        expect(owner.rows).toEqual([{ owner_user_id: b.id, claim_secret_hash: hash }]);
        const application = await getDb().execute(
            sql`SELECT status FROM partner_application WHERE id = ${fixture.applicationId}::uuid`
        );
        expect(application.rows).toEqual([{ status: 'APPROVED' }]);
        const role = await getDb().execute(
            sql`SELECT role, grant_reason FROM user_role WHERE user_id = ${b.id}::uuid AND role = 'PARTNER_OWNER'`
        );
        expect(role.rows).toEqual([{ role: 'PARTNER_OWNER', grant_reason: 'partner_claimed' }]);
        const event = await getDb().execute(
            sql`SELECT actor_id, reason, changes FROM domain_event WHERE entity_id = ${fixture.partnerId} AND event_type = 'partner.claimed'`
        );
        expect(event.rows).toEqual([
            {
                actor_id: b.id,
                reason: 'claim_link',
                changes: [{ field: 'owner_user_id', old: null, new: b.id }]
            }
        ]);
        const aSnapshot = await getDb().execute(
            sql`SELECT email, email_verified FROM users WHERE id = ${a.id}::uuid`
        );
        expect(aSnapshot.rows).toEqual([{ email: mailbox, email_verified: true }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT role, grant_reason FROM user_role WHERE user_id = ${a.id}::uuid ORDER BY role`
                )
            ).rows
        ).toEqual([{ role: 'USER', grant_reason: 'test-fixture' }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id, user_id, auth_method FROM session WHERE user_id = ${a.id}::uuid`
                )
            ).rows
        ).toEqual([{ id: aSessionId, user_id: a.id, auth_method: 'credential' }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id, provider_id, user_id FROM account WHERE user_id = ${a.id}::uuid`
                )
            ).rows
        ).toEqual([{ id: aAccountId, provider_id: 'credential', user_id: a.id }]);
    });

    it('(b, f) TEST:V7:9 makes missing id, missing secret, wrong secret, and deleted Partner identical 404s', async () => {
        const owner = await createOwner();
        users.push(owner.id);
        const fixture = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash,
            actorId: owner.id
        });
        partnerIds.push(fixture.partnerId);
        applicationIds.push(fixture.applicationId);
        const responses = await Promise.all([
            claim(owner.id, fixture.partnerId, ''),
            claim(owner.id, fixture.partnerId, `wrong-${randomUUID()}`),
            claim(owner.id, randomUUID(), secret)
        ]);
        const bodies = await Promise.all(responses.map((response) => response.json()));
        expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
        const withoutMetadata = (body: {
            readonly success: boolean;
            readonly error?: unknown;
        }) => ({ success: body.success, error: body.error });
        expect(withoutMetadata(bodies[0])).toEqual(withoutMetadata(bodies[1]));
        expect(withoutMetadata(bodies[1])).toEqual(withoutMetadata(bodies[2]));
        expect(bodies[0].error.code).toBe('NOT_FOUND');
        await getDb().execute(
            sql`UPDATE partners SET deleted_at = now() WHERE id = ${fixture.partnerId}::uuid`
        );
        const deleted = await claim(owner.id, fixture.partnerId, secret);
        expect(deleted.status).toBe(404);
        expect(withoutMetadata(await deleted.json())).toEqual(withoutMetadata(bodies[0]));
    });

    it('(c) TEST:V7:9 spends the claim once and hides the owner identity', async () => {
        const b = await createOwner();
        const c = await createOwner();
        users.push(b.id, c.id);
        const fixture = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash,
            actorId: b.id
        });
        partnerIds.push(fixture.partnerId);
        applicationIds.push(fixture.applicationId);
        expect((await claim(b.id, fixture.partnerId, secret)).status).toBe(200);
        const repeated = await claim(c.id, fixture.partnerId, secret);
        expect(repeated.status).toBe(409);
        const body = await repeated.json();
        expect(body.error.reason).toBe('PARTNER_ALREADY_CLAIMED');
        expect(JSON.stringify(body)).not.toContain(b.id);
        expect(JSON.stringify(body)).not.toContain(b.email);
        expect((await claim(c.id, fixture.partnerId, `wrong-${randomUUID()}`)).status).toBe(404);
    });

    it('(d) TEST:V7:7 refuses a second Partner without spending its link, then another account claims it', async () => {
        const b = await createOwner();
        const d = await createOwner();
        users.push(b.id, d.id);
        const first = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash: `1`.repeat(64),
            actorId: b.id
        });
        const second = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash,
            actorId: b.id
        });
        partnerIds.push(first.partnerId, second.partnerId);
        applicationIds.push(first.applicationId, second.applicationId);
        await getDb().execute(
            sql`UPDATE partners SET owner_user_id = ${b.id}::uuid WHERE id = ${first.partnerId}::uuid`
        );
        const refused = await claim(b.id, second.partnerId, secret);
        expect(refused.status).toBe(409);
        expect((await refused.json()).error.reason).toBe('PARTNER_CLAIM_ACCOUNT_ALREADY_OWNS');
        expect(
            (
                await getDb().execute(
                    sql`SELECT owner_user_id, claim_secret_hash FROM partners WHERE id = ${second.partnerId}::uuid`
                )
            ).rows
        ).toEqual([{ owner_user_id: null, claim_secret_hash: hash }]);
        const recovered = await claim(d.id, second.partnerId, secret);
        expect(recovered.status).toBe(200);
    });

    it('(e) TEST:V7:7 refuses an unverified account with a different mailbox before writing', async () => {
        const actor = await createOwner();
        users.push(actor.id);
        await getDb().execute(
            sql`UPDATE users SET email_verified = false WHERE id = ${actor.id}::uuid`
        );
        const applicationEmail = createApplicationEmail();
        emails.push(applicationEmail);
        const fixture = await insertClaimablePartner({
            email: applicationEmail,
            hash,
            actorId: actor.id
        });
        partnerIds.push(fixture.partnerId);
        applicationIds.push(fixture.applicationId);
        const response = await claim(actor.id, fixture.partnerId, secret);
        expect(response.status).toBe(403);
        expect((await response.json()).error.reason).toBe('EMAIL_NOT_VERIFIED');
        expect(
            (
                await getDb().execute(
                    sql`SELECT owner_user_id, claim_secret_hash FROM partners WHERE id = ${fixture.partnerId}::uuid`
                )
            ).rows
        ).toEqual([{ owner_user_id: null, claim_secret_hash: hash }]);
    });
});
