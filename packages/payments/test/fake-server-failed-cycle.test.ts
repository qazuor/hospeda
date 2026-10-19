/** TEST:1714:3 AC:1714:3 checks the fake server against the captured failed record/search shape. */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const AUTHORIZATION = {
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reference: 'failed-cycle-reference',
    reason: 'Monthly',
    returnUrl: 'https://example.test/return'
} as const;
const clock = createAdjustableClock({ start: new Date('2026-09-15T15:28:02.000Z') });
const capturedSearch = JSON.parse(
    readFileSync(
        new URL('./fixtures/mercadopago-payments-search-renov-ok-2026-10-19.json', import.meta.url),
        'utf8'
    )
) as { paging: Record<string, unknown> };
let server: Awaited<ReturnType<typeof startFakeProviderServer>> | undefined;
afterEach(async () => {
    if (server) await server.close();
    server = undefined;
});

describe('TEST:1714:3 AC:1714:3 failed cycle server behavior', () => {
    it('TEST:1714:3 AC:1714:3 serves the failed record without payment.id only after its expiry and round-trips inventory', async () => {
        const instance = new FakePaymentProvider({ clock });
        server = await startFakeProviderServer({ provider: instance, clock });
        const adapter = new MercadoPagoPaymentProvider({
            clock,
            baseUrl: server.url,
            accessToken: 'test-token'
        });
        const authorization = await instance.authorize(AUTHORIZATION);
        await instance.approve({ authorizationId: authorization.authorizationId });
        const initial = await instance.charge({
            authorizationId: authorization.authorizationId,
            amount: AUTHORIZATION.amount,
            reference: 'opening'
        });
        clock.advance({ ms: 60 * 60 * 1000 });
        const failed = await instance.failChargeCycle({
            authorizationId: authorization.authorizationId,
            declineReason: 'issuer_declined'
        });
        const direct = async (path: string) =>
            fetch(`${server!.url}${path}`, { headers: { Authorization: 'Bearer test-token' } });
        const initialRead = await instance.readCharge(initial);
        const failedRead = await instance.readCharge(failed);
        expect(failedRead.snapshot.expiresAt).toEqual(expect.any(String));
        const failedRecords = async () =>
            (await (
                await direct(
                    `/authorized_payments/search?preapproval_id=${authorization.authorizationId}`
                )
            ).json()) as { results: Array<Record<string, any>> };
        const recordForFailed = (body: Awaited<ReturnType<typeof failedRecords>>) =>
            body.results.find((record) => record.date_created === failedRead.snapshot.createdAt)!;
        clock.set({ at: new Date(Date.parse(failedRead.snapshot.expiresAt!) - 60_000) });
        expect(Object.keys(recordForFailed(await failedRecords()).payment).sort()).toEqual([
            'id',
            'status',
            'status_detail'
        ]);
        clock.set({ at: new Date(Date.parse(failedRead.snapshot.expiresAt!) + 60_000) });
        const expiredRecord = recordForFailed(await failedRecords());
        expect(Object.keys(expiredRecord.payment).sort()).toEqual(['status', 'status_detail']);
        expect(expiredRecord.external_reference).toBe(AUTHORIZATION.reference);
        const searchResponse = await direct(
            `/v1/payments/search?external_reference=${encodeURIComponent(AUTHORIZATION.reference)}`
        );
        expect(searchResponse.status).toBe(200);
        const search = (await searchResponse.json()) as {
            paging: { total: number; offset: number; limit: number };
            results: unknown[];
        };
        expect(search.paging).toEqual({ total: 1, offset: 0, limit: 50 });
        expect(Object.keys(search.paging).sort()).toEqual(
            Object.keys(capturedSearch.paging).sort()
        );
        const raw = await direct(`/v1/payments/${failed.chargeId}`).then((response) =>
            response.json()
        );
        expect(search.results).toEqual([{ ...(raw as Record<string, unknown>), shipping_cost: 0 }]);
        expect(
            await adapter.listCharges({ authorizationId: authorization.authorizationId })
        ).toEqual(await instance.listCharges({ authorizationId: authorization.authorizationId }));
        const authorizationRead = await adapter.readAuthorization({
            authorizationId: authorization.authorizationId
        });
        expect(authorizationRead.snapshot.chargeRecordCount).toEqual(
            (await adapter.listCharges({ authorizationId: authorization.authorizationId }))
                .chargeIds.length
        );
        expect((await adapter.readCharge({ chargeId: failed.chargeId })).snapshot).toEqual(
            (await instance.readCharge(failed)).snapshot
        );
        expect(initialRead.snapshot.chargeId).toBe(initial.chargeId);
    });
});
