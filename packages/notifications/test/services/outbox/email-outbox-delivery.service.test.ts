/**
 * Unit tests of the outbox sender batch (HOS-1423).
 *
 * TEST:U2:4 (escalation without blocking), TEST:U2:7 (suppression applied
 * before sending) and TEST:U2:8 (one attempt record per attempt, in the
 * notification log only). The real SQL behind each dependency is proved in
 * `packages/db/test/integration/email-outbox-delivery.integration.test.ts`.
 */
import type { EmailOutboxRow, EmailOutboxStatus, RecordEmailAttemptInput } from '@repo/db';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_OUTBOX_CONSTANTS } from '../../../src/constants/notification.constants';
import {
    createOutboxOptOutReader,
    EmailHardBounceError,
    type EmailOutboxDeliveryDeps,
    OUTBOX_LAST_ERROR_MARKERS,
    type OutboxEscalation,
    processEmailOutboxBatch
} from '../../../src/services/outbox/email-outbox-delivery.service';
import {
    createOutboxMailRenderer,
    OUTBOX_MAIL_RENDERERS
} from '../../../src/services/outbox/email-outbox-renderers';
import { NotificationType } from '../../../src/types/notification.types';

const NOW = new Date('2026-10-07T12:00:00.000Z');
const OWNER = 'email-outbox-sender:test';
const COMMERCIAL = NotificationType.TRIAL_WIN_BACK_5D;
const TRANSACTIONAL = 'subscription-cancel-notice';

function row(overrides: Partial<EmailOutboxRow> = {}): EmailOutboxRow {
    return {
        id: crypto.randomUUID(),
        recipientUserId: crypto.randomUUID(),
        recipientEmail: 'host@example.com',
        template: TRANSACTIONAL,
        channel: 'email',
        payload: {},
        status: 'processing',
        dedupKey: crypto.randomUUID(),
        lockedBy: OWNER,
        lockedUntil: new Date(NOW.getTime() + 300_000),
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        createdAt: new Date(NOW.getTime() - 60_000),
        updatedAt: new Date(NOW.getTime() - 60_000),
        ...overrides
    };
}

interface Harness {
    readonly deps: EmailOutboxDeliveryDeps;
    readonly records: RecordEmailAttemptInput[];
    readonly escalations: OutboxEscalation[];
    readonly send: ReturnType<typeof vi.fn>;
    readonly outbox: {
        readonly recoverExpired: ReturnType<typeof vi.fn>;
        readonly claim: ReturnType<typeof vi.fn>;
        readonly markSent: ReturnType<typeof vi.fn>;
        readonly recordFailure: ReturnType<typeof vi.fn>;
        readonly markFailed: ReturnType<typeof vi.fn>;
        readonly getRecipientDeletedAt: ReturnType<typeof vi.fn>;
    };
    readonly log: {
        readonly hasHardBounce: ReturnType<typeof vi.fn>;
        readonly countSentByClassSince: ReturnType<typeof vi.fn>;
    };
    readonly isOptedOut: ReturnType<typeof vi.fn>;
}

function harness(claimed: EmailOutboxRow[]): Harness {
    const records: RecordEmailAttemptInput[] = [];
    const escalations: OutboxEscalation[] = [];
    const outbox = {
        recoverExpired: vi.fn(async () => []),
        claim: vi.fn(async () => claimed),
        markSent: vi.fn(async () => true),
        recordFailure: vi.fn(
            async (input: { id: string; maxAttempts: number }): Promise<EmailOutboxStatus> => {
                const current = claimed.find((r) => r.id === input.id);
                return (current?.attempts ?? 0) + 1 >= input.maxAttempts ? 'failed' : 'retry';
            }
        ),
        markFailed: vi.fn(async () => true),
        getRecipientDeletedAt: vi.fn(async () => null)
    };
    const log = {
        hasHardBounce: vi.fn(async () => false),
        countSentByClassSince: vi.fn(async () => 0)
    };
    const isOptedOut = vi.fn(async () => false);
    const send = vi.fn(async () => ({ messageId: 'msg-1' }));
    const deps: EmailOutboxDeliveryDeps = {
        outbox,
        log: {
            ...log,
            recordEmailAttempt: vi.fn(async (input: RecordEmailAttemptInput) => {
                records.push(input);
                return {} as never;
            })
        },
        isOptedOut,
        render: async ({ row: r }) => ({
            subject: `Subject of ${r.template}`,
            react: createElement('p', null, 'body')
        }),
        transport: { send },
        escalate: (event) => {
            escalations.push(event);
        }
    };
    return { deps, records, escalations, send, outbox, log, isOptedOut };
}

