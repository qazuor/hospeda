/**
 * TEST:U2:14 (HOS-1627, AC:U2:12) — a real `hard_bounce` event enters through
 * the Brevo webhook route, with its token, and becomes ONE `bounced` row of
 * `notification_log` for the address even when Brevo delivers it twice. After
 * that, the email outbox sender suppresses the next mail to the address, a
 * transactional one and a commercial one, without calling the transport.
 *
 * Real PostgreSQL (the ephemeral DB of `global-setup.ts`), the real app, the
 * real models and the real `processEmailOutboxBatch`. Only the transport and
 * the reporting hooks are fakes, because what is asserted is that the
 * transport is never reached.
 *
 * Mutation: removing the mapping from the hard-bounce event to the `bounced`
 * row in `apps/api/src/routes/webhooks/brevo.ts` turns the bounce cases red.
 *
 * Also covers the route's two failure modes: a failed write answers 503
 * without forwarding that event to the newsletter tracker (removing the 503
 * branch turns it red), and a poison `hard_bounce` (invalid fields) is logged
 * and skipped with 200 (removing the skip turns it red).
 */

import {
    buildEmailDedupKey,
    emailOutbox,
    emailOutboxModel,
    notificationLog,
    notificationLogModel
} from '@repo/db';
import {
    type EmailTransport,
    NotificationType,
    OUTBOX_LAST_ERROR_MARKERS,
    processEmailOutboxBatch
} from '@repo/notifications';
import { NewsletterTrackingService } from '@repo/service-core';
import { inArray, sql } from 'drizzle-orm';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

/** Path token of this run; the route matches it against the configured value. */
const TOKEN = `u2-12-${crypto.randomUUID()}`;
const WEBHOOK_PATH = `/api/v1/public/webhooks/brevo/${TOKEN}`;
const HEADERS = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    accept: 'application/json'
} as const;

const createdRecipients: string[] = [];
const createdDedupKeys: string[] = [];

function newRecipient(): string {
    const address = `u2-12-${crypto.randomUUID()}@example.com`;
    createdRecipients.push(address);
    return address;
}

/** Brevo's transactional `hard_bounce` payload (developers.brevo.com, transactional webhooks). */
function hardBounceEvent(input: { readonly email: string; readonly messageId?: string }) {
    return {
        event: 'hard_bounce',
        email: input.email,
        id: 12345,
        date: '2026-10-07 12:00:00',
        ts: 1791374400,
        ...(input.messageId ? { 'message-id': input.messageId } : {}),
        ts_event: 1791374410,
        subject: 'Welcome',
        tags: ['notification_type:welcome'],
        reason: 'mailbox does not exist',
        ts_epoch: 1791374410000
    };
}

