/**
 * The Mercado Pago adapter (AC:B1:1): it implements the same interface,
 * validates every input like any adapter, and refuses unsupported capabilities.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    MercadoPagoPaymentProvider,
    type PaymentCapability,
    PaymentProviderError,
    type PaymentProviderMethod
} from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });

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
    { method: 'searchAuthorizations', capability: 'read', input: {} },
    { method: 'readCharge', capability: 'read', input: { chargeId: 'c' } },
    { method: 'listCharges', capability: 'read', input: { authorizationId: 'a' } },
    { method: 'readOrder', capability: 'read', input: { orderId: 'o' } },
    {
        method: 'searchOrders',
        capability: 'read',
        input: {
            reference: 'r',
            createdFrom: '2026-10-01T00:00:00.000Z',
            createdTo: '2026-10-29T00:00:00.000Z'
        }
    },
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

describe('MercadoPagoPaymentProvider', () => {
    it('covers all fourteen interface methods in this table', () => {
        expect(VALID_CALLS).toHaveLength(14);
    });

    it.each(
        VALID_CALLS.filter(
            ({ method }) =>
                ![
                    'authorize',
                    'readAuthorization',
                    'readCharge',
                    'listCharges',
                    'cancel',
                    'decodeNotice'
                ].includes(method)
        )
    )('$method refuses with NOT_IMPLEMENTED for $capability', async ({
        method,
        capability,
        input
    }) => {
        // Act
        const outcome = call({
            provider: new MercadoPagoPaymentProvider({ clock }),
            method,
            input
        });

        // Assert
        await expect(outcome).rejects.toBeInstanceOf(PaymentProviderError);
        await expect(outcome).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED', capability });
    });

    it.each(VALID_CALLS)('$method validates its input first', async ({ method, capability }) => {
        const outcome = call({
            provider: new MercadoPagoPaymentProvider({ clock }),
            method,
            input: { bogus: true }
        });
        await expect(outcome).rejects.toMatchObject({ code: 'INVALID_INPUT', capability });
    });

    it('leaves the other capabilities unimplemented', () => {
        expect(
            VALID_CALLS.filter(
                ({ method }) =>
                    ![
                        'authorize',
                        'readAuthorization',
                        'readCharge',
                        'listCharges',
                        'cancel',
                        'decodeNotice'
                    ].includes(method)
            )
        ).toHaveLength(8);
    });

    it('receives its clock injected and refuses to be built without one', () => {
        expect(() => new MercadoPagoPaymentProvider({ clock })).not.toThrow();
        expect(
            () => new MercadoPagoPaymentProvider({} as unknown as { readonly clock: typeof clock })
        ).toThrow();
    });
});
