/**
 * Cron wiring of the email outbox sender (HOS-1423, unit U2.2).
 *
 * TEST:U2:4 — an undeliverable transactional mail is escalated as a
 * Sentry-captured error (`capture: true`) on the cron logger, and the run
 * keeps going. TEST:U2:8 — the run records attempts in the notification log
 * through the injected log, one per attempt. The batch itself runs for real
 * (`processEmailOutboxBatch` from `@repo/notifications`); only the storage and
 * the provider are fakes, injected through `createEmailOutboxSenderJob`, so no
 * assertion here depends on the global `@repo/db` mock.
 */
import type { EmailOutboxRow, RecordEmailAttemptInput } from '@repo/db';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createEmailOutboxSenderJob,
    EMAIL_OUTBOX_BATCH_SIZE,
    EMAIL_OUTBOX_LEASE_MS,
    EMAIL_OUTBOX_SENDER_SCHEDULE,
    type EmailOutboxSenderDeps,
    emailOutboxSenderJob
} from '../../src/cron/jobs/email-outbox-sender.job';
import type { CronJobContext } from '../../src/cron/types';

const STARTED_AT = new Date('2026-10-07T12:00:00.000Z');

function row(overrides: Partial<EmailOutboxRow> = {}): EmailOutboxRow {
    return {
        id: crypto.randomUUID(),
        recipientUserId: null,
        recipientEmail: 'host@example.com',
        template: 'subscription-cancel-notice',
        channel: 'email',
        payload: {},
        status: 'processing',
        dedupKey: crypto.randomUUID(),
        lockedBy: 'x',
        lockedUntil: STARTED_AT,
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        createdAt: new Date(STARTED_AT.getTime() - 1000),
        updatedAt: STARTED_AT,
        ...overrides
    };
}

function context(dryRun = false): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: STARTED_AT,
        dryRun
    };
}