async function run(h: Harness) {
    return processEmailOutboxBatch({
        deps: h.deps,
        owner: OWNER,
        now: NOW,
        leaseMs: 300_000,
        batchSize: 50
    });
}

describe('processEmailOutboxBatch — the run', () => {
    it('releases expired leases BEFORE claiming, with the run instant', async () => {
        // Arrange
        const h = harness([]);
        h.outbox.recoverExpired.mockResolvedValueOnce(['a', 'b']);

        // Act
        const result = await run(h);

        // Assert
        expect(h.outbox.recoverExpired).toHaveBeenCalledWith({ now: NOW });
        expect(h.outbox.claim).toHaveBeenCalledWith({
            owner: OWNER,
            leaseMs: 300_000,
            limit: 50,
            now: NOW
        });
        expect(h.outbox.recoverExpired.mock.invocationCallOrder[0]).toBeLessThan(
            h.outbox.claim.mock.invocationCallOrder[0] ?? 0
        );
        expect(result).toMatchObject({ recovered: 2, claimed: 0 });
    });

    it('keeps processing the batch when one row throws, and counts it', async () => {
        // Arrange
        const broken = row();
        const fine = row();
        const h = harness([broken, fine]);
        h.log.hasHardBounce.mockRejectedValueOnce(new Error('db down'));

        // Act
        const result = await run(h);

        // Assert
        expect(result).toMatchObject({ claimed: 2, errors: 1, sent: 1 });
    });
});

describe('TEST:U2:8 one attempt record, in notification_log only', () => {
    it('a sent transactional mail leaves exactly one `sent` record and marks the row sent', async () => {
        // Arrange
        const r = row();
        const h = harness([r]);

        // Act
        const result = await run(h);

        // Assert
        expect(h.records).toHaveLength(1);
        expect(h.records[0]).toMatchObject({
            outboxId: r.id,
            recipient: r.recipientEmail,
            status: 'sent',
            emailClass: 'transactional',
            subject: `Subject of ${TRANSACTIONAL}`,
            providerMessageId: 'msg-1',
            at: NOW
        });
        expect(h.outbox.markSent).toHaveBeenCalledWith({
            id: r.id,
            owner: OWNER,
            providerMessageId: 'msg-1'
        });
        expect(result.sent).toBe(1);
    });

    it('a sent commercial mail leaves exactly one `sent` record of class commercial', async () => {
        // Arrange
        const h = harness([row({ template: COMMERCIAL })]);

        // Act
        await run(h);

        // Assert
        expect(h.records).toHaveLength(1);
        expect(h.records[0]).toMatchObject({ status: 'sent', emailClass: 'commercial' });
    });

    it('sends to the address the row captured, never re-reading the account', async () => {
        // Arrange
        const h = harness([row({ recipientEmail: 'captured@example.com' })]);

        // Act
        await run(h);

        // Assert
        expect(h.send).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'captured@example.com' })
        );
    });

    it('a refused attempt leaves one `failed` record and returns the row to `retry`', async () => {
        // Arrange
        const r = row({ attempts: 1 });
        const h = harness([r]);
        h.send.mockRejectedValueOnce(new Error('provider 503'));

        // Act
        const result = await run(h);

        // Assert
        expect(h.records).toHaveLength(1);
        expect(h.records[0]).toMatchObject({ status: 'failed', errorMessage: 'provider 503' });
        expect(h.outbox.recordFailure).toHaveBeenCalledWith({
            id: r.id,
            owner: OWNER,
            error: 'provider 503',
            maxAttempts: EMAIL_OUTBOX_CONSTANTS.MAX_ATTEMPTS
        });
        expect(result).toMatchObject({ retried: 1, failed: 0, escalated: 0 });
        expect(h.escalations).toHaveLength(0);
    });

    it('a failure writing the record AFTER the provider accepted is never treated as a failed send', async () => {
        // Arrange
        const h = harness([row()]);
        h.outbox.markSent.mockRejectedValueOnce(new Error('db down'));

        // Act
        const result = await run(h);

        // Assert
        expect(h.outbox.recordFailure).not.toHaveBeenCalled();
        expect(result).toMatchObject({ errors: 1, sent: 0, retried: 0 });
    });
});

