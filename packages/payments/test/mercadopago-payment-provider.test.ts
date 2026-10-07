/**
 * The Mercado Pago adapter skeleton (AC:B1:1): it implements the same
 * interface, validates every input like any adapter, and refuses every
 * capability with NOT_IMPLEMENTED, naming it, instead of pretending to work.
 */
import { describe, expect, it } from 'vitest';
import {
    MercadoPagoPaymentProvider,
    type PaymentCapability,
    PaymentProviderError,
    type PaymentProviderMethod
} from '../src/index';

const ARS = { amountMinor: 1_000, currency: 'ARS' } as const;

const VALID_CALLS: readonly {
    readonly method: PaymentProviderMethod;
    readonly capability: PaymentCapability;
    readonly input: unknown;
}[] = [
    {
        method: 'authorize',
        capability: 'authorize',
        input: {
            reference: 'sub-1',
            amount: ARS,
            cadence: { everyMonths: 12 },
            reason: 'Plan anual',
            returnUrl: 'https://hospeda.test/return'
        }
    },
    {
        method: 'charge',
        capability: 'charge',
        input: { authorizationId: 'a', amount: ARS, reference: 'c' }
    },
    {
        method: 'changeAmount',
        capability: 'changeAmount',
        input: { authorizationId: 'a', amount: ARS }
    },
    { method: 'pause', capability: 'pauseAndResume', input: { authorizationId: 'a' } },
    { method: 'resume', capability: 'pauseAndResume', input: { authorizationId: 'a' } },
    { method: 'cancel', capability: 'cancel', input: { authorizationId: 'a' } },
    {
        method: 'refund',
        capability: 'refund',
        input: { chargeId: 'c', amount: ARS, reference: 'r' }
    },
    { method: 'readAuthorization', capability: 'read', input: { authorizationId: 'a' } },
    { method: 'readCharge', capability: 'read', input: { chargeId: 'c' } },
    { method: 'decodeNotice', capability: 'notify', input: { headers: {}, body: '{}' } }
];

/** Calls one interface method with an untyped input. */
function call(args: {
    readonly provider: MercadoPagoPaymentProvider;
    readonly method: PaymentProviderMethod;
    readonly input: unknown;
}): Promise<unknown> {
    const fn = args.provider[args.method] as (input: unknown) => Promise<unknown>;
    return fn.call(args.provider, args.input);
}

describe('MercadoPagoPaymentProvider (skeleton)', () => {
    it('covers all ten interface methods in this table', () => {
        expect(VALID_CALLS).toHaveLength(10);
    });

    it.each(VALID_CALLS)('$method refuses with NOT_IMPLEMENTED for $capability', async ({
        method,
        capability,
        input
    }) => {
        // Act
        const outcome = call({ provider: new MercadoPagoPaymentProvider(), method, input });

        // Assert
        await expect(outcome).rejects.toBeInstanceOf(PaymentProviderError);
        await expect(outcome).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED', capability });
    });

    it.each(VALID_CALLS)('$method validates its input first', async ({ method, capability }) => {
        const outcome = call({
            provider: new MercadoPagoPaymentProvider(),
            method,
            input: { bogus: true }
        });
        await expect(outcome).rejects.toMatchObject({ code: 'INVALID_INPUT', capability });
    });
});
