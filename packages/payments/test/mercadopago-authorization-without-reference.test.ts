/**
 * HOS-1895: a preapproval without `external_reference` is foreign by
 * construction. Our own creation always sends the reference, so a missing one
 * can only belong to a third party (or to the legacy system). The adapter must
 * classify it as UNSUPPORTED before building a snapshot, so the notice service
 * ignores it (HOS-1777) instead of writing a receipt tombstone that would
 * cancel a third party's authorization.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';

const clock = createAdjustableClock({ start: new Date('2026-10-24T12:00:00.000Z') });

/** A preapproval read whose only difference between cases is `external_reference`. */
function preapproval() {
    return {
        id: 'foreign-preapproval',
        status: 'authorized',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 1500,
            currency_id: 'ARS',
            start_date: '2026-10-24T12:00:00.000-04:00'
        },
        summarized: null,
        last_modified: '2026-10-24T12:00:00.000-04:00',
        next_payment_date: '2026-11-24T12:00:00.000-04:00',
        init_point: 'https://example.invalid/subscriptions/checkout'
    };
}

/** Builds an adapter whose only transport answers the preapproval read with `body`. */
function adapterAnswering(body: unknown): MercadoPagoPaymentProvider {
    return new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'token',
        fetch: async () => new Response(JSON.stringify(body))
    });
}

describe('HOS-1895 a preapproval without external_reference', () => {
    it.each([
        { label: 'absent', reference: undefined },
        { label: 'null', reference: null },
        { label: 'empty', reference: '' },
        { label: 'blank', reference: '   ' }
    ])('TEST:1895:1 classifies a $label reference as UNSUPPORTED', async ({
        reference
    }: {
        readonly label: string;
        readonly reference?: string | null;
    }) => {
        // Arrange
        const body: Record<string, unknown> = preapproval();
        if (reference !== undefined) body.external_reference = reference;
        const provider = adapterAnswering(body);

        // Act
        const read = provider.readAuthorization({ authorizationId: 'foreign-preapproval' });

        // Assert
        await expect(read).rejects.toMatchObject({
            name: 'PaymentProviderError',
            code: 'UNSUPPORTED',
            capability: 'read',
            providerStatus: 'authorized',
            providerCadence: 'months',
            message: expect.stringContaining('without external_reference')
        });
    });

    it('TEST:1895:1 keeps reading our own preapproval when the reference is present', async () => {
        // Arrange
        const body = {
            ...preapproval(),
            external_reference: '00000000-0000-4000-8000-000000000001'
        };
        const provider = adapterAnswering(body);

        // Act
        const read = await provider.readAuthorization({ authorizationId: 'foreign-preapproval' });

        // Assert
        expect(read.snapshot).toEqual({
            authorizationId: 'foreign-preapproval',
            reference: '00000000-0000-4000-8000-000000000001',
            status: 'active',
            amount: { amountMinor: 150_000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            firstChargeAt: '2026-10-24T16:00:00.000Z',
            nextChargeAt: '2026-11-24T16:00:00.000Z',
            freePeriodDays: null,
            chargeRecordCount: null,
            lastChargedAt: null,
            lastModifiedAt: '2026-10-24T12:00:00.000-04:00',
            approvalUrl: 'https://example.invalid/subscriptions/checkout'
        });
    });
});
