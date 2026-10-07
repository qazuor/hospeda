/**
 * Unit tests of the outbox sender batch (HOS-1423): the run, TEST:U2:8 (one
 * attempt record per attempt, in the notification log only) and TEST:U2:4
 * (escalation without blocking). Orchestration is tested with fakes; the SQL
 * primitives are proved against a real database in
 * `packages/db/test/integration/email-outbox-delivery.integration.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { EMAIL_OUTBOX_CONSTANTS } from '../../../src/constants/notification.constants';
import {
    EmailHardBounceError,
    OUTBOX_LAST_ERROR_MARKERS,
    processEmailOutboxBatch
} from '../../../src/services/outbox/email-outbox-delivery.service';
import { createOutboxMailRenderer } from '../../../src/services/outbox/email-outbox-renderers';
import { COMMERCIAL, harness, NOW, OWNER, row, run, TRANSACTIONAL } from './outbox-batch.harness';

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

    it('reports every row that throws, with its outbox id and the cause', async () => {
        // Arrange
        const broken = row();
        const h = harness([broken, row()]);
        h.log.hasHardBounce.mockRejectedValueOnce(new Error('db down'));

        // Act
        await run(h);

        // Assert
        expect(h.rowErrors).toEqual([
            { outboxId: broken.id, template: broken.template, error: 'db down' }
        ]);
    });

    it('reports nothing when every row processes cleanly', async () => {
        // Arrange
        const h = harness([row(), row()]);

        // Act
        await run(h);

        // Assert
        expect(h.rowErrors).toHaveLength(0);
        expect(h.leaseLost).toHaveLength(0);
    });

    it('reports a sent mail whose lease was lost before marking it sent, and still records the attempt', async () => {
        // Arrange
        const r = row();
        const h = harness([r]);
        h.outbox.markSent.mockResolvedValueOnce(false);

        // Act
        const result = await run(h);

        // Assert
        expect(h.leaseLost).toEqual([
            { outboxId: r.id, template: r.template, providerMessageId: 'msg-1' }
        ]);
        expect(h.records.map((x) => x.status)).toEqual(['sent']);
        expect(result).toMatchObject({ sent: 1, errors: 0 });
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
        const correlationId = crypto.randomUUID();
        const r = row({ attempts: EMAIL_OUTBOX_CONSTANTS.MAX_ATTEMPTS - 1, correlationId });
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
                lastError: `${OUTBOX_LAST_ERROR_MARKERS.RETRIES_EXHAUSTED}: provider 503`,
                correlationId
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

describe('TEST:U2:9 each outbox item carries its own correlation (HOS-1424)', () => {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    it('escalates under the correlation stored on the row by its enqueuing intention', async () => {
        // Arrange
        const correlationId = crypto.randomUUID();
        const h = harness([row({ correlationId })]);
        h.log.hasHardBounce.mockResolvedValueOnce(true);

        // Act
        await run(h);

        // Assert
        expect(h.escalations.map((e) => e.correlationId)).toEqual([correlationId]);
    });

    it('mints a distinct correlation per item when the row carries none', async () => {
        // Arrange
        const h = harness([row(), row()]);
        h.log.hasHardBounce.mockResolvedValue(true);

        // Act
        await run(h);

        // Assert
        const [first, second] = h.escalations.map((e) => e.correlationId);
        expect(first).toMatch(UUID);
        expect(second).toMatch(UUID);
        expect(first).not.toBe(second);
    });

    it('never hands the correlation to the provider', async () => {
        // Arrange
        const correlationId = crypto.randomUUID();
        const h = harness([row({ correlationId })]);

        // Act
        await run(h);

        // Assert
        expect(JSON.stringify(h.send.mock.calls)).not.toContain(correlationId);
    });

    it('awaits the escalation hook before the batch ends', async () => {
        // Arrange
        const h = harness([row()]);
        h.log.hasHardBounce.mockResolvedValueOnce(true);
        let settled = false;
        const deps = {
            ...h.deps,
            escalate: async () => {
                await new Promise((resolve) => setTimeout(resolve, 5));
                settled = true;
            }
        };

        // Act
        await processEmailOutboxBatch({ deps, owner: OWNER, now: NOW, leaseMs: 1, batchSize: 1 });

        // Assert
        expect(settled).toBe(true);
    });
});
