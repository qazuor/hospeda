/**
 * Unit tests of the outbox sender batch (HOS-1423): TEST:U2:7 — suppression
 * cuts before sending — plus the opt-out reader and the renderer registry.
 * Orchestration is tested with fakes; the facts it reads are proved against a
 * real database in `packages/db/test/integration/email-outbox-delivery.integration.test.ts`.
 */
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createOutboxOptOutReader,
    OUTBOX_LAST_ERROR_MARKERS,
    processEmailOutboxBatch
} from '../../../src/services/outbox/email-outbox-delivery.service';
import {
    createOutboxMailRenderer,
    OUTBOX_MAIL_RENDERERS
} from '../../../src/services/outbox/email-outbox-renderers';
import { COMMERCIAL, type Harness, harness, row, run } from './outbox-batch.harness';

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

    it('daily cap: counts commercial mail to THIS recipient since BA midnight of today (TEST:U2:6)', async () => {
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
            // NOW is 09:00 on 7 October in Buenos Aires: the window opens at 00:00 -03:00.
            since: new Date('2026-10-07T03:00:00.000Z')
        });
        expect(h.send).not.toHaveBeenCalled();
        expect(h.outbox.markFailed).toHaveBeenCalledWith(
            expect.objectContaining({ marker: OUTBOX_LAST_ERROR_MARKERS.DAILY_CAP })
        );
    });

    it('daily cap near midnight: 23:30 in Buenos Aires still counts from BA midnight of that day (TEST:U2:6)', async () => {
        // Arrange: 2026-10-07T02:30Z is 23:30 on 6 October in Buenos Aires, while
        // the UTC calendar already says 7 October.
        const r = row({ template: COMMERCIAL, recipientEmail: 'late@example.com' });
        h = harness([r]);
        const lateNight = new Date('2026-10-07T02:30:00.000Z');

        // Act
        await processEmailOutboxBatch({
            deps: h.deps,
            owner: 'email-outbox-sender:test',
            now: lateNight,
            leaseMs: 300_000,
            batchSize: 50
        });

        // Assert: the window is 6 October in BA, neither the UTC day nor a rolling 24h.
        expect(h.log.countSentByClassSince).toHaveBeenCalledWith({
            recipient: 'late@example.com',
            emailClass: 'commercial',
            since: new Date('2026-10-06T03:00:00.000Z')
        });
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
