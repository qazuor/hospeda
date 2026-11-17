/**
 * HOS-1512: the run is written together with its alert mail, or not at all.
 * The `@repo/db` mock holders live in `vi.hoisted` (a `let` would not exist yet when the
 * hoisted factory closes over it).
 */
import type { WatchRunRecord } from '@repo/payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    const tx = { marker: 'tx' };
    return {
        tx,
        transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
        insert: vi.fn(),
        findLatestCompleted: vi.fn(),
        listSuperAdminRecipients: vi.fn(),
        enqueue: vi.fn()
    };
});

vi.mock('@repo/db', () => ({
    getDb: () => ({ transaction: h.transaction }),
    providerWatchRunModel: { insert: h.insert, findLatestCompleted: h.findLatestCompleted },
    listSuperAdminRecipients: h.listSuperAdminRecipients,
    emailOutboxModel: { enqueue: h.enqueue },
    buildEmailDedupKey: (input: { recipient: string; template: string; occurrence: string }) =>
        `${input.recipient}|${input.template}|${input.occurrence}`,
    buildEventOccurrence: (input: { eventId: string }) => `event:${input.eventId}`
}));

import {
    describeValue,
    PROVIDER_WATCH_ALERT_TEMPLATE
} from '../../../src/utils/provider-watch/provider-watch-alert-outbox';
import {
    readPreviousShapes,
    recordWatchRun
} from '../../../src/utils/provider-watch/provider-watch-run-store';

const START = new Date('2026-11-17T10:00:00.000Z');
const END = new Date('2026-11-17T10:05:00.000Z');

function run(overrides: Partial<WatchRunRecord> = {}): WatchRunRecord {
    return {
        account: 'sandbox',
        startedAt: START,
        finishedAt: END,
        outcome: 'completed',
        measurements: { M1: { outcome: 'matched', expected: 1, obtained: 1, shapes: {} } },
        alerts: [],
        ...overrides
    };
}

const alert = {
    measurementId: 'M1',
    kind: 'value_changed' as const,
    expected: 1,
    obtained: 2,
    details: []
};

describe('recordWatchRun', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.insert.mockResolvedValue({ id: 'run-1' });
        h.enqueue.mockResolvedValue({ enqueued: true, row: {} });
    });

    it('writes a run with no alerts and queues no mail', async () => {
        const result = await recordWatchRun({ run: run(), correlationId: 'c-1' });
        expect(result).toEqual({ runId: 'run-1', mailsQueued: 0 });
        expect(h.insert).toHaveBeenCalledWith({
            run: expect.objectContaining({
                account: 'sandbox',
                outcome: 'completed',
                reason: null
            }),
            tx: h.tx
        });
        expect(h.listSuperAdminRecipients).not.toHaveBeenCalled();
        expect(h.enqueue).not.toHaveBeenCalled();
    });

    it('writes the run and one mail per SUPER_ADMIN in one transaction, recording the channel', async () => {
        h.listSuperAdminRecipients.mockResolvedValue([
            { userId: 'u1', email: 'a@example.test' },
            { userId: 'u2', email: 'b@example.test' }
        ]);
        const result = await recordWatchRun({
            run: run({ alerts: [alert] }),
            correlationId: 'c-1'
        });
        expect(h.transaction).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ runId: 'run-1', mailsQueued: 2 });
        expect(h.insert.mock.calls[0]?.[0].run.alerts).toEqual([
            { ...alert, channel: 'email', recipients: 2 }
        ]);
        expect(h.enqueue).toHaveBeenCalledTimes(2);
        const [first, firstTx] = h.enqueue.mock.calls[0] ?? [];
        expect(firstTx).toBe(h.tx);
        expect(first).toMatchObject({
            recipientUserId: 'u1',
            recipientEmail: 'a@example.test',
            template: PROVIDER_WATCH_ALERT_TEMPLATE,
            dedupKey: `u1|${PROVIDER_WATCH_ALERT_TEMPLATE}|event:run-1`,
            correlationId: 'c-1',
            payload: {
                account: 'sandbox',
                finishedAt: END.toISOString(),
                alerts: [
                    {
                        measurementId: 'M1',
                        kind: 'value_changed',
                        expected: '1',
                        obtained: '2',
                        details: []
                    }
                ]
            }
        });
    });

    it('fails, storing nothing, when there are changes and nobody to tell', async () => {
        h.listSuperAdminRecipients.mockResolvedValue([]);
        await expect(
            recordWatchRun({ run: run({ alerts: [alert] }), correlationId: 'c-1' })
        ).rejects.toThrow('no SUPER_ADMIN to tell');
        expect(h.insert).not.toHaveBeenCalled();
    });

    it('propagates a failed write so the run fails', async () => {
        h.insert.mockRejectedValue(new Error('db down'));
        await expect(recordWatchRun({ run: run(), correlationId: 'c-1' })).rejects.toThrow(
            'db down'
        );
    });

    it('stores the reason of a run that did not complete', async () => {
        await recordWatchRun({
            run: run({ outcome: 'failed', reason: 'empty catalog' }),
            correlationId: 'c-1'
        });
        expect(h.insert.mock.calls[0]?.[0].run).toMatchObject({
            outcome: 'failed',
            reason: 'empty catalog'
        });
    });
});

describe('readPreviousShapes', () => {
    beforeEach(() => vi.clearAllMocks());

    it('answers null when the account has no completed run', async () => {
        h.findLatestCompleted.mockResolvedValue(null);
        await expect(readPreviousShapes({ account: 'sandbox' })).resolves.toBeNull();
        expect(h.findLatestCompleted).toHaveBeenCalledWith({ account: 'sandbox' });
    });

    it('extracts the shapes of every measurement of the latest completed run', async () => {
        h.findLatestCompleted.mockResolvedValue({
            id: 'r',
            measurements: {
                M1: { outcome: 'matched', shapes: { create: { $: 'object', id: 'string' } } },
                RP7: { outcome: 'changed', shapes: {} }
            }
        });
        await expect(readPreviousShapes({ account: 'sandbox' })).resolves.toEqual({
            M1: { create: { $: 'object', id: 'string' } },
            RP7: {}
        });
    });

    it('treats unreadable stored shapes as no baseline instead of stopping the battery', async () => {
        h.findLatestCompleted.mockResolvedValue({ id: 'r', measurements: { M1: { shapes: 5 } } });
        await expect(readPreviousShapes({ account: 'sandbox' })).resolves.toBeNull();
    });
});

describe('describeValue', () => {
    it('renders JSON and cuts a long value, leaving the stored run whole', () => {
        expect(describeValue({ value: { a: 1 } })).toBe('{"a":1}');
        const long = describeValue({ value: 'x'.repeat(2000) });
        expect(long.length).toBeLessThan(700);
        expect(long.endsWith('…')).toBe(true);
    });
});
