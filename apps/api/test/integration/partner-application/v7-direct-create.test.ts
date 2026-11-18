import { createHash, randomUUID } from 'node:crypto';
import { emailOutboxModel, getDb, notificationLogModel, sql } from '@repo/db';
import { type EmailTransport, processEmailOutboxBatch } from '@repo/notifications';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { buildOutboxSenderRender } from '../../../src/cron/jobs/email-outbox-sender.job';
import { claimPartnerByLink } from '../../../src/services/partner-application/partner-link-claim.service';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import {
    createApplicationEmail,
    ensureTestPartnerType,
    TEST_BUSINESS_PARTNER_TYPE_ID
} from './partner-application.helpers';

const app = initApp();
const CLAIM = 'verticals.partner-claim-notice';
const emails: string[] = [];
const partnerIds: string[] = [];
const userIds: string[] = [];
const partnerNames: string[] = [];

function email(): string {
    const value = createApplicationEmail();
    emails.push(value);
    return value;
}

async function admin(): Promise<string> {
    const owner = await createOwner();
    userIds.push(owner.id);
    return owner.id;
}

async function createDirect(input: { readonly name: string; readonly claimEmail?: string }) {
    const id = await admin();
    const response = await app.request('/api/v1/admin/partners', {
        method: 'POST',
        headers: actorHeaders({
            id,
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_MANAGE]
        }),
        body: JSON.stringify({
            ...input,
            slug: input.name.toLowerCase().replaceAll(' ', '-'),
            typeId: TEST_BUSINESS_PARTNER_TYPE_ID,
            lifecycleState: 'ACTIVE'
        })
    });
    const body = await response.json();
    return { response, body };
}

async function rowsForEmail(address: string) {
    return getDb().execute(sql`
        SELECT id, template, recipient_email, recipient_user_id, correlation_id, payload,
               status, last_error, dedup_key
        FROM email_outbox WHERE lower(recipient_email) = lower(${address}) ORDER BY created_at, id`);
}

