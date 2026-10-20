import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const input = {
    reference: 'mutations-test',
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Plan mensual',
    returnUrl: 'https://example.test/return'
} as const;

async function setup() {
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [
            { lie: 'M8', why: 'mutation tests need charges approved immediately' },
            { lie: 'M13', why: 'partial refunds are measured to succeed in these mutation cases' }
        ],
        withoutBehaviour: [{ behaviour: 'RP12', why: 'these cases create ordinary charges' }]
    });
    const server = await startFakeProviderServer({ provider, clock });
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    return { server, adapter };
}

async function activeAuthorization(
    adapter: MercadoPagoPaymentProvider,
    provider: FakePaymentProvider
) {
    const created = await adapter.authorize(input);
    await provider.approve({ authorizationId: created.authorizationId });
    return created.authorizationId;
}

async function approvedCharge(args: {
    readonly adapter: MercadoPagoPaymentProvider;
    readonly provider: FakePaymentProvider;
    readonly reference?: string;
}) {
    const authorizationId = await activeAuthorization(args.adapter, args.provider);
    return args.provider.charge({
        authorizationId,
        amount: input.amount,
        reference: args.reference ?? 'cycle-1'
    });
}

describe('TEST:1669:7 AC:1669:0 AC:1669:2 Mercado Pago amount and status mutations', () => {
    it('changes the amount with one field, pauses and resumes through HTTP', async () => {
        const { server, adapter } = await setup();
        try {
            const authorizationId = await activeAuthorization(adapter, server.provider);
            const amount = { amountMinor: 2300, currency: 'ARS' };
            await expect(adapter.changeAmount({ authorizationId, amount })).resolves.toEqual({
                accepted: true,
                resourceId: authorizationId
            });
            const update = server.requests().find((request) => request.method === 'PUT');
            expect(update).toMatchObject({
                path: `/preapproval/${authorizationId}`,
                body: { auto_recurring: { transaction_amount: 23, currency_id: 'ARS' } }
            });
            expect(Object.keys(update?.body as Record<string, unknown>)).toEqual([
                'auto_recurring'
            ]);
            expect((await adapter.readAuthorization({ authorizationId })).snapshot.amount).toEqual(
                amount
            );

            await adapter.pause({ authorizationId });
            expect((await adapter.readAuthorization({ authorizationId })).snapshot.status).toBe(
                'paused'
            );
            await expect(adapter.changeAmount({ authorizationId, amount })).rejects.toMatchObject({
                code: 'REJECTED',
                capability: 'changeAmount'
            });
            await adapter.resume({ authorizationId });
            expect((await adapter.readAuthorization({ authorizationId })).snapshot.status).toBe(
                'active'
            );
            expect(
                server
                    .requests()
                    .filter((request) => request.method === 'PUT')
                    .map(({ body }) => body)
            ).toContainEqual({ status: 'paused' });
            expect(
                server
                    .requests()
                    .filter((request) => request.method === 'PUT')
                    .map(({ body }) => body)
            ).toContainEqual({ status: 'authorized' });
        } finally {
            await server.close();
        }
    });

    it('rejects resume from pending, missing ids, and missing access tokens', async () => {
        const { server, adapter } = await setup();
        try {
            const pending = await adapter.authorize(input);
            await expect(
                adapter.resume({ authorizationId: pending.authorizationId })
            ).rejects.toMatchObject({ code: 'REJECTED' });
            for (const operation of [adapter.pause, adapter.resume]) {
                await expect(
                    operation.call(adapter, { authorizationId: 'absent' })
                ).rejects.toMatchObject({ code: 'NOT_FOUND' });
            }
            await expect(
                new MercadoPagoPaymentProvider({ clock }).pause({ authorizationId: 'a' })
            ).rejects.toMatchObject({
                code: 'UNAVAILABLE',
                capability: 'pauseAndResume'
            });
        } finally {
            await server.close();
        }
    });
});

describe('TEST:1669:8 AC:1669:0 AC:1669:2 Mercado Pago refunds', () => {
    it('refunds total and partial amounts and safely replays the same request', async () => {
        const { server, adapter } = await setup();
        try {
            const totalCharge = await approvedCharge({
                adapter,
                provider: server.provider,
                reference: 'cycle-total'
            });
            const total = await adapter.refund({
                chargeId: totalCharge.chargeId,
                amount: input.amount,
                reference: 'refund-total'
            });
            expect(total.refundId).toMatch(/^fake-refund-/);
            expect(
                (await adapter.readCharge({ chargeId: totalCharge.chargeId })).snapshot
                    .refundedAmount
            ).toEqual(input.amount);

            const partialCharge = await approvedCharge({
                adapter,
                provider: server.provider,
                reference: 'cycle-partial'
            });
            const partial = { amountMinor: 500, currency: 'ARS' };
            const first = await adapter.refund({
                chargeId: partialCharge.chargeId,
                amount: partial,
                reference: 'refund-partial'
            });
            expect(first.refundId).toMatch(/^fake-refund-/);
            await expect(
                adapter.refund({
                    chargeId: partialCharge.chargeId,
                    amount: partial,
                    reference: 'refund-partial'
                })
            ).resolves.toEqual({ refundId: '' });
            expect(
                (await adapter.readCharge({ chargeId: partialCharge.chargeId })).snapshot
                    .refundedAmount
            ).toEqual(partial);
            await expect(
                adapter.refund({
                    chargeId: partialCharge.chargeId,
                    amount: { amountMinor: 600, currency: 'ARS' },
                    reference: 'refund-partial'
                })
            ).rejects.toMatchObject({ code: 'REJECTED' });
            expect(
                server
                    .requests()
                    .filter(({ path }) => path.endsWith('/refunds'))
                    .map(({ body }) => body)
            ).toContainEqual({ amount: 5 });
            const refundCalls = server.requests().filter(({ path }) => path.endsWith('/refunds'));
            expect(refundCalls.map(({ headers }) => headers?.['X-Idempotency-Key'])).toEqual([
                'refund-total',
                'refund-partial',
                'refund-partial',
                'refund-partial'
            ]);
            expect(refundCalls[0]).toMatchObject({
                method: 'POST',
                path: `/v1/payments/${totalCharge.chargeId}/refunds`,
                body: { amount: 15 }
            });
            expect(
                (await adapter.readCharge({ chargeId: totalCharge.chargeId })).snapshot
                    .refundedAmount
            ).toEqual(input.amount);
        } finally {
            await server.close();
        }
    });

    it('maps an excessive amount with its response cause and an unknown charge to provider errors', async () => {
        const { server, adapter } = await setup();
        try {
            const charge = await approvedCharge({
                adapter,
                provider: server.provider,
                reference: 'cycle-over'
            });
            await expect(
                adapter.refund({
                    chargeId: charge.chargeId,
                    amount: { amountMinor: 1600, currency: 'ARS' },
                    reference: 'refund-over'
                })
            ).rejects.toMatchObject({ code: 'REJECTED', cause: { status: 'REJECTED' } });
            await expect(
                adapter.refund({
                    chargeId: 'absent',
                    amount: input.amount,
                    reference: 'refund-absent'
                })
            ).rejects.toMatchObject({
                code: 'NOT_FOUND',
                capability: 'refund'
            });
        } finally {
            await server.close();
        }
    });
});
