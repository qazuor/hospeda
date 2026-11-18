/**
 * HOS-1512: the run closes together with its alert mail, or not at all; the baseline is what the
 * owner accepted. The `@repo/db` mock holders live in `vi.hoisted` (a `let` would not exist yet
 * when the hoisted factory closes over it). The transaction mock records commit and rollback so
 * the atomicity can be asserted.
 */
import type { WatchRunRecord } from '@repo/payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    const tx = { marker: 'tx' };
    const state = { committed: 0, rolledBack: 0 };
    return {
        tx,
        state,
        transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
            try {
                const result = await fn(tx);
                state.committed += 1;
                return result;
            } catch (error) {
                state.rolledBack += 1;
                throw error;
            }
        }),
        open: vi.fn(),
        close: vi.fn(),
        appendProviderIds: vi.fn(),
        listBaselines: vi.fn(),
        listSuperAdminRecipients: vi.fn(),
        enqueue: vi.fn()
    };
});

vi.mock('@repo/db', () => ({
    getDb: () => ({ transaction: h.transaction }),
    providerWatchRunModel: {
        open: h.open,
        close: h.close,
        appendProviderIds: h.appendProviderIds,
        listBaselines: h.listBaselines
    },
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
    closeWatchRun,
    openWatchRun,
    readAcceptedBaseline,
    recordWatchProgress
} from '../../../src/utils/provider-watch/provider-watch-run-store';

const START = new Date('2026-11-17T10:00:00.000Z');
const END = new Date('2026-11-17T10:05:00.000Z');

function run(overrides: Partial<WatchRunRecord> = {}): WatchRunRecord {
    return {
        account: 'sandbox',
        startedAt: START,
        finishedAt: END,
        outcome: 'completed',
        measurements: {
            M1: { outcome: 'matched', expected: 1, obtained: 1, shapes: {}, providerIds: ['pre-1'] }
        },
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

describe('openWatchRun', () => {
    it('opens the run through the model, handing it the month to consume', async () => {
        h.open.mockResolvedValue({ runId: 'run-1', authorizationConsumed: true });
        await expect(
            openWatchRun({
                account: 'production',
                startedAt: START,
                consumeAuthorization: {
                    month: '2026-11',
                    maxChargeMinor: 150000,
                    accountId: '100000001'
                }
            })
        ).resolves.toEqual({ runId: 'run-1', authorizationConsumed: true });
        expect(h.open).toHaveBeenCalledWith({
            account: 'production',
            startedAt: START,
            consumeAuthorization: {
                month: '2026-11',
                maxChargeMinor: 150000,
                accountId: '100000001'
            },
            abandonRunsStartedBefore: new Date(START.getTime() - 600_000)
        });
    });
});

describe('recordWatchProgress', () => {
    it('writes the ids through the model on its own, never inside a transaction', async () => {
        h.appendProviderIds.mockResolvedValue(undefined);
        h.transaction.mockClear();
        await recordWatchProgress({ runId: 'run-1', measurementId: 'M1', providerIds: ['pre-1'] });
        expect(h.appendProviderIds).toHaveBeenCalledWith({
            runId: 'run-1',
            measurementId: 'M1',
            providerIds: ['pre-1']
        });
        expect(h.transaction).not.toHaveBeenCalled();
    });

    it('propagates a failed write so the engine aborts the run', async () => {
        h.appendProviderIds.mockRejectedValue(new Error('db down'));
        await expect(
            recordWatchProgress({ runId: 'run-1', measurementId: 'M1', providerIds: ['pre-1'] })
        ).rejects.toThrow('db down');
    });
});

describe('closeWatchRun', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.state.committed = 0;
        h.state.rolledBack = 0;
        h.close.mockResolvedValue({ id: 'run-1' });
        h.enqueue.mockResolvedValue({ enqueued: true, row: {} });
    });

    it('closes a run with no alerts and queues no mail', async () => {
        const result = await closeWatchRun({ runId: 'run-1', run: run(), correlationId: 'c-1' });
        expect(result).toEqual({ mailsQueued: 0 });
        expect(h.close).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'run-1',
                outcome: 'completed',
                reason: null,
                finishedAt: END,
                tx: h.tx
            })
        );
        expect(h.listSuperAdminRecipients).not.toHaveBeenCalled();
        expect(h.enqueue).not.toHaveBeenCalled();
    });

    it('closes the run and queues one mail per SUPER_ADMIN in ONE transaction, recording the channel', async () => {
        h.listSuperAdminRecipients.mockResolvedValue([
            { userId: 'u1', email: 'a@example.test' },
            { userId: 'u2', email: 'b@example.test' }
        ]);
        const result = await closeWatchRun({
            runId: 'run-1',
            run: run({ alerts: [alert] }),
            correlationId: 'c-1'
        });
        expect(h.transaction).toHaveBeenCalledTimes(1);
        expect(h.state.committed).toBe(1);
        expect(result).toEqual({ mailsQueued: 2 });
        expect(h.close.mock.calls[0]?.[0].alerts).toEqual([
            { ...alert, channel: 'email', recipients: 2 }
        ]);
        expect(h.enqueue).toHaveBeenCalledTimes(2);
        const [first, firstTx] = h.enqueue.mock.calls[0] ?? [];
        expect(firstTx).toBe(h.tx);
        expect(first).toMatchObject({
            recipientUserId: 'u1',
            template: PROVIDER_WATCH_ALERT_TEMPLATE,
            dedupKey: `u1|${PROVIDER_WATCH_ALERT_TEMPLATE}|event:run-1`,
            correlationId: 'c-1',
            payload: {
                account: 'sandbox',
                finishedAt: END.toISOString(),
                omitted: 0,
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

    it('rolls EVERYTHING back when the mail cannot be queued: no closed run without its mail', async () => {
        h.listSuperAdminRecipients.mockResolvedValue([{ userId: 'u1', email: 'a@example.test' }]);
        h.enqueue.mockRejectedValue(new Error('outbox down'));
        await expect(
            closeWatchRun({ runId: 'run-1', run: run({ alerts: [alert] }), correlationId: 'c-1' })
        ).rejects.toThrow('outbox down');
        expect(h.state.rolledBack).toBe(1);
        expect(h.state.committed).toBe(0);
        // The close was issued inside the transaction that rolled back, so it was not kept.
        expect(h.close.mock.calls[0]?.[0].tx).toBe(h.tx);
    });

    it('rolls back when closing the run fails, and queues nothing', async () => {
        h.listSuperAdminRecipients.mockResolvedValue([{ userId: 'u1', email: 'a@example.test' }]);
        h.close.mockRejectedValue(new Error('db down'));
        await expect(
            closeWatchRun({ runId: 'run-1', run: run({ alerts: [alert] }), correlationId: 'c-1' })
        ).rejects.toThrow('db down');
        expect(h.state.rolledBack).toBe(1);
        expect(h.enqueue).not.toHaveBeenCalled();
    });

    it('still PERSISTS the run, as failed, with its provider ids when nobody can be told, then fails', async () => {
        h.listSuperAdminRecipients.mockResolvedValue([]);
        await expect(
            closeWatchRun({ runId: 'run-1', run: run({ alerts: [alert] }), correlationId: 'c-1' })
        ).rejects.toThrow('stored as failed');
        // Committed, not rolled back: the run and the provider ids of what it created are kept.
        expect(h.state.committed).toBe(1);
        expect(h.state.rolledBack).toBe(0);
        expect(h.close).toHaveBeenCalledWith(
            expect.objectContaining({
                outcome: 'failed',
                reason: expect.stringContaining('ALERTS_NOT_DELIVERED'),
                measurements: expect.objectContaining({
                    M1: expect.objectContaining({ providerIds: ['pre-1'] })
                }),
                alerts: [{ ...alert, channel: null, recipients: 0 }]
            })
        );
        expect(h.enqueue).not.toHaveBeenCalled();
    });

    it('stores the reason and outcome of a run that did not complete', async () => {
        await closeWatchRun({
            runId: 'run-1',
            run: run({ outcome: 'aborted', reason: 'WRONG_ACCOUNT: x' }),
            correlationId: 'c-1'
        });
        expect(h.close.mock.calls[0]?.[0]).toMatchObject({
            outcome: 'aborted',
            reason: 'WRONG_ACCOUNT: x'
        });
    });

    it('says how many alerts the mail leaves out when there are more than it carries', async () => {
        h.listSuperAdminRecipients.mockResolvedValue([{ userId: 'u1', email: 'a@example.test' }]);
        const many = Array.from({ length: 130 }, (_value, index) => ({
            ...alert,
            measurementId: `RP${index}`
        }));
        await closeWatchRun({ runId: 'run-1', run: run({ alerts: many }), correlationId: 'c-1' });
        const payload = h.enqueue.mock.calls[0]?.[0].payload;
        expect(payload.alerts).toHaveLength(100);
        expect(payload.omitted).toBe(30);
        // The stored run keeps every alert.
        expect(h.close.mock.calls[0]?.[0].alerts).toHaveLength(130);
    });

    it('carries no omitted alerts at the limit', async () => {
        h.listSuperAdminRecipients.mockResolvedValue([{ userId: 'u1', email: 'a@example.test' }]);
        const exactly = Array.from({ length: 100 }, (_value, index) => ({
            ...alert,
            measurementId: `RP${index}`
        }));
        await closeWatchRun({
            runId: 'run-1',
            run: run({ alerts: exactly }),
            correlationId: 'c-1'
        });
        expect(h.enqueue.mock.calls[0]?.[0].payload.omitted).toBe(0);
    });
});

describe('readAcceptedBaseline', () => {
    beforeEach(() => vi.clearAllMocks());

    it('answers null when the owner accepted nothing yet', async () => {
        h.listBaselines.mockResolvedValue([]);
        await expect(readAcceptedBaseline({ account: 'sandbox' })).resolves.toBeNull();
        expect(h.listBaselines).toHaveBeenCalledWith({ account: 'sandbox' });
    });

    it('returns the accepted shapes by measurement id', async () => {
        h.listBaselines.mockResolvedValue([
            { measurementId: 'M1', shapes: { create: { $: 'object', id: 'string' } } },
            { measurementId: 'RP7', shapes: {} }
        ]);
        await expect(readAcceptedBaseline({ account: 'sandbox' })).resolves.toEqual({
            M1: { create: { $: 'object', id: 'string' } },
            RP7: {}
        });
    });

    it('skips an unreadable accepted baseline instead of stopping the battery', async () => {
        h.listBaselines.mockResolvedValue([
            { measurementId: 'M1', shapes: 5 },
            { measurementId: 'M2', shapes: { a: { $: 'object' } } }
        ]);
        await expect(readAcceptedBaseline({ account: 'sandbox' })).resolves.toEqual({
            M2: { a: { $: 'object' } }
        });
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
