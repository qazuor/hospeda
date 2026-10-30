/**
 * The Mercado Pago adapter (AC:B1:1): it implements the same interface,
 * validates every input like any adapter, and refuses unsupported capabilities.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it, vi } from 'vitest';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';
import {
    MercadoPagoPaymentProvider,
    type PaymentCapability,
    type PaymentProviderMethod
} from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });

const ARS = { amountMinor: 1_500, currency: 'ARS' } as const;

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
    it.each([
        { status: 'authorized', frequency_type: 'days' },
        { status: 'finished', frequency_type: 'months' }
    ])('TEST:1777:1 classifies unsupported authorization shapes as UNSUPPORTED', async (shape) => {
        const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    id: 'foreign-auth',
                    external_reference: 'foreign-reference',
                    status: shape.status,
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: shape.frequency_type,
                        transaction_amount: 15,
                        currency_id: 'ARS',
                        start_date: null
                    },
                    summarized: null,
                    next_payment_date: null
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        );
        const provider = new MercadoPagoPaymentProvider({
            clock,
            fetch,
            accessToken: 'test-token'
        });

        await expect(
            provider.readAuthorization({ authorizationId: 'foreign-auth' })
        ).rejects.toMatchObject({
            code: 'UNSUPPORTED',
            message: expect.stringContaining(shape.status === 'finished' ? 'finished' : 'days')
        });
    });

    it('covers all fourteen interface methods in this table', () => {
        expect(VALID_CALLS).toHaveLength(14);
    });

    it.each(VALID_CALLS)('$method validates its input first', async ({ method, capability }) => {
        const outcome = call({
            provider: new MercadoPagoPaymentProvider({ clock }),
            method,
            input: { bogus: true }
        });
        await expect(outcome).rejects.toMatchObject({ code: 'INVALID_INPUT', capability });
    });

    it('sends every interface operation through the fake without NOT_IMPLEMENTED (AC:1669:1)', async () => {
        const fake = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [
                {
                    lie: 'M4',
                    why: 'the interface table checks complete authorization search behavior'
                },
                { lie: 'M8', why: 'the interface table exercises immediate charge reads' }
            ],
            withoutBehaviour: [
                { behaviour: 'RP12', why: 'the interface table creates a regular charge' }
            ]
        });
        const server = await startFakeProviderServer({ provider: fake, clock });
        try {
            const adapter = new MercadoPagoPaymentProvider({
                clock,
                baseUrl: server.url,
                accessToken: 'test-token'
            });
            const authorized = await adapter.authorize({
                reference: 'interface-table-first',
                amount: ARS,
                cadence: { everyMonths: 1 },
                reason: 'Plan',
                returnUrl: 'https://hospeda.test/return'
            });
            await fake.approve({ authorizationId: authorized.authorizationId });
            await adapter.changeAmount({
                authorizationId: authorized.authorizationId,
                amount: ARS
            });
            await adapter.pause({ authorizationId: authorized.authorizationId });
            await adapter.resume({ authorizationId: authorized.authorizationId });
            await adapter.cancel({ authorizationId: authorized.authorizationId });
            await adapter.readAuthorization({ authorizationId: authorized.authorizationId });
            await adapter.searchAuthorizations({});
            const second = await adapter.authorize({
                reference: 'table-charge',
                amount: ARS,
                cadence: { everyMonths: 1 },
                reason: 'Plan',
                returnUrl: 'https://hospeda.test/return'
            });
            await fake.approve({ authorizationId: second.authorizationId });
            const charge = await fake.charge({
                authorizationId: second.authorizationId,
                amount: ARS,
                reference: 'cycle'
            });
            await adapter.readCharge({ chargeId: charge.chargeId });
            await adapter.listCharges({ authorizationId: second.authorizationId });
            await adapter.refund({ chargeId: charge.chargeId, amount: ARS, reference: 'refund' });
            const order = fake.placeOrder({ reference: 'table-order', paid: true });
            await adapter.readOrder({ orderId: order.orderId });
            await adapter.searchOrders({
                reference: 'table-order',
                createdFrom: '2026-10-01T00:00:00.000Z',
                createdTo: '2026-10-29T00:00:00.000Z'
            });
            await expect(
                adapter.charge({
                    authorizationId: second.authorizationId,
                    amount: ARS,
                    reference: 'on-demand'
                })
            ).rejects.toMatchObject({ code: 'REJECTED' });
            await expect(
                adapter.decodeNotice({
                    headers: {},
                    body: '{"type":"payment","data":{"id":"table-charge"}}'
                })
            ).resolves.toMatchObject({ resourceKind: 'charge', resourceId: 'table-charge' });
            expect(VALID_CALLS).toHaveLength(14);
        } finally {
            await server.close();
        }
    });

    it('receives its clock injected and refuses to be built without one', () => {
        expect(() => new MercadoPagoPaymentProvider({ clock })).not.toThrow();
        expect(
            () => new MercadoPagoPaymentProvider({} as unknown as { readonly clock: typeof clock })
        ).toThrow();
    });
});