async function sendBatch(send: EmailTransport['send']): Promise<void> {
    await processEmailOutboxBatch({
        deps: {
            outbox: emailOutboxModel,
            log: notificationLogModel,
            isOptedOut: async () => false,
            render: buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' }),
            transport: { send },
            escalate: vi.fn(),
            onRowError: vi.fn(),
            onRetry: vi.fn(),
            onLeaseLost: vi.fn()
        },
        owner: `hos1487-${randomUUID()}`,
        now: new Date(),
        leaseMs: 300_000,
        batchSize: 1000
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    await ensureTestPartnerType();
});

afterEach(async () => {
    const addresses = emails.splice(0).map((value) => value.toLowerCase());
    if (addresses.length > 0) {
        const outbox = await getDb().execute(sql`
            SELECT id FROM email_outbox WHERE lower(recipient_email) = ANY(${sql.param(addresses)}::text[])`);
        const ids = outbox.rows.map((row) => String(row.id));
        if (ids.length > 0) {
            await getDb().execute(sql`
                DELETE FROM notification_log WHERE metadata->>'outboxId' = ANY(${sql.param(ids)}::text[])`);
            await getDb().execute(sql`
                DELETE FROM email_outbox WHERE id = ANY(${sql.param(ids)}::uuid[])`);
        }
    }
    for (const id of partnerIds.splice(0)) {
        await getDb().execute(sql`DELETE FROM partner_application WHERE partner_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM partners WHERE id = ${id}::uuid`);
    }
    for (const id of userIds.splice(0)) {
        await getDb().execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM session WHERE user_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
    partnerNames.splice(0);
    vi.restoreAllMocks();
});

afterAll(async () => testDb.teardown());

describe('TEST:V7:11 AC:V7:11 admin direct Partner creation', () => {
    it('(a) queues a claim for an existing verified mailbox without assigning it a role or owner', async () => {
        const address = email();
        const recipient = await createOwner({ email: address });
        userIds.push(recipient.id);
        await getDb().execute(sql`
            INSERT INTO account (id, account_id, provider_id, user_id)
            VALUES (${`account-${randomUUID()}`}, ${recipient.id}, 'credential', ${recipient.id}::uuid)`);
        await getDb().execute(sql`
            INSERT INTO user_role (user_id, role, grant_reason)
            VALUES (${recipient.id}::uuid, 'USER', 'test-fixture')`);
        const beforeRoles = await getDb().execute(sql`
            SELECT role, grant_reason FROM user_role WHERE user_id = ${recipient.id}::uuid ORDER BY role`);
        expect(beforeRoles.rows).toEqual([{ role: 'USER', grant_reason: 'test-fixture' }]);
        const totalBefore = await getDb().execute(sql`
            SELECT count(*)::int AS count FROM user_role WHERE role = 'PARTNER_OWNER'`);
        const name = `HOS1487 Direct ${randomUUID()}`;
        partnerNames.push(name);
        const { response, body } = await createDirect({ name, claimEmail: address });
        expect(response.status).toBe(201);
        expect(body.data.id).toBeTruthy();
        const partnerId = String(body.data.id);
        partnerIds.push(partnerId);
        expect(body.data).not.toHaveProperty('claimEmail');
        expect(JSON.stringify(body)).not.toContain(address);
        const partner = await getDb().execute(sql`
            SELECT owner_user_id, claim_secret_hash FROM partners WHERE id = ${partnerId}::uuid`);
        expect(partner.rows).toEqual([{ owner_user_id: null, claim_secret_hash: null }]);
        const applications = await getDb().execute(sql`
            SELECT id FROM partner_application WHERE partner_id = ${partnerId}::uuid`);
        expect(applications.rows).toEqual([]);
        const afterRoles = await getDb().execute(sql`
            SELECT role, grant_reason FROM user_role WHERE user_id = ${recipient.id}::uuid ORDER BY role`);
        expect(afterRoles.rows).toEqual(beforeRoles.rows);
        const totalAfter = await getDb().execute(sql`
            SELECT count(*)::int AS count FROM user_role WHERE role = 'PARTNER_OWNER'`);
        expect(totalAfter.rows).toEqual(totalBefore.rows);
        const queued = await rowsForEmail(address);
        expect(queued.rows).toHaveLength(1);
        const row = queued.rows[0] as Record<string, unknown>;
        expect(row).toEqual({
            id: row.id,
            template: CLAIM,
            recipient_email: address,
            recipient_user_id: null,
            correlation_id: expect.any(String),
            payload: { partnerId, partnerName: name, locale: 'es', origin: 'direct' },
            status: 'pending',
            last_error: null,
            dedup_key: row.dedup_key
        });
        expect(row.correlation_id).toBeTruthy();
    });

    it('(b) queues a claim notice when no account owns the address', async () => {
        const address = email();
        const name = `HOS1487 No Account ${randomUUID()}`;
        partnerNames.push(name);
        const { response, body } = await createDirect({ name, claimEmail: address });
        expect(response.status).toBe(201);
        expect(body.data.id).toBeTruthy();
        const partnerId = String(body.data.id);
        partnerIds.push(partnerId);
        expect(body.data).not.toHaveProperty('claimEmail');
        const partner = await getDb().execute(sql`
            SELECT owner_user_id, claim_secret_hash FROM partners WHERE id = ${partnerId}::uuid`);
        expect(partner.rows).toEqual([{ owner_user_id: null, claim_secret_hash: null }]);
        const queued = await rowsForEmail(address);
        expect(queued.rows).toHaveLength(1);
        const row = queued.rows[0] as Record<string, unknown>;
        expect(row).toEqual({
            id: row.id,
            template: CLAIM,
            recipient_email: address,
            recipient_user_id: null,
            correlation_id: expect.any(String),
            payload: { partnerId, partnerName: name, locale: 'es', origin: 'direct' },
            status: 'pending',
            last_error: null,
            dedup_key: row.dedup_key
        });
        expect(row.correlation_id).toBeTruthy();
    });

    it('(c) rejects a missing or malformed claim email without creating a Partner', async () => {
        for (const claimEmail of [undefined, 'no-es-correo']) {
            const name = `HOS1487 Invalid ${randomUUID()}`;
            partnerNames.push(name);
            const before = await getDb().execute(
                sql`SELECT count(*)::int AS count FROM partners WHERE name = ${name}`
            );
            const { response } = await createDirect({
                name,
                ...(claimEmail ? { claimEmail } : {})
            });
            expect(response.status).toBe(400);
            const after = await getDb().execute(
                sql`SELECT count(*)::int AS count FROM partners WHERE name = ${name}`
            );
            expect(after.rows).toEqual(before.rows);
        }
    });

    it('(d) rolls back the Partner when the outbox enqueue fails', async () => {
        const address = email();
        const name = `HOS1487 Rollback ${randomUUID()}`;
        partnerNames.push(name);
        vi.spyOn(emailOutboxModel, 'enqueue').mockRejectedValueOnce(new Error('outbox down'));
        const { response } = await createDirect({ name, claimEmail: address });
        expect(response.status).toBeGreaterThanOrEqual(500);
        const partners = await getDb().execute(sql`SELECT id FROM partners WHERE name = ${name}`);
        expect(partners.rows).toEqual([]);
        expect(await rowsForEmail(address).then(({ rows }) => rows)).toEqual([]);
    });

    it('(e) HOS-2222 refuses a different-email account and grants the role to the mailbox account that claims the mailed link', async () => {
        const address = email();
        const accountA = await createOwner({ email: address });
        const accountB = await createOwner();
        userIds.push(accountA.id, accountB.id);
        await getDb().execute(sql`
            INSERT INTO user_role (user_id, role, grant_reason)
            VALUES (${accountA.id}::uuid, 'USER', 'test-fixture')`);
        const name = `HOS1487 Claim ${randomUUID()}`;
        partnerNames.push(name);
        const { response, body } = await createDirect({ name, claimEmail: address });
        expect(response.status).toBe(201);
        expect(body.data.id).toBeTruthy();
        const partnerId = String(body.data.id);
        partnerIds.push(partnerId);
        const provisioned = await getDb().execute(sql`
            SELECT claim_email, claim_secret_hash FROM partners WHERE id = ${partnerId}::uuid`);
        expect(provisioned.rows).toEqual([{ claim_email: address, claim_secret_hash: null }]);
        let renderedHtml = '';
        await sendBatch(async (mail) => {
            renderedHtml = renderToStaticMarkup(mail.react);
            return { messageId: `message-${randomUUID()}` };
        });
        const match = renderedHtml.match(
            /https:\/\/hospeda\.test\/es\/partners\/reclamar\/#partner=[^&]+&amp;secret=([^"&]+)/
        );
        expect(match).not.toBeNull();
        const secret = decodeURIComponent(match?.[1] ?? '');
        expect(secret).not.toBe('');
        const outbox = await rowsForEmail(address);
        expect(outbox.rows).toHaveLength(1);
        expect((outbox.rows[0] as Record<string, unknown>).status).toBe('sent');
        const stored = await getDb().execute(sql`
            SELECT claim_email, owner_user_id FROM partners WHERE id = ${partnerId}::uuid`);
        expect(stored.rows).toEqual([{ claim_email: address, owner_user_id: null }]);
        const claimAs = (actorId: string) =>
            app.request('/api/v1/protected/partner-claims', {
                method: 'POST',
                headers: actorHeaders({ id: actorId, role: RoleEnum.HOST }),
                body: JSON.stringify({ partnerId, secret })
            });
        const refused = await claimAs(accountB.id);
        expect(refused.status).toBe(403);
        const refusedBody = await refused.json();
        expect(refusedBody.error.code).toBe('FORBIDDEN');
        expect(refusedBody.error.reason).toBe('PARTNER_CLAIM_EMAIL_MISMATCH');
        expect(JSON.stringify(refusedBody)).not.toContain(address);
        const unowned = await getDb().execute(sql`
            SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`);
        expect(unowned.rows).toEqual([{ owner_user_id: null }]);
        const refusedRoleB = await getDb().execute(sql`
            SELECT role FROM user_role WHERE user_id = ${accountB.id}::uuid AND role = 'PARTNER_OWNER'`);
        expect(refusedRoleB.rows).toEqual([]);
        const responseClaim = await claimAs(accountA.id);
        expect(responseClaim.status).toBe(200);
        const owner = await getDb().execute(sql`
            SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`);
        expect(owner.rows).toEqual([{ owner_user_id: accountA.id }]);
        const roleA = await getDb().execute(sql`
            SELECT role, grant_reason FROM user_role WHERE user_id = ${accountA.id}::uuid AND role = 'PARTNER_OWNER'`);
        expect(roleA.rows).toEqual([{ role: 'PARTNER_OWNER', grant_reason: 'partner_claimed' }]);
        const roleB = await getDb().execute(sql`
            SELECT role FROM user_role WHERE user_id = ${accountB.id}::uuid AND role = 'PARTNER_OWNER'`);
        expect(roleB.rows).toEqual([]);
        expect(createHash('sha256').update(secret, 'utf8').digest('hex')).toBeTruthy();
        expect(JSON.stringify(body)).not.toContain(address);
    });

    it('(f) HOS-2222 lets an unverified mailbox account claim a directly created Partner, verifying it and revoking its other sessions', async () => {
        // Arrange
        const address = email();
        const account = await createOwner({ email: address });
        userIds.push(account.id);
        await getDb().execute(
            sql`UPDATE users SET email_verified = false WHERE id = ${account.id}::uuid`
        );
        const sessionId = `claim-session-${randomUUID()}`;
        const otherSessionId = `other-session-${randomUUID()}`;
        await getDb().execute(sql`
            INSERT INTO session (id, token, user_id, expires_at, auth_method) VALUES
                (${sessionId}, ${`token-${randomUUID()}`}, ${account.id}::uuid, now() + interval '1 day', 'credential'),
                (${otherSessionId}, ${`token-${randomUUID()}`}, ${account.id}::uuid, now() + interval '1 day', 'google')`);
        const credentialId = `credential-${randomUUID()}`;
        const googleId = `google-${randomUUID()}`;
        await getDb().execute(sql`
            INSERT INTO account (id, account_id, provider_id, user_id) VALUES
                (${credentialId}, ${account.id}, 'credential', ${account.id}::uuid),
                (${googleId}, 'google-account', 'google', ${account.id}::uuid)`);
        const name = `HOS2222 Unverified ${randomUUID()}`;
        partnerNames.push(name);
        const { response, body } = await createDirect({ name, claimEmail: address });
        expect(response.status).toBe(201);
        const partnerId = String(body.data.id);
        partnerIds.push(partnerId);
        expect(
            (
                await getDb().execute(sql`
                    SELECT count(*)::integer AS count FROM partner_application WHERE partner_id = ${partnerId}::uuid`)
            ).rows
        ).toEqual([{ count: 0 }]);
        let renderedHtml = '';
        await sendBatch(async (mail) => {
            renderedHtml = renderToStaticMarkup(mail.react);
            return { messageId: `message-${randomUUID()}` };
        });
        const match = renderedHtml.match(/#partner=[^&]+&amp;secret=([^"&]+)/);
        const secret = decodeURIComponent(match?.[1] ?? '');
        expect(secret).not.toBe('');

        // Act
        const claimed = await claimPartnerByLink({
            actorUserId: account.id,
            currentSessionId: sessionId,
            partnerId,
            secret
        });

        // Assert
        expect(claimed).toEqual({ claimed: true, partnerId, emailVerified: true });
        expect(
            (
                await getDb().execute(
                    sql`SELECT email_verified FROM users WHERE id = ${account.id}::uuid`
                )
            ).rows
        ).toEqual([{ email_verified: true }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM session WHERE user_id = ${account.id}::uuid ORDER BY id`
                )
            ).rows
        ).toEqual([{ id: sessionId }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM account WHERE user_id = ${account.id}::uuid ORDER BY id`
                )
            ).rows
        ).toEqual([{ id: credentialId }]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`
                )
            ).rows
        ).toEqual([{ owner_user_id: account.id }]);
    });
});
