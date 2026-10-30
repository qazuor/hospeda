/**
 * TEST:1714:1-2 AC:1714:1-2. The record and payment payloads are the redacted 2026-10-19
 * captures; all edge variants below are structured clones. Their dates are copied from those
 * captures or derived by the stated boundary cases.
 */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import type { MercadoPagoChargeRecord } from '../src/adapters/mercadopago/mercadopago-charges';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { resolveUnnamedChargeRecords } from '../src/adapters/mercadopago/mercadopago-unnamed-charges';

type Payload = {
    results: Array<Record<string, any>>;
    paging: { total: number; offset?: number; limit?: number };
    status?: number;
};
const load = (name: string) =>
    JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as Payload;
const records = load('mercadopago-authorized-payments-renewals-2026-10-19.json');
const payments = load('mercadopago-payments-search-renov-ok-2026-10-19.json');
const AUTH = '6b293a9499d946f6ac159da7f8f4804e';
const REF = 'HOS-1352-relojprod-renov-ok';
const NAMED5 = ['178259523769', '178425488475', '179587345822', '179775870602', '179941738878'];
const ALL6 = [...NAMED5, '179087989627'];
const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00.000Z') });

function harness(
    recordPayload = structuredClone(records),
    paymentPayload = structuredClone(payments)
) {
    const paths: string[] = [];
    const urls: URL[] = [];
    const fetch: typeof globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        paths.push(url.pathname);
        urls.push(url);
        const body =
            url.pathname === '/authorized_payments/search' ? recordPayload : paymentPayload;
        return new Response(JSON.stringify(body), {
            status: body.status ?? 200,
            headers: { 'content-type': 'application/json' }
        });
    };
    return {
        adapter: new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch }),
        paths,
        urls,
        recordPayload,
        paymentPayload
    };
}
const failedRecord = (payload = records) =>
    payload.results.find((record) => String(record.id) === '7032113610')!;
const failedPayment = (payload = payments) =>
    payload.results.find((payment) => String(payment.id) === '179087989627')!;

describe('TEST:1714:1 AC:1714:1 reference search resolves the measured unnamed failed-cycle payment', () => {
    it('returns all six ids and sends one exact reference search', async () => {
        const h = harness();
        const listed = await h.adapter.listCharges({ authorizationId: AUTH });
        expect(listed).toEqual({ chargeIds: ALL6 });
        expect(h.paths).toEqual(['/authorized_payments/search', '/v1/payments/search']);
        expect([...h.urls[1]!.searchParams.keys()]).toEqual(['external_reference']);
        expect(h.urls[1]!.searchParams.get('external_reference')).toBe(REF);
        expect(listed.chargeIds).toHaveLength(records.results.length);
    });
});

