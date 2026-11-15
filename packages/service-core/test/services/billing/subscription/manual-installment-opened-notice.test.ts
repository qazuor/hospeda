import { describe, expect, it } from 'vitest';
import {
    buildManualInstallmentOpenedPayload,
    isManualInstallmentOwnerNotified,
    resolveInstallmentAmountSnapshot
} from '../../../../src/services/billing/subscription/manual-installment-opened-notice.js';

describe('HOS-2130 manual installment opened notice', () => {
    it('mails the owner only for verticals that pay manually', () => {
        // Arrange
        const verticals = ['partner', 'accommodation', 'venue', null] as const;
        // Act
        const results = verticals.map((vertical) => isManualInstallmentOwnerNotified({ vertical }));
        // Assert
        expect(results).toEqual([true, false, false, false]);
    });

    it('snapshots an ARS amount and drops what it cannot show', () => {
        // Arrange
        const ars = {
            kind: 'COMPARABLE',
            amountMinor: 3_000_000,
            currency: 'ARS',
            source: 'ANCHORED'
        } as const;
        const usd = { ...ars, currency: 'USD' } as const;
        const missing = { kind: 'NOT_COMPARABLE', reason: 'NO_ANCHOR' } as const;
        // Act
        const results = [ars, usd, missing].map((expected) =>
            resolveInstallmentAmountSnapshot({ expected })
        );
        // Assert
        expect(results).toEqual([{ amountMinor: 3_000_000, currency: 'ARS' }, null, null]);
    });

    it('builds the payload with ISO dates and a null amount pair', () => {
        // Arrange
        const dueAt = new Date('2026-10-16T02:00:00.000Z');
        // Act
        const payload = buildManualInstallmentOpenedPayload({
            manualPaymentId: 'manual-payment',
            subscriptionId: 'subscription',
            locale: 'es',
            planSlug: 'partner-gold',
            planName: 'Gold',
            amount: null,
            dueAt,
            firstInstallment: true
        });
        // Assert
        expect(payload).toEqual({
            manualPaymentId: 'manual-payment',
            subscriptionId: 'subscription',
            locale: 'es',
            planSlug: 'partner-gold',
            planName: 'Gold',
            amountMinor: null,
            currency: null,
            dueAt: '2026-10-16T02:00:00.000Z',
            firstInstallment: true
        });
    });
});
