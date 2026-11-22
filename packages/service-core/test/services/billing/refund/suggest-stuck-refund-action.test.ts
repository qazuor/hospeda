/** HOS-2560: the advisory exit of a stuck refund mirrors what retry and remainder settlement accept. */
import { describe, expect, it } from 'vitest';
import { suggestStuckRefundAction } from '../../../../src/services/billing/refund/list-stuck-refunds.service';
import type {
    RefundCallRow,
    RefundCallTally
} from '../../../../src/services/billing/refund/refund-call-tally';

const NOW = new Date('2026-11-22T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

function call(overrides: Partial<RefundCallRow> = {}): RefundCallRow {
    return {
        idempotencyKey: crypto.randomUUID(),
        providerRefundId: null,
        addonInstanceId: null,
        amount: 10000,
        createdAt: hoursAgo(1),
        completedAt: null,
        result: null,
        ...overrides
    };
}

function tally(input: {
    unanswered?: readonly RefundCallRow[];
    accepted?: readonly RefundCallRow[];
}): RefundCallTally {
    const unanswered = input.unanswered ?? [];
    const accepted = input.accepted ?? [];
    return {
        calls: [...unanswered, ...accepted],
        acceptedIds: accepted.map((entry) => entry.providerRefundId as string),
        acceptedAmount: accepted.reduce((sum, entry) => sum + entry.amount, 0),
        awaitingProviderAnswer: unanswered.length > 0,
        unanswered
    };
}

const suggest = (t: RefundCallTally, refundAmount = 10000) =>
    suggestStuckRefundAction({ tally: t, refundAmount, now: NOW });

describe('suggestStuckRefundAction', () => {
    it('suggests the retry for a call with no answer sent less than 24 hours ago', () => {
        expect(suggest(tally({ unanswered: [call()] }))).toBe('RETRY');
    });

    it('keeps the retry while one unanswered call is fresh, even next to a stale one', () => {
        expect(suggest(tally({ unanswered: [call({ createdAt: hoursAgo(30) }), call()] }))).toBe(
            'RETRY'
        );
    });

    it('counts a call sent exactly 24 hours ago as the retry’s', () => {
        expect(suggest(tally({ unanswered: [call({ createdAt: hoursAgo(24) })] }))).toBe('RETRY');
    });

    it('suggests the remainder settlement once every unanswered call is past 24 hours', () => {
        expect(suggest(tally({ unanswered: [call({ createdAt: hoursAgo(30) })] }))).toBe(
            'SETTLE_REMAINDER'
        );
    });

    it('suggests the remainder settlement for a partial acceptance with nothing unanswered', () => {
        const accepted = call({ providerRefundId: 'prov-1', amount: 4000, completedAt: NOW });
        expect(suggest(tally({ accepted: [accepted] }))).toBe('SETTLE_REMAINDER');
    });

    it('suggests the retry (RF3 again) when everything was accepted but not credited', () => {
        const accepted = call({ providerRefundId: 'prov-1', completedAt: NOW });
        expect(suggest(tally({ accepted: [accepted] }))).toBe('RETRY');
    });

    it('suggests nothing for an unanswered order-channel call, which neither action takes', () => {
        expect(
            suggest(
                tally({
                    unanswered: [
                        call({ addonInstanceId: crypto.randomUUID(), createdAt: hoursAgo(30) })
                    ]
                })
            )
        ).toBeNull();
    });

    it('suggests nothing for a fresh call answered without an id: no exit until 24 hours pass', () => {
        const answered = call({ completedAt: NOW, result: { outcome: 'UNAVAILABLE' } });
        expect(suggest(tally({ unanswered: [answered] }))).toBeNull();
    });

    it('suggests nothing when no call was accepted or left unanswered', () => {
        expect(suggest(tally({}))).toBeNull();
    });
});