describe('TEST:1714:2 AC:1714:1-2 fail-closed and absence variants', () => {
    it('TEST:1714:2 AC:1714:1-2 a-b skips unneeded and missing-reference searches', async () => {
        const named = structuredClone(records);
        failedRecord(named).payment = { id: 179087989627 };
        const a = harness(named);
        expect(await a.adapter.listCharges({ authorizationId: AUTH })).toEqual({ chargeIds: ALL6 });
        expect(a.paths).toEqual(['/authorized_payments/search']);
        const noReference = structuredClone(records);
        failedRecord(noReference).external_reference = null;
        const b = harness(noReference);
        expect(await b.adapter.listCharges({ authorizationId: AUTH })).toEqual({
            chargeIds: NAMED5
        });
        expect(b.paths).toEqual(['/authorized_payments/search']);
    });

    it('TEST:1714:2 AC:1714:1-2 c-d returns absence and rejects multiple payment candidates', async () => {
        const empty = { results: [], paging: { total: 0, offset: 0, limit: 50 } };
        expect(
            await harness(undefined, empty).adapter.listCharges({ authorizationId: AUTH })
        ).toEqual({ chargeIds: NAMED5 });
        const two = structuredClone(payments);
        const clone = structuredClone(failedPayment(two));
        clone.id = 179087989628;
        clone.date_created = '2026-09-20T20:01:45.000-04:00';
        two.results.push(clone);
        two.paging.total = 7;
        await expect(
            harness(undefined, two).adapter.listCharges({ authorizationId: AUTH })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE', capability: 'read' });
    });

    it('TEST:1714:2 AC:1714:2 e-g rejects record ambiguity, server errors, and incomplete search pages', async () => {
        const duplicate = structuredClone(records);
        const clone = structuredClone(failedRecord(duplicate));
        clone.id = 7032113611;
        duplicate.results.push(clone);
        duplicate.paging.total = 7;
        await expect(
            harness(duplicate).adapter.listCharges({ authorizationId: AUTH })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        const error = structuredClone(payments);
        error.status = 500;
        await expect(
            harness(undefined, error).adapter.listCharges({ authorizationId: AUTH })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        const short = structuredClone(payments);
        short.paging.total = 7;
        await expect(
            harness(undefined, short).adapter.listCharges({ authorizationId: AUTH })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });

    it('TEST:1714:2 AC:1714:2 h-h2-i excludes foreign or unlinked payments and rejects conflicting links', async () => {
        for (const alter of [
            (p: Record<string, any>) => {
                p.metadata.preapproval_id = 'otherpreapproval';
                p.point_of_interaction.transaction_data.subscription_id = 'otherpreapproval';
            },
            (p: Record<string, any>) => {
                p.metadata = {};
                p.point_of_interaction = { type: 'UNSPECIFIED' };
            }
        ]) {
            const variant = structuredClone(payments);
            alter(failedPayment(variant));
            expect(
                await harness(undefined, variant).adapter.listCharges({ authorizationId: AUTH })
            ).toEqual({ chargeIds: NAMED5 });
        }
        const conflict = structuredClone(payments);
        failedPayment(conflict).metadata.preapproval_id = AUTH;
        failedPayment(conflict).point_of_interaction.transaction_data.subscription_id =
            'otherpreapproval';
        await expect(
            harness(undefined, conflict).adapter.listCharges({ authorizationId: AUTH })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });

    it('TEST:1714:2 AC:1714:1-2 j-k-m-n applies expiry and shared inclusive date selection', async () => {
        const atExpiry = structuredClone(payments);
        failedPayment(atExpiry).date_created = '2026-09-21T20:01:41.000-04:00';
        expect(
            await harness(undefined, atExpiry).adapter.listCharges({ authorizationId: AUTH })
        ).toEqual({ chargeIds: NAMED5 });
        const earlier = structuredClone(payments);
        failedPayment(earlier).date_created = '2026-09-20T20:01:40.000-04:00';
        expect(
            await harness(undefined, earlier).adapter.listCharges({ authorizationId: AUTH })
        ).toEqual({ chargeIds: NAMED5 });
        const invalid = structuredClone(payments);
        failedPayment(invalid).date_created = 'not-a-date';
        await expect(
            harness(undefined, invalid).adapter.listCharges({ authorizationId: AUTH })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        const equal = structuredClone(payments);
        failedPayment(equal).date_created = '2026-09-20T20:01:41.000-04:00';
        expect(
            await harness(undefined, equal).adapter.listCharges({ authorizationId: AUTH })
        ).toEqual({ chargeIds: ALL6 });
    });

    it('TEST:1714:2 AC:1714:1 o-q ignores record status and remains stable with reversed input order', async () => {
        const status = structuredClone(records);
        failedRecord(status).payment = { status: 'approved', status_detail: 'accredited' };
        expect(await harness(status).adapter.listCharges({ authorizationId: AUTH })).toEqual({
            chargeIds: ALL6
        });
        const reversedRecords = structuredClone(records);
        reversedRecords.results.reverse();
        const reversedPayments = structuredClone(payments);
        reversedPayments.results.reverse();
        expect(
            await harness(reversedRecords, reversedPayments).adapter.listCharges({
                authorizationId: AUTH
            })
        ).toEqual({ chargeIds: ALL6 });
    });

    it('TEST:1714:2 AC:1714:1 p verifies named-record protection', async () => {
        const recordsVariant = structuredClone(records);
        recordsVariant.results.find((r) => String(r.id) === '7032061947')!.payment = {};
        const extra = structuredClone(
            payments.results.find((p) => String(p.id) === '179941738878')!
        );
        extra.id = 179941738879;
        extra.date_created = '2026-09-19T20:01:55.000-04:00';
        const searchVariant = structuredClone(payments);
        searchVariant.results.push(extra);
        searchVariant.paging.total = 7;
        expect(
            await harness(recordsVariant, searchVariant).adapter.listCharges({
                authorizationId: AUTH
            })
        ).toEqual({ chargeIds: ALL6 });
    });

    it('TEST:1714:2 AC:1714:1 r resolves the unnamed record directly', async () => {
        const map = await resolveUnnamedChargeRecords({
            authorizationId: AUTH,
            records: records.results as MercadoPagoChargeRecord[],
            send: async ({ path }) =>
                new Response(
                    JSON.stringify(path.startsWith('/authorized_payments') ? records : payments)
                )
        });
        expect([...map].map(([record, paymentId]) => [String(record.id), paymentId])).toEqual([
            ['7032113610', '179087989627']
        ]);
    });

    it('TEST:1714:2 AC:1714:1-2 s leaves a mixed-reference record absent', async () => {
        const mixedRecords = structuredClone(records);
        mixedRecords.results = [
            structuredClone(records.results.find((record) => String(record.id) === '7032086953')!),
            structuredClone(failedRecord())
        ];
        mixedRecords.results[0]!.date_created = '2026-09-19T20:01:50.000-04:00';
        mixedRecords.results[0]!.payment = {};
        mixedRecords.results[1]!.date_created = '2026-09-19T20:01:53.000-04:00';
        mixedRecords.results[1]!.external_reference = undefined;
        mixedRecords.results[1]!.payment = {};
        mixedRecords.paging.total = 2;

        const searchResults = [structuredClone(failedPayment()), structuredClone(failedPayment())];
        searchResults[0]!.id = 179087989628;
        searchResults[0]!.date_created = '2026-09-19T20:01:51.000-04:00';
        searchResults[1]!.id = 179087989629;
        searchResults[1]!.date_created = '2026-09-19T20:01:54.000-04:00';
        const searchPayload = {
            results: searchResults,
            paging: { total: 2, offset: 0, limit: 50 }
        };
        const send = async ({ path }: { path: string }) =>
            new Response(
                JSON.stringify(
                    path.startsWith('/authorized_payments') ? mixedRecords : searchPayload
                )
            );

        const resolved = await resolveUnnamedChargeRecords({
            authorizationId: AUTH,
            records: mixedRecords.results as MercadoPagoChargeRecord[],
            send
        });
        expect([...resolved].map(([record, paymentId]) => [String(record.id), paymentId])).toEqual([
            ['7032086953', '179087989628']
        ]);

        const listed = await harness(mixedRecords, searchPayload).adapter.listCharges({
            authorizationId: AUTH
        });
        expect(listed).toEqual({ chargeIds: ['179087989628'] });
    });

    it('TEST:1714:2 AC:1714:2 r2 ignores a payment assigned to a record naming another payment', async () => {
        const k = structuredClone(payments);
        failedPayment(k).date_created = '2026-09-20T20:01:40.000-04:00';
        const emptyMap = await resolveUnnamedChargeRecords({
            authorizationId: AUTH,
            records: records.results as MercadoPagoChargeRecord[],
            send: async () => new Response(JSON.stringify(k))
        });
        expect([...emptyMap].map(([record, paymentId]) => [String(record.id), paymentId])).toEqual(
            []
        );
    });
});
