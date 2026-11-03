/** TEST:V7:4 and TEST:V7:5 — partner application mail delivery through the shared outbox. */
import { createHash, randomUUID } from 'node:crypto';
import { domainEventModel, emailOutboxModel, getDb, notificationLogModel, sql } from '@repo/db';
import { trans } from '@repo/i18n';
import { type EmailTransport, processEmailOutboxBatch } from '@repo/notifications';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { buildOutboxSenderRender } from '../../../src/cron/jobs/email-outbox-sender.job';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import {
    createApplicationEmail,
    deleteApplications,
    deletePartners,
    insertPending,
    readPartner
} from './partner-application.helpers';

const app = initApp();
const CLAIM = 'verticals.partner-claim-notice';
const REASON = 'private admin reason';
const BODY = { reason: REASON, name: 'HOS1485 Mail Partner', type: 'business' } as const;
const permissions = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_RESOLVE_APPLICATION];
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
    const user = await createOwner(value ? { email: value } : {});
    userIds.push(user.id);
    return user.id;
}

async function pending(address: string): Promise<string> {
    const id = await insertPending({ email: address });
    applicationIds.push(id);
    return id;
}

async function resolve(input: {
    readonly action: 'approve' | 'reject';
    readonly id: string;
    readonly actorId: string;
    readonly body: Record<string, unknown>;
}) {
    const response = await app.request(
        `/api/v1/admin/partner-applications/${input.id}/${input.action}`,
        {
            method: 'POST',
            headers: actorHeaders({ id: input.actorId, role: RoleEnum.ADMIN, permissions }),
            body: JSON.stringify(input.body)
        }
    );
    return { status: response.status, body: await response.json() };
}

async function ownOutbox(address: string) {
    const result = await getDb().execute(sql`
        SELECT id, template, recipient_email, recipient_user_id, correlation_id, payload, status, last_error, dedup_key
        FROM email_outbox WHERE lower(recipient_email) = lower(${address})
        ORDER BY created_at, id`);
    return result.rows;
}

