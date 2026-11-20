/**
 * HOS-2406: the pure checks over a charge read. An accepted call counts only as a credited
 * provider refund in the payment's currency, for the amount the provider returned, and the
 * remainder must be one such refund of exactly the remainder.
 */
import { describe, expect, it } from 'vitest';
import {
    assertRemainderAtProvider,
    type ChargeRefundsRead,
    creditedAcceptedAmount
} from '../../../../src/services/billing/refund/refund-remainder-provider';

const read: ChargeRefundsRead = {
    currency: 'ARS',
    refunds: [
        { refundId: 'r-a', amount: { amountMinor: 1500, currency: 'ARS' }, accredited: true },
        { refundId: 'r-b', amount: { amountMinor: 2500, currency: 'ARS' }, accredited: true },
        { refundId: 'r-off', amount: { amountMinor: 700, currency: 'ARS' }, accredited: false },
        { refundId: 'r-usd', amount: { amountMinor: 2000, currency: 'USD' }, accredited: true },
        { refundId: 'r-rest', amount: { amountMinor: 2000, currency: 'ARS' }, accredited: true }
    ]
};

describe('creditedAcceptedAmount', () => {
    it('sums what the provider returned for every accepted id', () => {
        // Arrange
        const acceptedIds = ['r-a', 'r-b'];

        // Act
        const sum = creditedAcceptedAmount({ read, acceptedIds, currency: 'ARS' });

        // Assert
        expect(sum).toBe(4000);
    });

    it.each([
        ['absent', 'r-ghost'],
        ['not credited', 'r-off'],
        ['in another currency', 'r-usd']
    ])('rejects an accepted id that is %s', (_label, refundId) => {
        // Act
        const run = () =>
            creditedAcceptedAmount({ read, acceptedIds: ['r-a', refundId], currency: 'ARS' });

        // Assert
        expect(run).toThrow(expect.objectContaining({ reason: 'ACCEPTED_PART_NOT_ACCREDITED' }));
    });
});

describe('assertRemainderAtProvider', () => {
    it('accepts a credited refund of exactly the remainder', () => {
        // Act
        const run = () =>
            assertRemainderAtProvider({
                read,
                reference: 'r-rest',
                remainder: 2000,
                currency: 'ARS'
            });

        // Assert
        expect(run).not.toThrow();
    });

    it.each([
        ['absent', 'r-ghost', 2000],
        ['not credited', 'r-off', 700],
        ['in another currency', 'r-usd', 2000],
        ['for another amount', 'r-rest', 1999]
    ])('rejects a reference that is %s', (_label, reference, remainder) => {
        // Act
        const run = () =>
            assertRemainderAtProvider({ read, reference, remainder, currency: 'ARS' });

        // Assert
        expect(run).toThrow(expect.objectContaining({ reason: 'REMAINDER_NOT_FOUND_AT_PROVIDER' }));
    });
});
