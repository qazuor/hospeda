import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    LIVE_SUBSCRIPTION_STATUSES: [
        'PENDING_AUTHORIZATION',
        'ACTIVE',
        'GRACE_PERIOD',
        'PAUSED',
        'SUSPENDED',
        'CANCEL_SCHEDULED'
    ]
}));

import { LIVE_SUBSCRIPTION_STATUSES } from '@repo/db';
import {
    DECLINED_SIGNUP_NOTICE_DAYS,
    type DeclinedSignupCandidateRow,
    deriveDeclinedSignupsForPage,
    selectDeclinedSignupNotices,
    selectExpiredDeclinedSignups
} from '../../../../src/services/billing/subscription/declined-signup-notices';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const DAY = 86_400_000;
const row = (overrides: Partial<DeclinedSignupCandidateRow> = {}): DeclinedSignupCandidateRow => ({
    id: '00000000-0000-4000-8000-000000000001',
    vertical: 'accommodation',
    status: 'CHARGE_DECLINED',
    succeedsId: null,
    createdAt: new Date(NOW.getTime() - DAY),
    updatedAt: new Date(NOW.getTime() - DAY),
    billingOptionId: '00000000-0000-4000-8000-000000000002',
    declaredPayerEmail: 'payer@example.test',
    planSlug: 'basic',
    planName: 'Basic',
    ...overrides
});

describe('HOS-2064 selectDeclinedSignupNotices', () => {
    it('shows a declined signup from less than seven days ago with no live subscription', () => {
        // Arrange
        const candidate = row();
        // Act
        const result = selectDeclinedSignupNotices({ rows: [candidate], now: NOW });
        // Assert
        expect(result).toEqual([
            {
                subscriptionId: candidate.id,
                vertical: candidate.vertical,
                billingOptionId: candidate.billingOptionId,
                declaredPayerEmail: candidate.declaredPayerEmail,
                declinedAt: candidate.updatedAt,
                plan: { slug: candidate.planSlug, name: candidate.planName }
            }
        ]);
    });

    it('hides it once seven days have passed since the decline', () => {
        // Arrange
        const exactlySevenDays = row({
            updatedAt: new Date(NOW.getTime() - DECLINED_SIGNUP_NOTICE_DAYS * DAY)
        });
        const oneMillisecondInside = row({
            updatedAt: new Date(NOW.getTime() - DECLINED_SIGNUP_NOTICE_DAYS * DAY + 1)
        });
        // Act
        const hidden = selectDeclinedSignupNotices({ rows: [exactlySevenDays], now: NOW });
        const shown = selectDeclinedSignupNotices({ rows: [oneMillisecondInside], now: NOW });
        // Assert
        expect(hidden).toEqual([]);
        expect(shown).toHaveLength(1);
    });

    it.each(
        LIVE_SUBSCRIPTION_STATUSES
    )('hides it when the vertical has a live subscription: %s', (status) => {
        // Arrange
        const declined = row();
        const live = row({
            id: '00000000-0000-4000-8000-000000000003',
            status,
            createdAt: NOW,
            succeedsId: declined.id
        });
        // Act
        const result = selectDeclinedSignupNotices({ rows: [declined, live], now: NOW });
        // Assert
        expect(result).toEqual([]);
    });

    it('hides it when a newer signup attempt exists, even an abandoned one', () => {
        // Arrange
        const declined = row({
            createdAt: new Date(NOW.getTime() - 2 * DAY),
            updatedAt: new Date(NOW.getTime() - DAY)
        });
        const abandoned = row({
            id: '00000000-0000-4000-8000-000000000003',
            status: 'ABANDONED',
            createdAt: NOW,
            updatedAt: new Date(NOW.getTime() - 2 * DAY)
        });
        // Act
        const result = selectDeclinedSignupNotices({ rows: [declined, abandoned], now: NOW });
        // Assert
        expect(result).toEqual([]);
    });

    it('ignores succession rows when picking the last signup attempt', () => {
        // Arrange
        const cancelled = row({ status: 'CANCELLED' });
        const successor = row({
            id: '00000000-0000-4000-8000-000000000003',
            succeedsId: cancelled.id,
            createdAt: NOW
        });
        // Act
        const result = selectDeclinedSignupNotices({ rows: [cancelled, successor], now: NOW });
        // Assert
        expect(result).toEqual([]);
    });

    it('returns one notice per vertical, ordered by vertical', () => {
        // Arrange
        const tourist = row({ vertical: 'tourist' });
        const accommodation = row({ vertical: 'accommodation' });
        // Act
        const result = selectDeclinedSignupNotices({ rows: [tourist, accommodation], now: NOW });
        // Assert
        expect(result.map((notice) => notice.vertical)).toEqual(['accommodation', 'tourist']);
    });

    it('skips a declined row without a billing option', () => {
        // Arrange
        const candidate = row({ billingOptionId: null });
        // Act
        const result = selectDeclinedSignupNotices({ rows: [candidate], now: NOW });
        // Assert
        expect(result).toEqual([]);
    });
});