async function sendBatch(send: EmailTransport['send']) {
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
        owner: `hos1485-${randomUUID()}`,
        now: new Date(),
        leaseMs: 300_000,
        batchSize: 1000
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    // Preserve the addresses before cleanup drains the collection.
    const ownedEmails = [...emails];
    const outboxIds = await getDb().execute(sql`
        SELECT id FROM email_outbox WHERE lower(recipient_email) = ANY(${sql.param(ownedEmails.map((value) => value.toLowerCase()))}::text[])`);
    const ids = outboxIds.rows.map((row) => String(row.id));
    if (ids.length > 0) {
        await getDb().execute(
            sql`DELETE FROM notification_log WHERE metadata->>'outboxId' = ANY(${sql.param(ids)}::text[])`
        );
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE id = ANY(${sql.param(ids)}::uuid[])`
        );
    }
    for (const address of emails.splice(0)) await deleteApplications({ email: address });
    await deletePartners({ ids: partnerIds.splice(0) });
    for (const id of userIds.splice(0)) {
        await getDb().execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
    applicationIds.splice(0);
    vi.restoreAllMocks();
});
afterAll(async () => testDb.teardown());

describe('TEST:V7:4 and TEST:V7:5 partner application mail outbox', () => {
    it('(a), (b) enqueues for an existing account and writes only the hash during real rendering', async () => {
        const address = email();
        const actorId = await admin();
        const recipient = await admin(address);
        const id = await pending(address);
        const response = await resolve({ action: 'approve', id, actorId, body: BODY });
        expect(response.status).toBe(200);
        const partnerId = (response.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(partnerId);
        const event = await getDb().execute(sql`
            SELECT correlation_id FROM domain_event WHERE event_type = 'partner_application.approved' AND entity_id = ${id}`);
        expect(event.rows).toHaveLength(1);
        const queued = await ownOutbox(address);
        expect(queued).toHaveLength(1);
        const row = queued[0] as Record<string, unknown>;
        expect(row).toEqual({
            id: row.id,
            template: CLAIM,
            recipient_email: address,
            recipient_user_id: null,
            correlation_id: event.rows[0]?.correlation_id,
            payload: { partnerId, partnerName: BODY.name, locale: 'es' },
            status: 'pending',
            last_error: null,
            dedup_key: row.dedup_key
        });
        expect((await readPartner({ id: partnerId }))?.claim_secret_hash).toBeNull();
        const delivered: Array<{
            readonly to: string;
            readonly subject: string;
            readonly html: string;
        }> = [];
        await sendBatch(async (mail) => {
            delivered.push({
                to: mail.to,
                subject: mail.subject,
                html: renderToStaticMarkup(mail.react)
            });
            return { messageId: `message-${randomUUID()}` };
        });
        const sent = (await ownOutbox(address))[0] as Record<string, unknown>;
        expect(sent.status).toBe('sent');
        const html = delivered.find((mail) => mail.to === address)?.html ?? '';
        const match = html.match(
            /https:\/\/hospeda\.test\/es\/partners\/reclamar\/#partner=[^&]+&amp;secret=([^"&]+)/
        );
        expect(match).not.toBeNull();
        const secret = decodeURIComponent(match?.[1] ?? '');
        const expectedHash = createHash('sha256').update(secret, 'utf8').digest('hex');
        expect((await readPartner({ id: partnerId }))?.claim_secret_hash).toBe(expectedHash);
        expect(html).toContain(`partner=${partnerId}&amp;secret=`);
        const logs = await getDb().execute(
            sql`SELECT * FROM notification_log WHERE metadata->>'outboxId' = ${sent.id}`
        );
        expect(logs.rows).toHaveLength(1);
        const events = await getDb().execute(sql`
            SELECT * FROM domain_event WHERE entity_id IN (${id}, ${partnerId})`);
        expect(events.rows.length).toBeGreaterThan(0);
        expect(JSON.stringify(sent)).not.toContain(secret);
        expect(JSON.stringify(logs.rows)).not.toContain(secret);
        expect(JSON.stringify(events.rows)).not.toContain(secret);
        expect((await readPartner({ id: partnerId }))?.owner_user_id).toBeNull();
        const role = await getDb().execute(
            sql`SELECT 1 FROM user_role WHERE user_id = ${recipient}::uuid AND role = 'PARTNER_OWNER'`
        );
        expect(role.rows).toEqual([]);
    });

    it('(c) creates a new secret on retry and invalidates the previous render', async () => {
        const address = email();
        const actorId = await admin();
        await admin(address);
        const id = await pending(address);
        const response = await resolve({ action: 'approve', id, actorId, body: BODY });
        const partnerId = (response.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(partnerId);
        let firstSecret = '';
        await sendBatch(async (mail) => {
            const html = renderToStaticMarkup(mail.react);
            firstSecret = decodeURIComponent(html.match(/&amp;secret=([^"&]+)/)?.[1] ?? '');
            throw new Error('transport unavailable');
        });
        const afterFirst = (await ownOutbox(address))[0] as Record<string, unknown>;
        expect(afterFirst.status).toBe('retry');
        const firstHash = (await readPartner({ id: partnerId }))?.claim_secret_hash;
        expect(firstHash).toBe(createHash('sha256').update(firstSecret, 'utf8').digest('hex'));
        let secondSecret = '';
        await sendBatch(async (mail) => {
            const html = renderToStaticMarkup(mail.react);
            secondSecret = decodeURIComponent(html.match(/&amp;secret=([^"&]+)/)?.[1] ?? '');
            return { messageId: `message-${randomUUID()}` };
        });
        const afterSecond = (await ownOutbox(address))[0] as Record<string, unknown>;
        expect(afterSecond.status).toBe('sent');
        const currentHash = (await readPartner({ id: partnerId }))?.claim_secret_hash;
        expect(currentHash).toBe(createHash('sha256').update(secondSecret, 'utf8').digest('hex'));
        expect(createHash('sha256').update(firstSecret, 'utf8').digest('hex')).not.toBe(
            currentHash
        );
    });

    it('(d) does not enqueue a claim notice in the no-account branch', async () => {
        const address = email();
        const actorId = await admin();
        const id = await pending(address);
        const response = await resolve({ action: 'approve', id, actorId, body: BODY });
        const partnerId = (response.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(partnerId);
        const event = await getDb().execute(sql`
            SELECT changes FROM domain_event WHERE entity_id = ${id} AND event_type = 'partner_application.approved'`);
        expect(event.rows).toHaveLength(1);
        expect(JSON.stringify(event.rows[0]?.changes)).toContain('claim_account_user_id');
        expect(await ownOutbox(address)).toEqual([]);
    });

    it('(e) does not overwrite a claim hash for a Partner that already has an owner', async () => {
        const address = email();
        const actorId = await admin();
        const recipient = await admin(address);
        const id = await pending(address);
        const response = await resolve({ action: 'approve', id, actorId, body: BODY });
        const partnerId = (response.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(partnerId);
        const knownHash = 'known-hash';
        await getDb().execute(
            sql`UPDATE partners SET owner_user_id = ${recipient}::uuid, claim_secret_hash = ${knownHash} WHERE id = ${partnerId}::uuid`
        );
        const send = vi.fn<EmailTransport['send']>(async () => ({ messageId: 'not-sent' }));
        await sendBatch(send);
        expect(send).not.toHaveBeenCalled();
        const row = (await ownOutbox(address))[0] as Record<string, unknown>;
        expect(row.status).toBe('retry');
        expect(String(row.last_error)).toContain(partnerId);
        expect(String(row.last_error)).not.toContain(knownHash);
        expect((await readPartner({ id: partnerId }))?.claim_secret_hash).toBe(knownHash);
    });

    it('(f) queues rejection with the stored PLAZO:9 date and sends no admin reason', async () => {
        const address = email();
        const actorId = await admin();
        const id = await pending(address);
        const response = await resolve({ action: 'reject', id, actorId, body: { reason: REASON } });
        expect(response.status).toBe(200);
        const application = await getDb().execute(sql`
            SELECT pa.resolved_at, pa.deadlines_version, (v."values" -> '9' ->> 'days')::integer AS days
            FROM partner_application pa JOIN vertical_deadline_version v ON v.version = pa.deadlines_version
            WHERE pa.id = ${id}::uuid`);
        expect(application.rows).toHaveLength(1);
        const saved = application.rows[0] as { resolved_at: Date | string; days: number };
        const expected = new Date(
            Date.parse(String(saved.resolved_at)) + Number(saved.days) * 86_400_000
        ).toISOString();
        const queued = await ownOutbox(address);
        expect(queued).toHaveLength(1);
        const row = queued[0] as Record<string, unknown>;
        expect(row.recipient_user_id).toBeNull();
        expect(row.payload).toEqual({ applicationId: id, reapplyAfter: expected, locale: 'es' });
        expect(JSON.stringify(row.payload)).not.toContain(REASON);
        const sent: string[] = [];
        await sendBatch(async (mail) => {
            sent.push(renderToStaticMarkup(mail.react));
            return { messageId: `message-${randomUUID()}` };
        });
        expect((await ownOutbox(address))[0]?.status).toBe('sent');
        const html = sent.find((value) => value.includes('Revisamos tu postulación')) ?? '';
        expect(html).toContain(
            new Intl.DateTimeFormat('es-AR', {
                dateStyle: 'long',
                timeZone: 'America/Argentina/Buenos_Aires'
            }).format(new Date(expected))
        );
        expect(html).not.toContain(REASON);
    });

    it('(g) takes the claim notice locale and subject from the existing account', async () => {
        const address = email();
        const actorId = await admin();
        const recipient = await admin(address);
        await getDb().execute(
            sql`UPDATE users SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{languageWeb}', '"en"') WHERE id = ${recipient}::uuid`
        );
        const id = await pending(address);
        const response = await resolve({ action: 'approve', id, actorId, body: BODY });
        const partnerId = (response.body as { data: { partnerId: string } }).data.partnerId;
        partnerIds.push(partnerId);
        expect((await ownOutbox(address))[0]?.payload).toEqual({
            partnerId,
            partnerName: BODY.name,
            locale: 'en'
        });
        const subjects: string[] = [];
        await sendBatch(async (mail) => {
            subjects.push(mail.subject);
            return { messageId: `message-${randomUUID()}` };
        });
        expect(subjects).toContain(
            trans.en['notifications.partnerApplication.claimNotice.subject']
        );
    });

    it('(h) rolls back each outbox enqueue when its domain event fails', async () => {
        for (const action of ['approve', 'reject'] as const) {
            const address = email();
            const actorId = await admin();
            if (action === 'approve') await admin(address);
            const id = await pending(address);
            const originalInsert = domainEventModel.insert.bind(domainEventModel);
            const insertSpy = vi
                .spyOn(domainEventModel, 'insert')
                .mockImplementation(async (args) => {
                    if (
                        args.eventType ===
                        `partner_application.${action === 'approve' ? 'approved' : 'rejected'}`
                    ) {
                        throw new Error('event failure');
                    }
                    return originalInsert(args);
                });
            const enqueueSpy = vi.spyOn(emailOutboxModel, 'enqueue');
            const result = await resolve({
                action,
                id,
                actorId,
                body: action === 'approve' ? BODY : { reason: REASON }
            });
            expect(result.status).toBe(500);
            expect(enqueueSpy).toHaveBeenCalledTimes(1);
            expect(await ownOutbox(address)).toEqual([]);
            const state = await getDb().execute(
                sql`SELECT status, partner_id FROM partner_application WHERE id = ${id}::uuid`
            );
            expect(state.rows).toEqual([{ status: 'PENDING', partner_id: null }]);
            if (action === 'approve') {
                const partners = await getDb().execute(
                    sql`SELECT id FROM partners WHERE created_by_id = ${actorId}::uuid AND name = ${BODY.name}`
                );
                expect(partners.rows).toEqual([]);
            }
            insertSpy.mockRestore();
            enqueueSpy.mockRestore();
        }
    });
});
