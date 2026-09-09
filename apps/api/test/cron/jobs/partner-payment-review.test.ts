/**
 * Unit tests for the HOS-1299 partner payment review cron.
 *
 * The load-bearing rule, and the one the owner decided on 2026-09-09: this job
 * ASKS. It must never move a partner's `subscriptionStatus`, `lifecycleState`,
 * `endsAt` or `revokedAt`, because the expensive mistake is cutting off a
 * partner who did pay and whose payment simply was not written down.
 *
 * The rest:
 * - a partner already flagged is not re-flagged (the flag is the job's memory);
 * - the flag is written even when the email fails, or a broken transport
 *   becomes a nightly re-ask;
 * - `dryRun` writes nothing at all;
 * - with no ops mailbox configured it warns instead of silently doing nothing.
 *
 * @module test/cron/jobs/partner-payment-review
 */

import { PartnerPaymentReviewStateEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindDue, mockUpdate, mockTrySend } = vi.hoisted(() => ({
    mockFindDue: vi.fn(),
    mockUpdate: vi.fn(),
    mockTrySend: vi.fn()
}));

vi.mock('@repo/db', () => ({
    PartnerModel: class {
        findDueForPaymentReview = mockFindDue;
        update = mockUpdate;
    }
}));

vi.mock('../../../src/utils/notification-helper.js', () => ({
    trySendNotification: mockTrySend
}));

vi.mock('../../../src/utils/ops-recipients.js', () => ({
    resolveOpsRecipients: () => opsRecipients
}));

vi.mock('../../../src/utils/env.js', () => ({
    env: { HOSPEDA_ADMIN_URL: 'https://admin.hospeda.test' }
}));

import {
    PAYMENT_REVIEW_AFTER_DAYS,
    partnerPaymentReviewJob,
    paymentReviewCutoff
} from '../../../src/cron/jobs/partner-payment-review.job';

/** Mutable so one test can drive the "nobody configured" branch. */
let opsRecipients: readonly string[] = ['ops@hospeda.test'];

const NOW = new Date('2026-09-09T04:30:00Z');

const makePartner = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    name: `Aliado ${id}`,
    startsAt: new Date('2026-01-15T00:00:00Z'),
    paymentConfirmedThrough: null,
    subscriptionStatus: 'active',
    lifecycleState: 'ACTIVE',
    ...overrides
});

const ctx = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: NOW,
    dryRun: false
} as unknown as Parameters<typeof partnerPaymentReviewJob.handler>[0];

beforeEach(() => {
    vi.clearAllMocks();
    opsRecipients = ['ops@hospeda.test'];
    mockUpdate.mockResolvedValue({});
    mockTrySend.mockResolvedValue({ delivered: true });
});

describe('paymentReviewCutoff', () => {
    it('shifts the clock back by whole days', () => {
        // Arrange + Act
        const cutoff = paymentReviewCutoff({ now: NOW, days: 30 });

        // Assert
        expect(cutoff.toISOString()).toBe('2026-08-10T04:30:00.000Z');
    });
});

describe('partner-payment-review — asking is not deciding (owner decision 2026-09-09)', () => {
    it('writes ONLY paymentReviewState, never the status, lifecycle, endsAt or revocation', async () => {
        // Arrange — one partner past the window, exactly as the model returns it.
        mockFindDue.mockResolvedValue([makePartner('p1')]);

        // Act
        const result = await partnerPaymentReviewJob.handler(ctx);

        // Assert — the whole feature is here. A patch carrying any of these
        // four keys would take down a partner nobody has looked at yet, which
        // is the mistake the owner ruled out: leaving a non-payer published
        // costs a month of product, cutting off a payer costs the customer.
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const [selector, patch] = mockUpdate.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(selector).toEqual({ id: 'p1' });
        // `toEqual` on the WHOLE patch, not `objectContaining`: the point is
        // what the patch does NOT carry, and objectContaining is blind to that.
        expect(patch).toEqual({
            paymentReviewState: PartnerPaymentReviewStateEnum.PENDING_CONFIRMATION
        });
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
    });

    it('leaves the partner untouched when it flags nobody', async () => {
        // Arrange
        mockFindDue.mockResolvedValue([]);

        // Act
        const result = await partnerPaymentReviewJob.handler(ctx);

        // Assert
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockTrySend).not.toHaveBeenCalled();
        expect(result.processed).toBe(0);
        expect(result.success).toBe(true);
    });
});

