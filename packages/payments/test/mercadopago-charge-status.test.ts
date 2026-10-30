/**
 * HOS-1724 follow-up: Mercado Pago documents nine payment statuses. The
 * adapter used to throw on three of them (`authorized`, `in_mediation`,
 * `cancelled`), and the sweep's charge listing has no catch, so one such
 * payment made the whole subscription unreadable. None of the three is a
 * collection we may count, and none is a decline we may act on, so all three
 * read as `pending`: never paid, never a reason to enter grace or expire.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';

const clock = createAdjustableClock({ start: new Date('2026-10-21T03:00:00.000Z') });

/** A recurring payment with no authorization link, so the read needs no window lookup. */
const payment = {
    id: 2001,
    date_created: '2026-10-20T19:12:00.000-04:00',
    external_reference: '00000000-0000-4000-8000-000000000001',
    metadata: {},
    point_of_interaction: null,
    status_detail: 'by_collector',
    transaction_amount: 18000,
    currency_id: 'ARS',
    transaction_amount_refunded: 0
};

/** An adapter that answers the payment read with the given status. */
function adapterReading({ status }: { readonly status: string }): MercadoPagoPaymentProvider {
    return new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'token',
        fetch: async () => new Response(JSON.stringify({ ...payment, status }))
    });
}

describe('HOS-1724 documented payment statuses that are neither collected nor declined', () => {
    it.each([
        ['cancelled', 'cancelled before collection'],
        ['authorized', 'reserved but not captured'],
        ['in_mediation', 'disputed, money held']
    ])('reads %s (%s) as pending, never approved or rejected', async (status) => {
        // Arrange
        const provider = adapterReading({ status });

        // Act
        const read = await provider.readCharge({ chargeId: '2001' });

        // Assert
        expect(read.snapshot.status).toBe('pending');
        expect(read.snapshot.declineReason).toBeNull();
        expect(read.snapshot.chargedBack).toBe(false);
    });

    it.each([
        ['pending', 'pending'],
        ['in_process', 'pending'],
        ['approved', 'approved'],
        ['rejected', 'rejected'],
        ['refunded', 'approved'],
        ['charged_back', 'approved']
    ])('keeps mapping %s to %s', async (status, expected) => {
        // Arrange
        const provider = adapterReading({ status });

        // Act
        const read = await provider.readCharge({ chargeId: '2001' });

        // Assert
        expect(read.snapshot.status).toBe(expected);
    });

    it('still fails closed on a status Mercado Pago does not document', async () => {
        // Arrange
        const provider = adapterReading({ status: 'refunded_partially' });

        // Act
        const read = provider.readCharge({ chargeId: '2001' });

        // Assert
        await expect(read).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });
});