describe('HOS-2193 selectExpiredDeclinedSignups', () => {
    const OLD = new Date(NOW.getTime() - DECLINED_SIGNUP_NOTICE_DAYS * DAY);

    it('lists a declined signup once its seven days have passed, with the plan and vertical', () => {
        // Arrange
        const candidate = row({ updatedAt: OLD, createdAt: OLD });
        // Act
        const result = selectExpiredDeclinedSignups({ rows: [candidate], now: NOW });
        // Assert
        expect(result).toEqual([
            {
                subscriptionId: candidate.id,
                vertical: 'accommodation',
                declinedAt: OLD,
                plan: { slug: 'basic', name: 'Basic' }
            }
        ]);
    });

    it('does not list a decline still inside the window: the retry notice owns it', () => {
        // Arrange
        const inside = row({ updatedAt: new Date(OLD.getTime() + 1) });
        // Act
        const expired = selectExpiredDeclinedSignups({ rows: [inside], now: NOW });
        const retry = selectDeclinedSignupNotices({ rows: [inside], now: NOW });
        // Assert
        expect(expired).toEqual([]);
        expect(retry).toHaveLength(1);
    });

    it('is the exact complement of the retry notice at the boundary', () => {
        // Arrange
        const boundary = row({ updatedAt: OLD });
        // Act
        const expired = selectExpiredDeclinedSignups({ rows: [boundary], now: NOW });
        const retry = selectDeclinedSignupNotices({ rows: [boundary], now: NOW });
        // Assert
        expect(expired).toHaveLength(1);
        expect(retry).toEqual([]);
    });

    it('lists it even when the declined row has no billing option', () => {
        // Arrange
        const candidate = row({ updatedAt: OLD, createdAt: OLD, billingOptionId: null });
        // Act
        const result = selectExpiredDeclinedSignups({ rows: [candidate], now: NOW });
        // Assert
        expect(result.map((notice) => notice.subscriptionId)).toEqual([candidate.id]);
    });

    it.each(
        LIVE_SUBSCRIPTION_STATUSES
    )('hides it when the same vertical has a live subscription: %s', (status) => {
        // Arrange
        const declined = row({ updatedAt: OLD, createdAt: OLD });
        const live = row({
            id: '00000000-0000-4000-8000-000000000003',
            status,
            createdAt: NOW
        });
        // Act
        const result = selectExpiredDeclinedSignups({ rows: [declined, live], now: NOW });
        // Assert
        expect(result).toEqual([]);
    });

    it('hides it when a newer attempt exists in that vertical, even an abandoned one', () => {
        // Arrange
        const declined = row({ updatedAt: OLD, createdAt: OLD });
        const abandoned = row({
            id: '00000000-0000-4000-8000-000000000003',
            status: 'ABANDONED',
            createdAt: NOW,
            updatedAt: OLD
        });
        // Act
        const result = selectExpiredDeclinedSignups({ rows: [declined, abandoned], now: NOW });
        // Assert
        expect(result).toEqual([]);
    });

    it('does not let another vertical live subscription hide it', () => {
        // Arrange
        const declined = row({ updatedAt: OLD, createdAt: OLD, vertical: 'venue' });
        const liveElsewhere = row({
            id: '00000000-0000-4000-8000-000000000003',
            vertical: 'accommodation',
            status: 'ACTIVE',
            createdAt: NOW
        });
        // Act
        const result = selectExpiredDeclinedSignups({
            rows: [declined, liveElsewhere],
            now: NOW
        });
        // Assert
        expect(result.map((notice) => notice.vertical)).toEqual(['venue']);
    });

    it('ignores rows that are not declined and orders by vertical', () => {
        // Arrange
        const cancelled = row({ status: 'CANCELLED', updatedAt: OLD, createdAt: OLD });
        const tourist = row({
            id: '00000000-0000-4000-8000-000000000003',
            vertical: 'tourist',
            updatedAt: OLD,
            createdAt: OLD
        });
        const venue = row({
            id: '00000000-0000-4000-8000-000000000004',
            vertical: 'venue',
            updatedAt: OLD,
            createdAt: OLD
        });
        // Act
        const result = selectExpiredDeclinedSignups({
            rows: [venue, cancelled, tourist],
            now: NOW
        });
        // Assert
        expect(result.map((notice) => notice.vertical)).toEqual(['tourist', 'venue']);
    });

    it('never puts the same row in both lists for the same rows and instant, at the exact boundary', () => {
        // Arrange: one row per millisecond around the seven-day edge, each in its own vertical
        const verticals = ['accommodation', 'venue', 'experience', 'tourist', 'partner'];
        const offsets = [-2, -1, 0, 1, 2];
        const rows = offsets.map((offset, index) =>
            row({
                id: `00000000-0000-4000-8000-00000000010${index}`,
                vertical: verticals[index] ?? 'accommodation',
                updatedAt: new Date(OLD.getTime() + offset),
                createdAt: new Date(OLD.getTime() + offset)
            })
        );
        // Act
        const derived = deriveDeclinedSignupsForPage({ rows, now: NOW });
        const retry = derived.retry.map((notice) => notice.subscriptionId);
        const expired = derived.expired.map((notice) => notice.subscriptionId);
        // Assert: strictly inside the window -> retry, at or past the edge -> expired
        expect([...retry].sort()).toEqual([rows[3]?.id, rows[4]?.id].sort());
        expect([...expired].sort()).toEqual([rows[0]?.id, rows[1]?.id, rows[2]?.id].sort());
        expect(retry.filter((id) => expired.includes(id))).toEqual([]);
        expect(retry.length + expired.length).toBe(rows.length);
    });
});