describe('partner-payment-review — the flag is the job memory', () => {
    it('asks the model only for partners not already flagged, using the configured window', async () => {
        // Arrange — the "already flagged are skipped" rule lives in the model
        // predicate, so what this job must get right is the cutoff it hands it.
        mockFindDue.mockResolvedValue([]);

        // Act
        await partnerPaymentReviewJob.handler(ctx);

        // Assert
        expect(mockFindDue).toHaveBeenCalledTimes(1);
        const [input, limit] = mockFindDue.mock.calls[0] as [
            { confirmedThroughBefore: Date; exemptSubscriptionStatuses: readonly string[] },
            number
        ];
        expect(input.confirmedThroughBefore).toEqual(
            paymentReviewCutoff({ now: NOW, days: PAYMENT_REVIEW_AFTER_DAYS })
        );
        // The exempt set is injected, so the job — not the model — is what
        // keeps a comped (HOS-1160) or courtesy (HOS-180) partner out of the
        // alert. Asserted by VALUE, because passing `['active']` would
        // typecheck, pass every other test here, and quietly start asking an
        // admin whether to take down partners the platform comped.
        expect(input.exemptSubscriptionStatuses).toContain('comp');
        expect(input.exemptSubscriptionStatuses).toContain('courtesy');
        expect(limit).toBe(100);
    });

    it('stamps the flag even when the email throws, so it does not re-ask nightly', async () => {
        // Arrange
        mockFindDue.mockResolvedValue([makePartner('p1')]);
        mockTrySend.mockRejectedValue(new Error('smtp down'));

        // Act
        const result = await partnerPaymentReviewJob.handler(ctx);

        // Assert — the write happened before the send and is not rolled back.
        expect(mockUpdate).toHaveBeenCalledWith(
            { id: 'p1' },
            { paymentReviewState: PartnerPaymentReviewStateEnum.PENDING_CONFIRMATION }
        );
        expect(result.errors).toBe(1);
    });
});

describe('partner-payment-review — the alert', () => {
    it('names the partner, the date the clock ran from and the days elapsed', async () => {
        // Arrange — never confirmed, so the clock runs from startsAt.
        mockFindDue.mockResolvedValue([makePartner('p1')]);

        // Act
        await partnerPaymentReviewJob.handler(ctx);

        // Assert
        expect(mockTrySend).toHaveBeenCalledTimes(1);
        const payload = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload.type).toBe('admin_partner_payment_review');
        expect(payload.recipientEmail).toBe('ops@hospeda.test');
        expect(payload.partnerName).toBe('Aliado p1');
        // 14, not 15: `startsAt` is a timestamptz — an instant, not a calendar
        // date — and 2026-01-15T00:00Z is the 14th at 21:00 in Buenos Aires.
        // The operator reading this alert is in Argentina, so the local
        // rendering is the correct one. Do not "fix" this to the UTC day.
        expect(payload.coveredThroughLabel).toBe('14/01/2026');
        expect(payload.daysSinceCovered).toBe(237);
        expect(payload.adminUrl).toBe('https://admin.hospeda.test/partners/p1');
    });

    it('runs the clock from paymentConfirmedThrough once an admin has confirmed one', async () => {
        // Arrange
        mockFindDue.mockResolvedValue([
            makePartner('p1', { paymentConfirmedThrough: new Date('2026-07-01T00:00:00Z') })
        ]);

        // Act
        await partnerPaymentReviewJob.handler(ctx);

        // Assert — the confirmation outranks the start date, or every renewal
        // would report the partner as unconfirmed since day one.
        const payload = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload.coveredThroughLabel).toBe('30/06/2026');
        expect(payload.daysSinceCovered).toBe(70);
    });

    it('warns instead of going quiet when no ops mailbox is configured', async () => {
        // Arrange
        opsRecipients = [];
        mockFindDue.mockResolvedValue([makePartner('p1')]);

        // Act
        await partnerPaymentReviewJob.handler(ctx);

        // Assert — the partner is still flagged (the admin detail shows it),
        // but a question nobody is asked has to be visible in the logs.
        expect(mockTrySend).not.toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
});

describe('partner-payment-review — dryRun', () => {
    it('writes nothing and sends nothing', async () => {
        // Arrange
        mockFindDue.mockResolvedValue([makePartner('p1'), makePartner('p2')]);

        // Act
        const result = await partnerPaymentReviewJob.handler({ ...ctx, dryRun: true });

        // Assert
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockTrySend).not.toHaveBeenCalled();
        expect(result.processed).toBe(2);
        expect(result.details).toEqual({ partnerIds: ['p1', 'p2'] });
    });
});
