import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    emitBillingFact,
    unwiredBillingFacts
} from '../../../../src/services/billing/facts/billing-fact-sink.js';

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock('@repo/logger', () => ({ createLogger: () => ({ error: logError }) }));

describe('billing fact sink (TEST:1878:15, TEST:1878:19)', () => {
    const fact = {
        kind: 'CHECKOUT_ABANDONED' as const,
        userId: 'u1',
        vertical: VerticalEnum.ACCOMMODATION,
        subscriptionId: 's1',
        subscriptionClass: 'PRINCIPAL' as const,
        actorKind: 'SYSTEM' as const,
        occurredAt: new Date(),
        reason: 'WINDOW_EXPIRED' as const
    };
    it('does not propagate sink failures', () => {
        expect(() =>
            emitBillingFact({
                sink: {
                    emit: () => {
                        throw new Error('offline');
                    }
                },
                fact
            })
        ).not.toThrow();
    });
    it('uses the loud default when no sink is wired', () => {
        logError.mockClear();
        emitBillingFact({ fact });
        expect(logError).toHaveBeenCalledWith(
            { kind: 'CHECKOUT_ABANDONED', subscriptionId: 's1' },
            'Billing fact has no sink'
        );
        expect(() => unwiredBillingFacts.emit(fact)).not.toThrow();
    });
});
