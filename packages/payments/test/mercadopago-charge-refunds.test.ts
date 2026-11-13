import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';

const clock = createAdjustableClock({ start: new Date('2026-10-20T00:00:00.000Z') });
const base = {
    id: 123,
    date_created: '2026-09-15T17:20:02.000-04:00',
    external_reference: 'cycle',
    metadata: {},
    point_of_interaction: { type: 'UNSPECIFIED' },
    status: 'refunded',
    status_detail: 'refunded',
    transaction_amount: 5000,
    currency_id: 'ARS',
    transaction_amount_refunded: 15
};

function adapterFor(payment: Record<string, unknown>) {
    return new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'test-token',
        fetch: async () =>
            new Response(JSON.stringify(payment), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
    });
}

describe('AC:B6:5 payment refunds read by id', () => {
    it('maps the measured numeric id, major amount and approved status', async () => {
        // Arrange
        const refund = {
            id: 3269585727,
            amount: 15,
            status: 'approved',
            source: { type: 'collector' }
        };
        // Act
        const read = await adapterFor({ ...base, refunds: [refund] }).readCharge({
            chargeId: '123'
        });
        // Assert
        expect(read.snapshot.refunds).toEqual([
            {
                refundId: '3269585727',
                amount: { amountMinor: 1500, currency: 'ARS' },
                accredited: true
            }
        ]);
    });

    it('reads seven partials whose sum matches the cumulative refund', async () => {
        // Arrange
        const amounts = [1000, 800, 700, 650, 600, 750, 500];
        const refunds = amounts.map((amount, index) => ({
            id: index + 1,
            amount,
            status: 'approved'
        }));
        // Act
        const read = await adapterFor({
            ...base,
            transaction_amount_refunded: 5000,
            refunds
        }).readCharge({ chargeId: '123' });
        // Assert
        expect(read.snapshot.refunds).toHaveLength(7);
        expect(read.snapshot.refunds.map((refund) => refund.refundId)).toEqual([
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7'
        ]);
        expect(read.snapshot.refunds.map((refund) => refund.amount.amountMinor)).toEqual(
            amounts.map((amount) => amount * 100)
        );
        expect(
            read.snapshot.refunds.reduce((sum, refund) => sum + refund.amount.amountMinor, 0)
        ).toBe(read.snapshot.refundedAmount.amountMinor);
    });

    it.each([
        [],
        null,
        undefined
    ])('reads empty, null, or absent refunds as empty (%s)', async (value) => {
        // Arrange
        const payment = value === undefined ? base : { ...base, refunds: value };
        // Act
        const read = await adapterFor(payment).readCharge({ chargeId: '123' });
        // Assert
        expect(read.snapshot.refunds).toEqual([]);
    });

    it('does not accredit an unmeasured in_process status', async () => {
        // Arrange
        const refunds = [{ id: 'r-1', amount: 15, status: 'in_process' }];
        // Act
        const read = await adapterFor({ ...base, refunds }).readCharge({ chargeId: '123' });
        // Assert
        expect(read.snapshot.refunds).toEqual([
            { refundId: 'r-1', amount: { amountMinor: 1500, currency: 'ARS' }, accredited: false }
        ]);
    });

    it('converts a decimal major amount to minor units', async () => {
        // Arrange
        const refunds = [{ id: 9, amount: 4875.5, status: 'approved' }];
        // Act
        const read = await adapterFor({ ...base, refunds }).readCharge({ chargeId: '123' });
        // Assert
        expect(read.snapshot.refunds[0]).toEqual({
            refundId: '9',
            amount: { amountMinor: 487550, currency: 'ARS' },
            accredited: true
        });
    });
});
