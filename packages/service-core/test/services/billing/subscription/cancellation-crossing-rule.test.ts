import { describe, expect, it } from 'vitest';
import {
    classifyCancellationCrossing,
    crossingExtensionEnd,
    crossingMarkDetail
} from '../../../../src/services/billing/subscription/cancellation-crossing-rule';

const t0 = new Date('2026-10-01T00:00:00Z');
const t1 = new Date('2026-10-02T00:00:00Z');
const t2 = new Date('2026-10-03T00:00:00Z');
const decision = (transition: string, decidedAt = t1) => ({ transition, decidedAt });

type Case = {
    status: string;
    decision: { transition: string; decidedAt: Date } | null;
    factAt: Date;
    expected: string;
};
const cases: Case[] = [
    { status: 'CANCEL_SCHEDULED', decision: decision('S11'), factAt: t0, expected: 'EXTEND' },
    { status: 'CANCEL_SCHEDULED', decision: decision('S11'), factAt: t1, expected: 'MARK' },
    { status: 'CANCEL_SCHEDULED', decision: decision('S11'), factAt: t2, expected: 'MARK' },
    { status: 'CANCEL_SCHEDULED', decision: null, factAt: t0, expected: 'NONE' },
    { status: 'CANCEL_SCHEDULED', decision: decision('S12'), factAt: t0, expected: 'NONE' },
    { status: 'CANCEL_SCHEDULED', decision: decision('S36'), factAt: t2, expected: 'NONE' },
    ...(['S11', 'S23', 'S24'] as const).flatMap((transition) => [
        { status: 'CANCELLED', decision: decision(transition), factAt: t0, expected: 'MARK' },
        { status: 'CANCELLED', decision: decision(transition), factAt: t2, expected: 'MARK' }
    ]),
    ...(['S13', 'S20', 'S36', 'S3', 'S16', 'S22', 'S31'] as const).map((transition) => ({
        status: 'CANCELLED',
        decision: decision(transition),
        factAt: t2,
        expected: 'NONE'
    })),
    { status: 'CANCELLED', decision: null, factAt: t2, expected: 'NONE' },
    { status: 'LAPIDA', decision: decision('S11'), factAt: t0, expected: 'NONE' },
    ...(['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'PAUSED', 'PENDING_AUTHORIZATION'] as const).map(
        (status) => ({ status, decision: decision('S11'), factAt: t0, expected: 'NONE' })
    )
];

describe('classifyCancellationCrossing', () => {
    it.each(cases)('$status / $decision / $factAt => $expected', ({
        status,
        decision: d,
        factAt,
        expected
    }) => {
        expect(
            classifyCancellationCrossing({ status, class: 'PRINCIPAL', decision: d, factAt })
        ).toBe(expected);
    });
});

describe('crossingExtensionEnd', () => {
    it('extends only when formula is later', () => {
        expect(crossingExtensionEnd({ current: t1, formula: t2 })).toEqual({
            serviceEndsAt: t2,
            extended: true
        });
        expect(crossingExtensionEnd({ current: t2, formula: t1 })).toEqual({
            serviceEndsAt: t2,
            extended: false
        });
        expect(crossingExtensionEnd({ current: t2, formula: t2 })).toEqual({
            serviceEndsAt: t2,
            extended: false
        });
    });
});

describe('crossingMarkDetail', () => {
    const base = {
        chargeId: 'ch_1',
        amountMinor: 1200,
        currency: 'ARS',
        factAt: t1,
        graceStartedAt: t0
    };
    it('keeps field order and includes grace only for S24', () => {
        const s24 = crossingMarkDetail({ ...base, transition: 'S24' });
        expect(s24.map(({ field }) => field)).toEqual([
            'provider.charge_id',
            'provider.charge_amount_minor',
            'provider.charge_currency',
            'payment.fact_at',
            'subscription.cancellation_transition',
            'subscription.grace_started_at'
        ]);
        expect(s24[5]?.new).toBe(t0.toISOString());
        for (const transition of ['S11', 'S23'] as const)
            expect(
                crossingMarkDetail({ ...base, transition }).map(({ field }) => field)
            ).not.toContain('subscription.grace_started_at');
    });
});