describe('TEST:U2:4 escalation of an undeliverable transactional mail', () => {
    it('retries exhausted: the row ends failed with the exhausted marker and is escalated', async () => {
        // Arrange
        const r = row({ attempts: EMAIL_OUTBOX_CONSTANTS.MAX_ATTEMPTS - 1 });
        const h = harness([r]);
        h.send.mockRejectedValueOnce(new Error('provider 503'));

        // Act
        const result = await run(h);

        // Assert
        expect(h.outbox.recordFailure).toHaveBeenCalledWith(
            expect.objectContaining({
                error: `${OUTBOX_LAST_ERROR_MARKERS.RETRIES_EXHAUSTED}: provider 503`
            })
        );
        expect(h.records.map((x) => x.status)).toEqual(['failed', 'undeliverable']);
        expect(h.records[1]?.metadata).toMatchObject({
            kind: 'escalation',
            reason: 'retries_exhausted',
            attempts: EMAIL_OUTBOX_CONSTANTS.MAX_ATTEMPTS
        });
        expect(h.escalations).toEqual([
            {
                outboxId: r.id,
                template: TRANSACTIONAL,
                recipientUserId: r.recipientUserId,
                reason: 'retries_exhausted',
                attempts: EMAIL_OUTBOX_CONSTANTS.MAX_ATTEMPTS,
                lastError: `${OUTBOX_LAST_ERROR_MARKERS.RETRIES_EXHAUSTED}: provider 503`
            }
        ]);
        expect(result).toMatchObject({ failed: 1, escalated: 1 });
    });

    it('hard bounce on send: one `bounced` record, failed at once with the bounce marker, escalated', async () => {
        // Arrange
        const r = row();
        const h = harness([r]);
        h.send.mockRejectedValueOnce(new EmailHardBounceError('mailbox does not exist'));

        // Act
        const result = await run(h);

        // Assert
        expect(h.outbox.recordFailure).toHaveBeenCalledWith({
            id: r.id,
            owner: OWNER,
            error: `${OUTBOX_LAST_ERROR_MARKERS.HARD_BOUNCE}: mailbox does not exist`,
            maxAttempts: 1
        });
        expect(h.records.map((x) => x.status)).toEqual(['bounced', 'undeliverable']);
        expect(h.escalations[0]).toMatchObject({ reason: 'hard_bounce', attempts: 1 });
        expect(result).toMatchObject({ failed: 1, escalated: 1 });
    });

    it('an address that already bounced: suppressed before sending, failed with the bounce marker, escalated', async () => {
        // Arrange
        const r = row();
        const h = harness([r]);
        h.log.hasHardBounce.mockResolvedValueOnce(true);

        // Act
        const result = await run(h);

        // Assert
        expect(h.send).not.toHaveBeenCalled();
        expect(h.outbox.markFailed).toHaveBeenCalledWith({
            id: r.id,
            owner: OWNER,
            marker: OUTBOX_LAST_ERROR_MARKERS.HARD_BOUNCE
        });
        expect(h.records.map((x) => x.status)).toEqual(['suppressed', 'undeliverable']);
        expect(h.escalations).toHaveLength(1);
        expect(result).toMatchObject({ suppressed: 1, escalated: 1 });
    });

    it('a COMMERCIAL mail that exhausts its retries is failed but NOT escalated', async () => {
        // Arrange
        const h = harness([
            row({ template: COMMERCIAL, attempts: EMAIL_OUTBOX_CONSTANTS.MAX_ATTEMPTS - 1 })
        ]);
        h.send.mockRejectedValueOnce(new Error('provider 503'));

        // Act
        const result = await run(h);

        // Assert
        expect(h.escalations).toHaveLength(0);
        expect(h.records.map((x) => x.status)).toEqual(['failed']);
        expect(result).toMatchObject({ failed: 1, escalated: 0 });
    });

    it('an unregistered template is a refused attempt, so it ends escalated instead of dropped', async () => {
        // Arrange
        const r = row({ attempts: EMAIL_OUTBOX_CONSTANTS.MAX_ATTEMPTS - 1 });
        const h = harness([r]);
        const deps = { ...h.deps, render: createOutboxMailRenderer() };

        // Act
        await processEmailOutboxBatch({ deps, owner: OWNER, now: NOW, leaseMs: 1, batchSize: 1 });

        // Assert
        expect(h.send).not.toHaveBeenCalled();
        expect(h.escalations[0]?.lastError).toContain('No outbox renderer registered');
    });
});

