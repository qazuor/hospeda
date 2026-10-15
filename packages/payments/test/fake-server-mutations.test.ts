import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const base = {
    reference: 'direct-server-test',
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Plan mensual',
    returnUrl: 'https://example.test/return'
} as const;
const activeServers: Array<{ close(): Promise<void> }> = [];

async function setup() {
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [
            { lie: 'M8', why: 'direct HTTP tests need charges approved immediately' },
            { lie: 'M13', why: 'direct refund behaviour should accept a partial refund' }
        ],
        withoutBehaviour: [{ behaviour: 'RP12', why: 'the test creates a normal charge' }]
    });
    const server = await startFakeProviderServer({ provider, clock });
    activeServers.push(server);
    const headers = { authorization: 'Bearer test-token', 'content-type': 'application/json' };
    const createdResponse = await fetch(`${server.url}/preapproval`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            external_reference: base.reference,
            reason: base.reason,
            back_url: base.returnUrl,
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: 15,
                currency_id: 'ARS'
            }
        })
    });
    const created = (await createdResponse.json()) as { id: string };
    await provider.approve({ authorizationId: created.id });
    const charge = await provider.charge({
        authorizationId: created.id,
        amount: base.amount,
        reference: 'direct-cycle'
    });
    return { server, provider, headers, authorizationId: created.id, chargeId: charge.chargeId };
}

afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.close()));
});

describe('fake-server mutation routes', () => {
    it('TEST:1669:7 supports status and amount PUTs and rejects combined fields', async () => {
        const { server, headers, authorizationId } = await setup();
        const path = `${server.url}/preapproval/${authorizationId}`;
        const paused = await fetch(path, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'paused' })
        });
        expect(paused.status).toBe(200);
        expect(((await paused.json()) as { status: string }).status).toBe('paused');
        const resumed = await fetch(path, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'authorized' })
        });
        expect(resumed.status).toBe(200);
        expect(((await resumed.json()) as { status: string }).status).toBe('authorized');
        const changed = await fetch(path, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ auto_recurring: { transaction_amount: 23, currency_id: 'ARS' } })
        });
        expect(changed.status).toBe(200);
        expect(
            ((await changed.json()) as { auto_recurring: { transaction_amount: number } })
                .auto_recurring.transaction_amount
        ).toBe(23);
        const combined = await fetch(path, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                status: 'paused',
                auto_recurring: { transaction_amount: 24, currency_id: 'ARS' }
            })
        });
        expect(combined.status).toBe(400);
        expect(await combined.json()).toMatchObject({ status: 'INVALID_INPUT' });
    });

    it('TEST:1669:8 requires the key and returns 201 then empty 200 on a repeated refund', async () => {
        const { server, headers, chargeId } = await setup();
        const path = `${server.url}/v1/payments/${chargeId}/refunds`;
        const missingKey = await fetch(path, {
            method: 'POST',
            headers,
            body: '{'
        });
        expect(missingKey.status).toBe(400);
        expect(await missingKey.json()).toEqual({
            code: 4292,
            message: "Header X-Idempotency-Key can't be null",
            status: 400
        });
        const refundHeaders = { ...headers, 'X-Idempotency-Key': 'direct-refund' };
        const first = await fetch(path, {
            method: 'POST',
            headers: refundHeaders
        });
        expect(first.status).toBe(201);
        expect(await first.json()).toMatchObject({ payment_id: chargeId, amount: 15 });
        const replay = await fetch(path, {
            method: 'POST',
            headers: refundHeaders
        });
        expect(replay.status).toBe(200);
        expect(await replay.text()).toBe('');
    });
});
