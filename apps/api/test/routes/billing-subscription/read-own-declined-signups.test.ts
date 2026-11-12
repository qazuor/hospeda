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
    selectDeclinedSignupNotices
} from '../../../src/routes/billing-subscription/read-own-declined-signups';

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
        const live = row({ id: '00000000-0000-4000-8000-000000000003', status, createdAt: NOW });
        // Act
        const result = selectDeclinedSignupNotices({ rows: [declined, live], now: NOW });
        // Assert
        expect(result).toEqual([]);
    });

    it('hides it when a newer signup attempt exists, even an abandoned one', () => {
        // Arrange
        const declined = row();
        const abandoned = row({
            id: '00000000-0000-4000-8000-000000000003',
            status: 'ABANDONED',
            createdAt: NOW
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
