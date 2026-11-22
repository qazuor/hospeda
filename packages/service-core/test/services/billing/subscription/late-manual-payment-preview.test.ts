import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queue: unknown[][] = [];
const conditions = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const facts = vi.hoisted(() => ({ readLateManualPaymentReturn: vi.fn() }));

function chain(): Record<string, unknown> {
    const node: Record<string, unknown> = {};
    for (const method of ['select', 'from', 'where', 'leftJoin', 'innerJoin'])
        node[method] = () => node;
    node.limit = async () => queue.shift() ?? [];
    return node;
}

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: () => ({
            transaction: async (cb: (tx: object) => Promise<unknown>) => cb(chain())
        })
    };
});
vi.mock('../../../../src/services/billing/subscription/late-payment-conditions', () => ({
    checkLatePaymentConditions: async () => conditions.value
}));
vi.mock(
    '../../../../src/services/billing/subscription/late-manual-payment-return-facts',
    () => facts
);

import {
    candidateManualPaymentPeriod,
    previewManualPaymentPeriod,
    resolveManualPaymentPeriodCase
} from '../../../../src/services/billing/subscription/manual-payment-reimputation';
import { previewLateManualPaymentRegistration } from '../../../../src/services/billing/subscription/register-late-manual-payment.service';

const PERIOD_START = new Date('2026-08-03T12:00:00.000Z');
const ADMIN = crypto.randomUUID();
const OWNER = crypto.randomUUID();
const SUBSCRIPTION = crypto.randomUUID();
const INSTALLMENT = crypto.randomUUID();

function seedRows() {
    queue.push(
        [
            {
                id: SUBSCRIPTION,
                userId: OWNER,
                vertical: 'partner',
                planVersionId: crypto.randomUUID(),
                paymentMethod: 'MANUAL',
                class: 'PRINCIPAL',
                status: 'SUSPENDED',
                billingOptionId: crypto.randomUUID(),
                graceStartedAt: null
            }
        ],
        [
            {
                id: INSTALLMENT,
                subscriptionId: SUBSCRIPTION,
                status: 'DECLARED_UNPAID',
                periodStart: PERIOD_START
            }
        ],
        [{ cycle: 'monthly', amount: 100000, currency: 'ARS' }]
    );
}

const request = {
    actor: {
        id: ADMIN,
        roles: [RoleEnum.SUPER_ADMIN],
        permissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]
    },
    subscriptionId: SUBSCRIPTION,
    manualPaymentId: INSTALLMENT
};

beforeEach(() => {
    queue.length = 0;
    vi.clearAllMocks();
    facts.readLateManualPaymentReturn.mockResolvedValue({
        presence: { kind: 'PARTNER', partner: null, outcome: 'NO_PARTNER' },
        s7Effects: {
            complements: { resumed: [], skipped: [] },
            touristVip: { cancels: false, subscriptionIds: [] },
            scheduledChange: null
        }
    });
});

describe('HOS-1640 MP4 period: the three answers of fila 10-bis', () => {
    it('WITHIN_PERIOD: the own period had not ended, so it pays that period', () => {
        // Arrange
        const now = new Date('2026-08-20T12:00:00.000Z');

        // Act
        const candidate = candidateManualPaymentPeriod({
            originalPeriodStart: PERIOD_START,
            everyMonths: 1,
            now
        });

        // Assert
        expect(candidate).toEqual({
            periodStart: PERIOD_START,
            reimputedFrom: null,
            nextChargeAt: new Date('2026-09-03T12:00:00.000Z')
        });
        expect(resolveManualPaymentPeriodCase({ candidate, chosen: candidate })).toBe(
            'WITHIN_PERIOD'
        );
    });

    it('ORIGINAL_PERIOD: S19 always covers the original period, even when it already ended', () => {
        // Arrange
        const candidate = candidateManualPaymentPeriod({
            originalPeriodStart: PERIOD_START,
            everyMonths: 1,
            now: PERIOD_START
        });

        // Act
        const periodCase = resolveManualPaymentPeriodCase({
            candidate,
            chosen: candidate,
            atOriginalPeriod: true
        });

        // Assert
        expect(periodCase).toBe('ORIGINAL_PERIOD');
    });

    it('REIMPUTED: the own period had ended, so it pays the period starting now, next in one cycle', async () => {
        // Arrange
        const now = new Date('2026-10-10T12:00:00.000Z');
        queue.push([]);

        // Act
        const period = await previewManualPaymentPeriod({
            tx: chain() as never,
            subscriptionId: SUBSCRIPTION,
            originalPeriodStart: PERIOD_START,
            everyMonths: 1,
            now
        });

        // Assert
        expect(period).toEqual({
            periodStart: now,
            reimputedFrom: PERIOD_START,
            nextChargeAt: new Date('2026-11-10T12:00:00.000Z'),
            periodCase: 'REIMPUTED'
        });
    });

    it('C5_FALLBACK: the reimputed period is already covered, so it goes back to the original', async () => {
        // Arrange
        const now = new Date('2026-10-10T12:00:00.000Z');
        queue.push([{ id: 'covered' }], []);

        // Act
        const period = await previewManualPaymentPeriod({
            tx: chain() as never,
            subscriptionId: SUBSCRIPTION,
            originalPeriodStart: PERIOD_START,
            everyMonths: 1,
            now
        });

        // Assert
        expect(period).toEqual({
            periodStart: PERIOD_START,
            reimputedFrom: null,
            nextChargeAt: new Date('2026-09-03T12:00:00.000Z'),
            periodCase: 'C5_FALLBACK'
        });
        expect(period.nextChargeAt.getTime()).toBeLessThan(now.getTime());
    });
});

describe('HOS-1640 MP4 preview composition', () => {
    it('S7: reads presence and the three effects, and flags an overdue next charge after C5', async () => {
        // Arrange
        seedRows();
        queue.push([{ id: 'covered' }], []);
        conditions.value = { ok: true };
        const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };

        // Act
        const preview = await previewLateManualPaymentRegistration(request, { clock });

        // Assert
        expect(preview).toMatchObject({
            effect: 'S7',
            periodCase: 'C5_FALLBACK',
            nextChargeOverdue: true,
            reimputedPeriodStart: null,
            vertical: 'partner',
            presence: { kind: 'PARTNER', outcome: 'NO_PARTNER' },
            s7Effects: { scheduledChange: null }
        });
        expect(facts.readLateManualPaymentReturn).toHaveBeenCalledOnce();
    });

    it('S19: does not reactivate, pays the original period, and leaves the rest to the close', async () => {
        // Arrange
        seedRows();
        queue.push([]);
        conditions.value = { retainedForS19: true };
        const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };

        // Act
        const preview = await previewLateManualPaymentRegistration(request, { clock });

        // Assert
        expect(preview).toMatchObject({
            effect: 'S19',
            periodStart: PERIOD_START,
            reimputedPeriodStart: null,
            periodCase: 'ORIGINAL_PERIOD',
            nextChargeOverdue: true,
            nextChargeAt: new Date('2026-09-03T12:00:00.000Z'),
            presence: null,
            s7Effects: null
        });
        expect(facts.readLateManualPaymentReturn).not.toHaveBeenCalled();
    });

    it('keeps MP4 rejections: a failed condition answers MANUAL_PAYMENT_CONDITION_FAILED', async () => {
        // Arrange
        seedRows();
        conditions.value = { ok: false };
        const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };

        // Act
        const attempt = previewLateManualPaymentRegistration(request, { clock });

        // Assert
        await expect(attempt).rejects.toMatchObject({ reason: 'MANUAL_PAYMENT_CONDITION_FAILED' });
    });
});
