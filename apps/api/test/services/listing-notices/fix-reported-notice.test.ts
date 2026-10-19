import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn() }));
vi.mock('@repo/db', async (importOriginal) => await importOriginal<Record<string, unknown>>());
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: mocks.error, warn: mocks.warn }
}));

import { buildEmailDedupKey, buildEventOccurrence } from '@repo/db';
import {
    enqueueFixReportedNotice,
    LISTING_FIX_REPORTED_TEMPLATE
} from '../../../src/services/listing-notices/fix-reported-notice';

const FIX = {
    id: 'fix-1',
    reason: 'Falta horario',
    suggestedDate: '2026-10-20',
    openedAt: new Date('2026-10-10T12:00:00.000Z')
};
const input = {
    tx: {
        transaction: async (work: (tx: unknown) => Promise<unknown>) => work('savepoint')
    } as never,
    vertical: 'gastronomy' as import('@repo/verticals').ListingVertical,
    listingId: 'listing-1',
    ownerId: 'owner-1',
    fixRequest: FIX,
    reportedAt: new Date('2026-10-13T12:00:00.000Z')
};
const recipients = [
    { userId: 'admin-1', email: 'one@example.test' },
    { userId: 'admin-2', email: 'two@example.test' }
];

describe('TEST:1701:6 AC:1701:1 AC:1701:2 AC:1701:3 enqueueFixReportedNotice', () => {
    beforeEach(() => vi.clearAllMocks());

    it('enqueues one complete mail per staff recipient in the savepoint', async () => {
        const enqueue = vi.fn(async () => ({ enqueued: true, row: null }));
        const result = await enqueueFixReportedNotice(input, {
            recipients: { list: async () => recipients },
            enqueue
        });
        expect(result).toEqual({ status: 'ENQUEUED', enqueued: 2, recipients: 2 });
        expect(enqueue).toHaveBeenNthCalledWith(
            1,
            {
                recipientUserId: 'admin-1',
                recipientEmail: 'one@example.test',
                template: LISTING_FIX_REPORTED_TEMPLATE,
                payload: {
                    vertical: 'gastronomy',
                    listingId: 'listing-1',
                    ownerId: 'owner-1',
                    fixRequestId: 'fix-1',
                    reason: 'Falta horario',
                    suggestedDate: '2026-10-20',
                    requestedAt: '2026-10-10T12:00:00.000Z',
                    reportedAt: '2026-10-13T12:00:00.000Z'
                },
                dedupKey: buildEmailDedupKey({
                    recipient: 'admin-1',
                    template: LISTING_FIX_REPORTED_TEMPLATE,
                    occurrence: 'event:fix-1'
                }),
                correlationId: null
            },
            'savepoint'
        );
        expect(enqueue).toHaveBeenNthCalledWith(
            2,
            {
                recipientUserId: 'admin-2',
                recipientEmail: 'two@example.test',
                template: LISTING_FIX_REPORTED_TEMPLATE,
                payload: {
                    vertical: 'gastronomy',
                    listingId: 'listing-1',
                    ownerId: 'owner-1',
                    fixRequestId: 'fix-1',
                    reason: 'Falta horario',
                    suggestedDate: '2026-10-20',
                    requestedAt: '2026-10-10T12:00:00.000Z',
                    reportedAt: '2026-10-13T12:00:00.000Z'
                },
                dedupKey: buildEmailDedupKey({
                    recipient: 'admin-2',
                    template: LISTING_FIX_REPORTED_TEMPLATE,
                    occurrence: 'event:fix-1'
                }),
                correlationId: null
            },
            'savepoint'
        );
    });

    it('deduplicates by request id regardless of reported instant', async () => {
        const keys: string[] = [];
        const enqueue = vi.fn(async (mail: { dedupKey: string }) => {
            keys.push(mail.dedupKey);
            return { enqueued: true, row: null };
        });
        const ports = { recipients: { list: async () => [recipients[0]!] }, enqueue };
        await enqueueFixReportedNotice(input, ports);
        await enqueueFixReportedNotice(
            { ...input, reportedAt: new Date('2026-10-14T12:00:00.000Z') },
            ports
        );
        expect(keys).toEqual([
            buildEmailDedupKey({
                recipient: 'admin-1',
                template: LISTING_FIX_REPORTED_TEMPLATE,
                occurrence: buildEventOccurrence({ eventId: FIX.id })
            }),
            keys[0]
        ]);
    });

    it('returns NO_RECIPIENTS and warns when staff is absent', async () => {
        const enqueue = vi.fn();
        expect(
            await enqueueFixReportedNotice(input, { recipients: { list: async () => [] }, enqueue })
        ).toEqual({ status: 'NO_RECIPIENTS' });
        expect(mocks.warn).toHaveBeenCalled();
        expect(enqueue).not.toHaveBeenCalled();
    });

    it('returns ENQUEUE_FAILED and logs recipient lookup failures', async () => {
        const error = new Error('lookup failed');
        expect(
            await enqueueFixReportedNotice(input, {
                recipients: {
                    list: async () => {
                        throw error;
                    }
                }
            })
        ).toEqual({ status: 'ENQUEUE_FAILED' });
        expect(mocks.error).toHaveBeenCalledWith(
            { fixRequestId: FIX.id, listingId: input.listingId, vertical: input.vertical, error },
            'Could not enqueue listing fix-reported notice'
        );
    });

    it('returns ENQUEUE_FAILED when an enqueue fails', async () => {
        const enqueue = vi
            .fn()
            .mockResolvedValueOnce({ enqueued: true, row: null })
            .mockRejectedValueOnce(new Error('failed'));
        expect(
            await enqueueFixReportedNotice(input, {
                recipients: { list: async () => recipients },
                enqueue
            })
        ).toEqual({ status: 'ENQUEUE_FAILED' });
        expect(mocks.error).toHaveBeenCalled();
    });
});