function postEvent(app: ReturnType<typeof initApp>, body: unknown, path = WEBHOOK_PATH) {
    return app.request(path, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
}

async function bouncedRowsOf(recipient: string) {
    return testDb
        .getDb()
        .select()
        .from(notificationLog)
        .where(
            sql`lower(${notificationLog.recipient}) = lower(${recipient}) and ${notificationLog.status} = 'bounced'`
        );
}

async function enqueue(input: { readonly recipient: string; readonly template: string }) {
    const dedupKey = buildEmailDedupKey({
        recipient: input.recipient,
        template: input.template,
        occurrence: `event:${crypto.randomUUID()}`
    });
    createdDedupKeys.push(dedupKey);
    const { row } = await emailOutboxModel.enqueue({
        recipientEmail: input.recipient,
        recipientUserId: null,
        template: input.template,
        dedupKey
    });
    if (!row) throw new Error('enqueue wrote no row');
    return row;
}

describe('TEST:U2:14 a Brevo hard bounce suppresses every later mail to the address', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        process.env.HOSPEDA_BREVO_WEBHOOK_SECRET = TOKEN;
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        const db = testDb.getDb();
        if (createdRecipients.length > 0) {
            const lowered = createdRecipients.map((r) => sql`${r.toLowerCase()}`);
            await db
                .delete(notificationLog)
                .where(sql`lower(${notificationLog.recipient}) in (${sql.join(lowered, sql`, `)})`);
            createdRecipients.length = 0;
        }
        if (createdDedupKeys.length > 0) {
            await db.delete(emailOutbox).where(inArray(emailOutbox.dedupKey, createdDedupKeys));
            createdDedupKeys.length = 0;
        }
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('records ONE bounced row even when Brevo delivers the same event twice', async () => {
        // Arrange
        const recipient = newRecipient();
        const event = hardBounceEvent({ email: recipient, messageId: '<u2-12-a@relay.brevo>' });

        // Act: the same event, single and then inside a batch array
        const first = await postEvent(app, event);
        const second = await postEvent(app, [event]);

        // Assert
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        const rows = await bouncedRowsOf(recipient);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            recipient,
            channel: 'email',
            status: 'bounced',
            errorMessage: 'mailbox does not exist'
        });
        expect(rows[0]?.metadata).toMatchObject({
            source: 'provider_webhook',
            provider: 'brevo',
            messageId: '<u2-12-a@relay.brevo>'
        });
        expect(await notificationLogModel.hasHardBounce({ recipient })).toBe(true);
    });

    it('records ONE bounced row for a redelivered event without message-id, whatever the casing', async () => {
        // Arrange: the key falls back to the lower-cased address
        const recipient = newRecipient();

        // Act: the two deliveries spell the address differently
        const first = await postEvent(app, hardBounceEvent({ email: recipient.toUpperCase() }));
        const second = await postEvent(app, hardBounceEvent({ email: recipient }));

        // Assert
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(await bouncedRowsOf(recipient)).toHaveLength(1);
    });

    it('answers 503 when the bounce write fails, writes nothing and does NOT forward that event to the newsletter tracker', async () => {
        // Arrange
        const recipient = newRecipient();
        vi.spyOn(notificationLogModel, 'recordProviderHardBounce').mockRejectedValueOnce(
            new Error('connection terminated')
        );
        const tracker = vi.spyOn(NewsletterTrackingService.prototype, 'processBrevoWebhookEvent');

        // Act
        const res = await postEvent(app, [
            hardBounceEvent({ email: recipient, messageId: 'm-503' })
        ]);

        // Assert
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: 'service_unavailable' });
        expect(tracker).not.toHaveBeenCalled();
        expect(await bouncedRowsOf(recipient)).toHaveLength(0);
    });

    it.each([
        ['a malformed address', () => 'not-an-email', 'm-bad-1'],
        [
            'an address longer than the recipient column',
            () => `x@${Array.from({ length: 5 }, () => 'a'.repeat(60)).join('.')}.com`,
            'm-bad-2'
        ],
        ['an oversized message-id', () => newRecipient(), 'm'.repeat(600)]
    ])('logs and skips a poison hard_bounce with %s: 200, no row, not forwarded', async (_label, makeEmail, messageId) => {
        // Arrange
        const email = makeEmail();
        createdRecipients.push(email);
        const tracker = vi.spyOn(NewsletterTrackingService.prototype, 'processBrevoWebhookEvent');

        // Act
        const res = await postEvent(app, hardBounceEvent({ email, messageId }));

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as { readonly data: unknown };
        expect(body.data).toEqual({ ok: true, processed: 0, skipped: 1 });
        expect(tracker).not.toHaveBeenCalled();
        expect(await bouncedRowsOf(email)).toHaveLength(0);
    });

    it('rejects an event without the webhook token and writes nothing', async () => {
        // Arrange
        const recipient = newRecipient();

        // Act
        const res = await postEvent(
            app,
            hardBounceEvent({ email: recipient, messageId: 'm' }),
            '/api/v1/public/webhooks/brevo/not-the-token'
        );

        // Assert
        expect(res.status).toBe(401);
        expect(await bouncedRowsOf(recipient)).toHaveLength(0);
    });

    it('then suppresses the next transactional AND commercial mail without calling the transport', async () => {
        // Arrange: the bounce arrives through the webhook
        const recipient = newRecipient();
        const res = await postEvent(
            app,
            hardBounceEvent({ email: recipient, messageId: '<u2-12-b@relay.brevo>' })
        );
        expect(res.status).toBe(200);
        const transactional = await enqueue({ recipient, template: 'welcome' });
        const commercial = await enqueue({
            recipient,
            template: NotificationType.TRIAL_WIN_BACK_5D
        });
        const send = vi.fn<EmailTransport['send']>();
        const escalate = vi.fn();

        // Act
        const result = await processEmailOutboxBatch({
            deps: {
                outbox: emailOutboxModel,
                log: notificationLogModel,
                isOptedOut: async () => false,
                render: () => ({ subject: 's', react: {} as ReactElement }),
                transport: { send },
                escalate,
                onRowError: vi.fn(),
                onLeaseLost: vi.fn()
            },
            owner: 'u2-12-it',
            now: new Date(),
            leaseMs: 300_000,
            batchSize: 1000
        });

        // Assert
        expect(send).not.toHaveBeenCalled();
        expect(result.suppressed).toBeGreaterThanOrEqual(2);
        const rows = await testDb
            .getDb()
            .select()
            .from(emailOutbox)
            .where(inArray(emailOutbox.id, [transactional.id, commercial.id]));
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row.status).toBe('failed');
            expect(row.lastError).toBe(OUTBOX_LAST_ERROR_MARKERS.HARD_BOUNCE);
        }
        // The obligatory one is escalated as undeliverable (AC:U2:4); the commercial one is not.
        expect(escalate).toHaveBeenCalledWith(
            expect.objectContaining({ outboxId: transactional.id, reason: 'hard_bounce' })
        );
        expect(escalate).not.toHaveBeenCalledWith(
            expect.objectContaining({ outboxId: commercial.id })
        );
    });
});