describe('TEST:U2:7 suppression cuts before sending', () => {
    let h: Harness;

    beforeEach(() => {
        h = harness([]);
    });

    it('deleted account: a mail enqueued after the deletion is suppressed, not escalated', async () => {
        // Arrange
        const r = row();
        h = harness([r]);
        h.outbox.getRecipientDeletedAt.mockResolvedValueOnce(new Date(r.createdAt.getTime() - 1));

        // Act
        const result = await run(h);

        // Assert
        expect(h.send).not.toHaveBeenCalled();
        expect(h.outbox.markFailed).toHaveBeenCalledWith(
            expect.objectContaining({ marker: OUTBOX_LAST_ERROR_MARKERS.ACCOUNT_DELETED })
        );
        expect(h.records).toHaveLength(1);
        expect(h.records[0]).toMatchObject({ status: 'suppressed' });
        expect(h.escalations).toHaveLength(0);
        expect(result.suppressed).toBe(1);
    });

    it('deleted account: a mail enqueued before the deletion still goes out', async () => {
        // Arrange
        const r = row();
        h = harness([r]);
        h.outbox.getRecipientDeletedAt.mockResolvedValueOnce(new Date(r.createdAt.getTime() + 1));

        // Act
        await run(h);

        // Assert
        expect(h.send).toHaveBeenCalledTimes(1);
    });

    it('a row with no account never reads a deletion', async () => {
        // Arrange
        h = harness([row({ recipientUserId: null })]);

        // Act
        await run(h);

        // Assert
        expect(h.outbox.getRecipientDeletedAt).not.toHaveBeenCalled();
        expect(h.send).toHaveBeenCalledTimes(1);
    });

    it('opt-out suppresses a commercial mail', async () => {
        // Arrange
        const r = row({ template: COMMERCIAL });
        h = harness([r]);
        h.isOptedOut.mockResolvedValueOnce(true);

        // Act
        await run(h);

        // Assert
        expect(h.isOptedOut).toHaveBeenCalledWith({
            userId: r.recipientUserId,
            template: COMMERCIAL
        });
        expect(h.send).not.toHaveBeenCalled();
        expect(h.outbox.markFailed).toHaveBeenCalledWith(
            expect.objectContaining({ marker: OUTBOX_LAST_ERROR_MARKERS.OPT_OUT })
        );
    });

    it('opt-out and cap are never even read for a transactional mail', async () => {
        // Arrange
        h = harness([row()]);

        // Act
        await run(h);

        // Assert
        expect(h.isOptedOut).not.toHaveBeenCalled();
        expect(h.log.countSentByClassSince).not.toHaveBeenCalled();
        expect(h.send).toHaveBeenCalledTimes(1);
    });

    it('daily cap: counts commercial mail to THIS recipient over the rolling window', async () => {
        // Arrange
        const r = row({ template: COMMERCIAL, recipientEmail: 'capped@example.com' });
        h = harness([r]);
        h.log.countSentByClassSince.mockResolvedValueOnce(1);

        // Act
        await run(h);

        // Assert
        expect(h.log.countSentByClassSince).toHaveBeenCalledWith({
            recipient: 'capped@example.com',
            emailClass: 'commercial',
            since: new Date(NOW.getTime() - EMAIL_OUTBOX_CONSTANTS.DAILY_CAP_WINDOW_MS)
        });
        expect(h.send).not.toHaveBeenCalled();
        expect(h.outbox.markFailed).toHaveBeenCalledWith(
            expect.objectContaining({ marker: OUTBOX_LAST_ERROR_MARKERS.DAILY_CAP })
        );
    });

    it('a suppression does not count a delivery attempt', async () => {
        // Arrange
        h = harness([row({ template: COMMERCIAL })]);
        h.isOptedOut.mockResolvedValueOnce(true);

        // Act
        await run(h);

        // Assert
        expect(h.outbox.recordFailure).not.toHaveBeenCalled();
    });
});

describe('createOutboxOptOutReader', () => {
    it('is opted out when the preference service says not to send', async () => {
        // Arrange
        const shouldSendNotification = vi.fn(async () => false);
        const read = createOutboxOptOutReader({ preferenceService: { shouldSendNotification } });

        // Act
        const optedOut = await read({ userId: 'u1', template: COMMERCIAL });

        // Assert
        expect(optedOut).toBe(true);
        expect(shouldSendNotification).toHaveBeenCalledWith('u1', COMMERCIAL);
    });

    it('is never opted out of a template that has no preference', async () => {
        // Arrange
        const shouldSendNotification = vi.fn(async () => false);
        const read = createOutboxOptOutReader({ preferenceService: { shouldSendNotification } });

        // Act / Assert
        expect(await read({ userId: 'u1', template: 'unknown-template' })).toBe(false);
        expect(shouldSendNotification).not.toHaveBeenCalled();
    });
});

describe('createOutboxMailRenderer', () => {
    it('ships an empty registry: U2 enqueues none of the catalog mails', () => {
        expect(Object.keys(OUTBOX_MAIL_RENDERERS)).toHaveLength(0);
    });

    it('delegates to a registered renderer', async () => {
        // Arrange
        const render = createOutboxMailRenderer({
            renderers: {
                welcome: () => ({ subject: 'Hi', react: createElement('p', null, 'x') })
            }
        });

        // Act
        const mail = await render({ row: row({ template: 'welcome' }) });

        // Assert
        expect(mail.subject).toBe('Hi');
    });
});
