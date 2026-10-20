/** TEST:1710:8 AC:1710:7 checks measured records and complete HTTP round trips. */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const AUTHORIZATION = {
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reference: 'window-sub',
    reason: 'Monthly',
    returnUrl: 'https://example.test/return'
} as const;
const RECORD_PATHS = [
    'id',
    'preapproval_id',
    'date_created',
    'expire_date',
    'payment.id',
    'payment.status'
];
const captured = JSON.parse(
    readFileSync(
        new URL(
            './fixtures/mercadopago-authorized-payments-renewals-2026-10-19.json',
            import.meta.url
        ),
        'utf8'
    )
) as Record<string, unknown>;
const clock = createAdjustableClock({ start: new Date('2026-09-15T15:28:02.000Z') });
let server: Awaited<ReturnType<typeof startFakeProviderServer>> | undefined;
afterEach(async () => {
    if (server) await server.close();
    server = undefined;
});
async function setup() {
    const instance = new FakePaymentProvider({ clock });
    server = await startFakeProviderServer({ provider: instance, clock });
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    const raw = async (chargeId: string) => {
        const response = await fetch(`${server!.url}/v1/payments/${chargeId}`, {
            headers: { Authorization: 'Bearer test-token' }
        });
        return (await response.json()) as Record<string, unknown>;
    };
    const records = async (authorizationId: string) => {
        const response = await fetch(
            `${server!.url}/authorized_payments/search?preapproval_id=${authorizationId}&limit=10&offset=0`,
            { headers: { Authorization: 'Bearer test-token' } }
        );
        return (await response.json()) as { results: Record<string, unknown>[] };
    };
    const auth = await instance.authorize(AUTHORIZATION);
    await instance.approve({ authorizationId: auth.authorizationId });
    return { instance, adapter, authorizationId: auth.authorizationId, raw, records };
}

describe('TEST:1710:8 AC:1710:7 fake provider charge windows', () => {
    it('TEST:1710:8 AC:1710:7 serves captured record paths and a payment body with the exact keys', async () => {
        const context = await setup();
        await context.instance.charge({
            authorizationId: context.authorizationId,
            amount: AUTHORIZATION.amount,
            reference: 'opening'
        });
        const renewal = await context.instance.charge({
            authorizationId: context.authorizationId,
            amount: AUTHORIZATION.amount,
            reference: 'renewal'
        });
        const listed = await context.records(context.authorizationId);
        for (const path of RECORD_PATHS) {
            expect(captured).toHaveProperty(`results[1].${path}`);
            expect(listed.results[1]).toHaveProperty(path);
        }
        const body = await context.raw(renewal.chargeId);
        expect(Object.keys(body).sort()).toEqual([
            'currency_id',
            'date_created',
            'external_reference',
            'id',
            'metadata',
            'point_of_interaction',
            'status',
            'status_detail',
            'transaction_amount',
            'transaction_amount_refunded'
        ]);
    });
    it('TEST:1710:8 AC:1710:7 round trips opening, approved renewal, and rejected renewal snapshots', async () => {
        const context = await setup();
        const first = await context.instance.charge({
            authorizationId: context.authorizationId,
            amount: AUTHORIZATION.amount,
            reference: 'opening'
        });
        const approved = await context.instance.charge({
            authorizationId: context.authorizationId,
            amount: AUTHORIZATION.amount,
            reference: 'renewal-approved'
        });
        expect((await context.instance.readCharge(approved)).snapshot.expiresAt).toEqual(
            expect.any(String)
        );
        const rejected = await context.instance.failChargeCycle({
            authorizationId: context.authorizationId,
            declineReason: 'issuer_declined'
        });
        expect((await context.instance.readCharge(rejected)).snapshot.expiresAt).toEqual(
            expect.any(String)
        );
        for (const charge of [first, approved, rejected])
            expect(
                (await context.adapter.readCharge({ chargeId: charge.chargeId })).snapshot
            ).toEqual((await context.instance.readCharge(charge)).snapshot);
    });
});