function fakeDeps(claimed: EmailOutboxRow[]) {
    const records: RecordEmailAttemptInput[] = [];
    const outbox = {
        recoverExpired: vi.fn(async () => [] as string[]),
        claim: vi.fn(async () => claimed),
        markSent: vi.fn(async () => true),
        recordFailure: vi.fn(async () => 'failed' as const),
        markFailed: vi.fn(async () => true),
        getRecipientDeletedAt: vi.fn(async () => null)
    };
    const send = vi.fn(async () => ({ messageId: 'msg-1' }));
    const deps: EmailOutboxSenderDeps = {
        outbox,
        log: {
            hasHardBounce: vi.fn(async () => false),
            countSentByClassSince: vi.fn(async () => 0),
            recordEmailAttempt: vi.fn(async (input: RecordEmailAttemptInput) => {
                records.push(input);
                return {} as never;
            })
        },
        isOptedOut: vi.fn(async () => false),
        render: () => ({ subject: 'S', react: createElement('p', null, 'b') }),
        transport: { send }
    };
    return { deps, outbox, send, records };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('email-outbox-sender registration', () => {
    it('runs every minute with a 5-minute lease', () => {
        expect(emailOutboxSenderJob.name).toBe('email-outbox-sender');
        expect(emailOutboxSenderJob.schedule).toBe('* * * * *');
        expect(EMAIL_OUTBOX_SENDER_SCHEDULE).toBe('* * * * *');
        expect(EMAIL_OUTBOX_LEASE_MS).toBe(300_000);
        expect(emailOutboxSenderJob.enabled).toBe(true);
        // A run must finish before the next minute's run starts.
        expect(emailOutboxSenderJob.timeoutMs).toBeLessThan(60_000);
    });
});

describe('email-outbox-sender handler', () => {
    it('dry run claims nothing and builds no dependencies', async () => {
        // Arrange
        const buildDeps = vi.fn();
        const job = createEmailOutboxSenderJob({ buildDeps });

        // Act
        const result = await job.handler(context(true));

        // Assert
        expect(result).toMatchObject({ success: true, processed: 0 });
        expect(buildDeps).not.toHaveBeenCalled();
    });

    it('takes `now` from ctx.startedAt: recovers expired leases first, then claims with the lease', async () => {
        // Arrange
        const { deps, outbox } = fakeDeps([]);
        const job = createEmailOutboxSenderJob({ buildDeps: () => deps });

        // Act
        await job.handler(context());

        // Assert
        expect(outbox.recoverExpired).toHaveBeenCalledWith({ now: STARTED_AT });
        expect(outbox.claim).toHaveBeenCalledWith(
            expect.objectContaining({
                now: STARTED_AT,
                leaseMs: EMAIL_OUTBOX_LEASE_MS,
                limit: EMAIL_OUTBOX_BATCH_SIZE,
                owner: expect.stringMatching(/^email-outbox-sender:/)
            })
        );
        expect(outbox.recoverExpired.mock.invocationCallOrder[0]).toBeLessThan(
            outbox.claim.mock.invocationCallOrder[0] ?? 0
        );
    });

    it('TEST:U2:8 a sent mail leaves one record in the notification log, at the run instant', async () => {
        // Arrange
        const { deps, records } = fakeDeps([row()]);
        const job = createEmailOutboxSenderJob({ buildDeps: () => deps });

        // Act
        const result = await job.handler(context());

        // Assert
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({ status: 'sent', at: STARTED_AT });
        expect(result).toMatchObject({ success: true, processed: 1, errors: 0 });
    });

    it('TEST:U2:4 escalates an exhausted transactional mail as a captured error and still succeeds', async () => {
        // Arrange
        const { deps, send } = fakeDeps([row({ attempts: 4 })]);
        send.mockRejectedValueOnce(new Error('provider 503'));
        const job = createEmailOutboxSenderJob({ buildDeps: () => deps });
        const ctx = context();

        // Act
        const result = await job.handler(ctx);

        // Assert
        expect(ctx.logger.error).toHaveBeenCalledWith(
            'Email outbox: transactional mail is undeliverable and was escalated',
            expect.objectContaining({ reason: 'retries_exhausted', attempts: 5 }),
            { capture: true }
        );
        expect(result).toMatchObject({ success: true, details: { failed: 1, escalated: 1 } });
    });

    it('logs a row whose processing threw, with its outbox id and cause', async () => {
        // Arrange
        const broken = row();
        const { deps } = fakeDeps([broken]);
        vi.mocked(deps.log.hasHardBounce).mockRejectedValueOnce(new Error('db down'));
        const job = createEmailOutboxSenderJob({ buildDeps: () => deps });
        const ctx = context();

        // Act
        const result = await job.handler(ctx);

        // Assert
        expect(ctx.logger.error).toHaveBeenCalledWith(
            'Email outbox: row processing failed; it returns on lease expiry',
            { outboxId: broken.id, template: broken.template, error: 'db down' }
        );
        expect(result).toMatchObject({ success: true, errors: 1 });
    });

    it('warns when a sent mail lost its lease before being marked sent', async () => {
        // Arrange
        const r = row();
        const { deps, outbox } = fakeDeps([r]);
        outbox.markSent.mockResolvedValueOnce(false);
        const job = createEmailOutboxSenderJob({ buildDeps: () => deps });
        const ctx = context();

        // Act
        await job.handler(ctx);

        // Assert
        expect(ctx.logger.warn).toHaveBeenCalledWith(
            'Email outbox: mail sent but the lease was lost before marking it sent',
            { outboxId: r.id, template: r.template, providerMessageId: 'msg-1' }
        );
    });

    it('without a provider key it only releases expired leases and leaves the queue untouched', async () => {
        // Arrange
        const recoverExpired = vi.fn(async () => ['r1']);
        const job = createEmailOutboxSenderJob({ buildDeps: () => null, recoverExpired });
        const ctx = context();

        // Act
        const result = await job.handler(ctx);

        // Assert
        expect(recoverExpired).toHaveBeenCalledWith({ now: STARTED_AT });
        expect(ctx.logger.warn).toHaveBeenCalled();
        expect(result).toMatchObject({ success: true, processed: 0, details: { recovered: 1 } });
    });

    it('reports a failed run when the queue cannot be read', async () => {
        // Arrange
        const { deps, outbox } = fakeDeps([]);
        outbox.claim.mockRejectedValueOnce(new Error('db down'));
        const job = createEmailOutboxSenderJob({ buildDeps: () => deps });

        // Act
        const result = await job.handler(context());

        // Assert
        expect(result).toMatchObject({ success: false, errors: 1, message: 'db down' });
    });
});
