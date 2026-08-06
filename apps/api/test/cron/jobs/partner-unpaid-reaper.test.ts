/**
 * Unit tests for the HOS-278 R-3 unpaid-partner reaper.
 *
 * The rules worth breaking things over:
 * - it ARCHIVES, never deletes — nothing is destroyed by either stage;
 * - a partner past the archive cutoff is archived, NOT sent a nudge whose
 *   deadline already passed;
 * - the notice stamp is written even when the email fails, so a broken
 *   transport cannot turn into a nightly retry loop;
 * - `dryRun` writes nothing at all.
 *
 * @module test/cron/jobs/partner-unpaid-reaper
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindUnpaid, mockUpdate, mockSendNotification, mockSelectChain } = vi.hoisted(() => ({
    mockFindUnpaid: vi.fn(),
    mockUpdate: vi.fn(),
    mockSendNotification: vi.fn(),
    mockSelectChain: vi.fn()
}));

vi.mock('@repo/db', () => ({
    PartnerModel: class {
        findUnpaidProvisioned = mockFindUnpaid;
        update = mockUpdate;
    },
    getDb: () => ({ select: mockSelectChain }),
    users: { id: 'users.id', email: 'users.email', displayName: 'users.displayName' }
}));

vi.mock('drizzle-orm', () => ({ eq: (col: unknown, val: unknown) => ({ col, val }) }));

vi.mock('../../../src/utils/notification-helper.js', () => ({
    sendNotification: mockSendNotification
}));

import {
    cutoffFor,
    partnerUnpaidReaperJob,
    UNPAID_ARCHIVE_AFTER_DAYS,
    UNPAID_NOTICE_AFTER_DAYS
} from '../../../src/cron/jobs/partner-unpaid-reaper.job';

const NOW = new Date('2026-08-06T04:45:00Z');

const makePartner = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    name: `Partner ${id}`,
    ownerUserId: `owner-${id}`,
    ...overrides
});

/** A `getDb().select()` chain resolving to one owner row. */
function ownerRow(email: string | null) {
    return {
        from: () => ({
            where: () => ({
                limit: async () => (email === null ? [] : [{ email, displayName: 'Dueño' }])
            })
        })
    };
}

const ctx = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    startedAt: NOW,
    dryRun: false
};

beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockReturnValue(ownerRow('aliado@example.com'));
    mockUpdate.mockResolvedValue({});
    mockSendNotification.mockResolvedValue(undefined);
});

describe('cutoffFor', () => {
    it('shifts the clock back by whole days', () => {
        // Arrange + Act
        const cutoff = cutoffFor({ now: NOW, days: 30 });

        // Assert
        expect(NOW.getTime() - cutoff.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('uses a wider window for archiving than for the nudge', () => {
        // Arrange — if these were reversed the cron would archive partners it
        // had never warned, which is the one thing the two-stage design exists
        // to prevent.
        expect(UNPAID_ARCHIVE_AFTER_DAYS).toBeGreaterThan(UNPAID_NOTICE_AFTER_DAYS);
    });
});

describe('partner-unpaid-reaper — the two stages', () => {
    it('archives with lifecycleState and NEVER deletes', async () => {
        // Arrange
        mockFindUnpaid.mockImplementation(async ({ noticeState }: { noticeState: string }) =>
            noticeState === 'any' ? [makePartner('a')] : []
        );

        // Act
        const result = await partnerUnpaidReaperJob.handler(ctx as never);

        // Assert — nothing is destroyed by either stage; the row, the content
        // and the owner all survive and an admin can reverse it.
        expect(result.success).toBe(true);
        const patch = mockUpdate.mock.calls[0]?.[1];
        expect(patch).toEqual({ lifecycleState: 'ARCHIVED' });
        expect(patch).not.toHaveProperty('deletedAt');
    });

    it('nudges an un-notified partner and stamps the send', async () => {
        // Arrange
        mockFindUnpaid.mockImplementation(async ({ noticeState }: { noticeState: string }) =>
            noticeState === 'un-notified' ? [makePartner('b')] : []
        );

        // Act
        await partnerUnpaidReaperJob.handler(ctx as never);

        // Assert
        expect(mockUpdate.mock.calls[0]?.[1]).toHaveProperty('unpaidNoticeSentAt');
        expect(mockSendNotification).toHaveBeenCalledTimes(1);
        expect(mockSendNotification.mock.calls[0]?.[0]).toMatchObject({
            partnerName: 'Partner b',
            daysUntilArchive: UNPAID_ARCHIVE_AFTER_DAYS - UNPAID_NOTICE_AFTER_DAYS
        });
    });

    it('archives a partner past BOTH cutoffs instead of nudging it', async () => {
        // Arrange — the same row legitimately matches both queries: it is old
        // enough to archive and was never notified. Nudging it would promise a
        // deadline that has already passed, on a listing being archived in the
        // same tick.
        const stale = makePartner('c');
        mockFindUnpaid.mockResolvedValue([stale]);

        // Act
        await partnerUnpaidReaperJob.handler(ctx as never);

        // Assert
        expect(mockSendNotification).not.toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockUpdate.mock.calls[0]?.[1]).toEqual({ lifecycleState: 'ARCHIVED' });
    });
});

describe('partner-unpaid-reaper — resilience', () => {
    it('stamps the notice even when the email throws', async () => {
        // Arrange — a transport error must not become a nightly retry loop
        // against the same address. One missed notice beats thirty delivered.
        mockFindUnpaid.mockImplementation(async ({ noticeState }: { noticeState: string }) =>
            noticeState === 'un-notified' ? [makePartner('d')] : []
        );
        mockSendNotification.mockRejectedValue(new Error('transport down'));

        // Act
        const result = await partnerUnpaidReaperJob.handler(ctx as never);

        // Assert
        expect(mockUpdate.mock.calls[0]?.[1]).toHaveProperty('unpaidNoticeSentAt');
        expect(result.errors).toBe(1);
    });

    it('stamps and skips a partner with no owner, rather than reconsidering it nightly', async () => {
        // Arrange — curated rows and unclaimed applications have no account to
        // write to. Without the stamp they would be re-picked every night.
        mockFindUnpaid.mockImplementation(async ({ noticeState }: { noticeState: string }) =>
            noticeState === 'un-notified' ? [makePartner('e', { ownerUserId: null })] : []
        );

        // Act
        const result = await partnerUnpaidReaperJob.handler(ctx as never);

        // Assert
        expect(mockUpdate.mock.calls[0]?.[1]).toHaveProperty('unpaidNoticeSentAt');
        expect(mockSendNotification).not.toHaveBeenCalled();
        expect(result.errors).toBe(0);
    });

    it('keeps going after one failure instead of aborting the batch', async () => {
        // Arrange
        mockFindUnpaid.mockImplementation(async ({ noticeState }: { noticeState: string }) =>
            noticeState === 'any' ? [makePartner('f'), makePartner('g')] : []
        );
        mockUpdate.mockRejectedValueOnce(new Error('db blip')).mockResolvedValue({});

        // Act
        const result = await partnerUnpaidReaperJob.handler(ctx as never);

        // Assert
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        expect(result.errors).toBe(1);
        expect(result.processed).toBe(1);
    });

    it('writes NOTHING in dryRun', async () => {
        // Arrange
        mockFindUnpaid.mockResolvedValue([makePartner('h')]);

        // Act
        const result = await partnerUnpaidReaperJob.handler({ ...ctx, dryRun: true } as never);

        // Assert
        expect(result.success).toBe(true);
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockSendNotification).not.toHaveBeenCalled();
    });
});
