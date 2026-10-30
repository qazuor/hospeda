/** TEST:1710:4 AC:1710:3 compares fake HTTP payloads with the captured payment shape. */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const AUTHORIZATION = {
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reference: 'shape-sub',
    reason: 'Monthly',
    returnUrl: 'https://example.test/return'
} as const;
const clock = createAdjustableClock({ start: new Date('2026-09-15T15:28:02.000Z') });
const LINK_AND_REFUND_PATHS = [
    'id',
    'date_created',
    'external_reference',
    'status',
    'status_detail',
    'transaction_amount',
    'currency_id',
    'transaction_amount_refunded',
    'metadata',
    'point_of_interaction.transaction_data.subscription_id'
];
const capture = JSON.parse(
    readFileSync(
        new URL('./fixtures/mercadopago-recurring-payment-2026-09-15.json', import.meta.url),
        'utf8'
    )
) as Record<string, unknown>;

async function setup() {
    const provider = new FakePaymentProvider({
        clock,
        honestAbout: [{ lie: 'M13', why: 'the round trip includes a partial refund' }]
    });
    const server = await startFakeProviderServer({ provider, clock });
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    async function raw(chargeId: string) {
        const response = await fetch(`${server.url}/v1/payments/${chargeId}`, {
            headers: { Authorization: 'Bearer test-token' }
        });
        if (!response.ok) throw new Error(`Fake payment read failed (${response.status})`);
        return (await response.json()) as Record<string, unknown>;
    }
    return { provider, server, adapter, raw };
}

async function approvedCharge(context: Awaited<ReturnType<typeof setup>>) {
    const { authorizationId } = await context.provider.authorize(AUTHORIZATION);
    await context.provider.approve({ authorizationId });
    const { chargeId } = await context.provider.charge({
        authorizationId,
        amount: AUTHORIZATION.amount,
        reference: 'cycle'
    });
    await context.server.advanceClock({ ms: 60 * 60 * 1000 });
    return { authorizationId, chargeId };
}

async function expectRoundTrip(context: Awaited<ReturnType<typeof setup>>, chargeId: string) {
    expect((await context.adapter.readCharge({ chargeId })).snapshot).toEqual(
        (await context.provider.readCharge({ chargeId })).snapshot
    );
}

describe('TEST:1710:4 AC:1710:3 fake Mercado Pago charge shape', () => {
    it('TEST:1710:4 AC:1710:3 emits every captured link and refund path', async () => {
        const context = await setup();
        try {
            const { chargeId } = await approvedCharge(context);
            const body = await context.raw(chargeId);
            for (const path of LINK_AND_REFUND_PATHS) {
                expect(capture).toHaveProperty(path);
                expect(body).toHaveProperty(path);
            }
            expect(body.metadata).toEqual({});
            expect(body.point_of_interaction).toMatchObject({
                type: 'SUBSCRIPTIONS',
                transaction_data: { subscription_id: expect.any(String) }
            });
        } finally {
            await context.server.close();
        }
    });

    it('TEST:1710:4 AC:1710:3 emits the measured card-validation shape over HTTP', async () => {
        const context = await setup();
        try {
            const { authorizationId } = await context.provider.authorize(AUTHORIZATION);
            const validation = await context.provider.changeCard({ authorizationId, passes: true });
            if (!validation) throw new Error('Expected card validation');
            const body = await context.raw(validation.chargeId);
            expect(body.point_of_interaction).toEqual({ type: 'UNSPECIFIED' });
            expect(body.metadata).toEqual({});
        } finally {
            await context.server.close();
        }
    });

    it('TEST:1710:4 AC:1710:3 preserves complete snapshots over adapter-to-fake HTTP round trips', async () => {
        const context = await setup();
        try {
            const { chargeId } = await approvedCharge(context);
            const partialAuth = await context.provider.authorize({
                ...AUTHORIZATION,
                reference: 'partial-sub'
            });
            await context.provider.approve({ authorizationId: partialAuth.authorizationId });
            const partial = await context.provider.charge({
                authorizationId: partialAuth.authorizationId,
                amount: AUTHORIZATION.amount,
                reference: 'partial-cycle'
            });
            await context.server.advanceClock({ ms: 60 * 60 * 1000 });
            await context.provider.refund({
                chargeId: partial.chargeId,
                amount: { amountMinor: 500, currency: 'ARS' },
                reference: 'partial-refund'
            });
            await context.provider.refund({
                chargeId,
                amount: AUTHORIZATION.amount,
                reference: 'full-refund'
            });
            const { authorizationId: rejectedAuth } = await context.provider.authorize({
                ...AUTHORIZATION,
                reference: 'rejected-sub'
            });
            const rejected = await context.provider.declineCharge({
                authorizationId: rejectedAuth,
                declineReason: 'declined'
            });
            const validation = await context.provider.changeCard({
                authorizationId: rejectedAuth,
                passes: true
            });
            if (!validation) throw new Error('Expected card validation');
            for (const id of [chargeId, partial.chargeId, rejected.chargeId, validation.chargeId])
                await expectRoundTrip(context, id);
        } finally {
            await context.server.close();
        }
    });
});
