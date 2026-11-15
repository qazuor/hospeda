import { createHash, randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import { createApplicationEmail, insertClaimablePartner } from './partner-application.helpers';

/**
 * TEST:V7:7 and TEST:V7:9 exercise ownership, opaque failures, and one-use claim behavior.
 * HOS-2222: only the account of the approved application's email may claim.
 */
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

    async function readClaimState(partnerId: string, claimantId: string) {
        const partner = await getDb().execute(
            sql`SELECT owner_user_id, claim_secret_hash FROM partners WHERE id = ${partnerId}::uuid`
        );
        const events = await getDb().execute(
            sql`SELECT count(*)::integer AS count FROM domain_event WHERE entity_id = ${partnerId} AND event_type = 'partner.claimed'`
        );
        const role = await getDb().execute(
            sql`SELECT role FROM user_role WHERE user_id = ${claimantId}::uuid AND role = 'PARTNER_OWNER'`
        );
        return { partner: partner.rows, events: events.rows, ownerRole: role.rows };
    }

    it('(a) HOS-2222 refuses a verified account whose email differs from the application, leaving the Partner unowned', async () => {
        const mailbox = createApplicationEmail();
        emails.push(mailbox);
        const a = await createOwner({ email: mailbox });
        const b = await createOwner();
        users.push(a.id, b.id);
        const aSessionId = `a-session-${randomUUID()}`;
        await getDb().execute(
            sql`INSERT INTO session (id, token, user_id, expires_at, auth_method) VALUES (${aSessionId}, ${`token-${randomUUID()}`}, ${a.id}::uuid, now() + interval '1 day', 'credential')`
        );
        const fixture = await insertClaimablePartner({ email: mailbox, hash, actorId: b.id });
        partnerIds.push(fixture.partnerId);
        applicationIds.push(fixture.applicationId);

        const refused = await claim(b.id, fixture.partnerId, secret);

        expect(refused.status).toBe(403);
        const body = await refused.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('FORBIDDEN');
        expect(body.error.reason).toBe('PARTNER_CLAIM_EMAIL_MISMATCH');
        expect(JSON.stringify(body)).not.toContain(mailbox);
        expect(await readClaimState(fixture.partnerId, b.id)).toEqual({
            partner: [{ owner_user_id: null, claim_secret_hash: hash }],
            events: [{ count: 0 }],
            ownerRole: []
        });
        expect(
            (await getDb().execute(sql`SELECT id FROM session WHERE user_id = ${a.id}::uuid`)).rows
        ).toEqual([{ id: aSessionId }]);

        const claimed = await claim(a.id, fixture.partnerId, secret);
        expect(claimed.status).toBe(200);
        expect((await claimed.json()).data).toEqual({
            claimed: true,
            partnerId: fixture.partnerId,
            emailVerified: true
        });
        const event = await getDb().execute(
            sql`SELECT actor_id, reason, changes FROM domain_event WHERE entity_id = ${fixture.partnerId} AND event_type = 'partner.claimed'`
        );
        expect(event.rows).toEqual([
            {
                actor_id: a.id,
                reason: 'claim_link',
                changes: [{ field: 'owner_user_id', old: null, new: a.id }]
            }
        ]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT role, grant_reason FROM user_role WHERE user_id = ${a.id}::uuid AND role = 'PARTNER_OWNER'`
                )
            ).rows
        ).toEqual([{ role: 'PARTNER_OWNER', grant_reason: 'partner_claimed' }]);
    });

    it('(a2) HOS-2222 matches the application email case-insensitively', async () => {
        const mailbox = createApplicationEmail();
        emails.push(mailbox);
        const owner = await createOwner({ email: mailbox });
        users.push(owner.id);
        const fixture = await insertClaimablePartner({
            email: mailbox.toUpperCase(),
            hash,
            actorId: owner.id
        });
        partnerIds.push(fixture.partnerId);
        applicationIds.push(fixture.applicationId);

        const response = await claim(owner.id, fixture.partnerId, secret);

        expect(response.status).toBe(200);
        expect(
            (
                await getDb().execute(
                    sql`SELECT owner_user_id FROM partners WHERE id = ${fixture.partnerId}::uuid`
                )
            ).rows
        ).toEqual([{ owner_user_id: owner.id }]);
    });

    it('(a3) HOS-2222 refuses the claim when the Partner has no approved application to compare against', async () => {
        const owner = await createOwner();
        users.push(owner.id);
        const fixture = await insertClaimablePartner({
            email: owner.email,
            hash,
            actorId: owner.id
        });
        partnerIds.push(fixture.partnerId);
        await getDb().execute(
            sql`DELETE FROM partner_application WHERE id = ${fixture.applicationId}::uuid`
        );

        const response = await claim(owner.id, fixture.partnerId, secret);

        expect(response.status).toBe(403);
        expect((await response.json()).error.reason).toBe('PARTNER_CLAIM_EMAIL_MISMATCH');
        expect(await readClaimState(fixture.partnerId, owner.id)).toEqual({
            partner: [{ owner_user_id: null, claim_secret_hash: hash }],
            events: [{ count: 0 }],
            ownerRole: []
        });
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
            email: b.email,
            hash,
            actorId: b.id
        });
        partnerIds.push(fixture.partnerId);
        applicationIds.push(fixture.applicationId);
        expect((await claim(b.id, fixture.partnerId, secret)).status).toBe(200);
        const sameActor = await claim(b.id, fixture.partnerId, secret);
        expect(sameActor.status).toBe(409);
        expect((await sameActor.json()).error.reason).toBe('PARTNER_ALREADY_CLAIMED');
        const repeated = await claim(c.id, fixture.partnerId, secret);
        expect(repeated.status).toBe(409);
        const body = await repeated.json();
        expect(body.error.reason).toBe('PARTNER_ALREADY_CLAIMED');
        expect(JSON.stringify(body)).not.toContain(b.id);
        expect(JSON.stringify(body)).not.toContain(b.email);
        expect(
            (
                await getDb().execute(
                    sql`SELECT count(*)::integer AS count FROM domain_event WHERE entity_id = ${fixture.partnerId} AND event_type = 'partner.claimed'`
                )
            ).rows
        ).toEqual([{ count: 1 }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT role FROM user_role WHERE user_id = ${c.id}::uuid AND role = 'PARTNER_OWNER'`
                )
            ).rows
        ).toEqual([]);
        expect((await claim(c.id, fixture.partnerId, `wrong-${randomUUID()}`)).status).toBe(404);
    });

    it('(d) TEST:V7:7 refuses a second Partner without spending its link, which stays claimable', async () => {
        const b = await createOwner();
        users.push(b.id);
        const first = await insertClaimablePartner({
            email: createApplicationEmail(),
            hash: `1`.repeat(64),
            actorId: b.id
        });
        const second = await insertClaimablePartner({
            email: b.email,
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
        await getDb().execute(
            sql`UPDATE partners SET owner_user_id = NULL WHERE id = ${first.partnerId}::uuid`
        );
        const recovered = await claim(b.id, second.partnerId, secret);
        expect(recovered.status).toBe(200);
    });

    it('(e) TEST:V7:7 + HOS-2222 refuses an unverified account with a different mailbox before writing', async () => {
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
        expect((await response.json()).error.reason).toBe('PARTNER_CLAIM_EMAIL_MISMATCH');
        expect(await readClaimState(fixture.partnerId, actor.id)).toEqual({
            partner: [{ owner_user_id: null, claim_secret_hash: hash }],
            events: [{ count: 0 }],
            ownerRole: []
        });
        expect(
            (
                await getDb().execute(
                    sql`SELECT email_verified FROM users WHERE id = ${actor.id}::uuid`
                )
            ).rows
        ).toEqual([{ email_verified: false }]);
    });
});
