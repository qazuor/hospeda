/**
 * TEST:1710:6-7 AC:1710:5-6. Payment and record payloads are byte-for-byte copies of the
 * 2026-10-19 raw captures; altered edge cases below are structured clones. The empty refunded
 * authorization result is synthetic because its records were not measured.
 */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';

type Json = {
    readonly [key: string]: unknown;
    results?: Json[];
    paging?: { readonly [key: string]: unknown; total?: number };
    id?: string | number;
    payment?: Json | null;
    date_created?: string;
    expire_date?: string | null;
    status?: number;
};
const load = (name: string) =>
    JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as Json;
const records = load('mercadopago-authorized-payments-renewals-2026-10-19.json') as Json & {
    results: Json[];
};
const rejected = load('mercadopago-renewal-payment-rejected-2026-10-19.json');
const approved = load('mercadopago-renewal-payment-approved-2026-10-19.json');
const refunded = load('mercadopago-recurring-payment-refunded-2026-10-19.json');
const empty = { results: [], paging: { offset: 0, limit: 10, total: 0 } };
const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00.000Z') });
const AUTH = '6b293a9499d946f6ac159da7f8f4804e';
function adapterFor(payment: Json, chargeRecords: Json = records) {
    const paths: string[] = [];
    const queries: URL[] = [];
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'test-token',
        fetch: async (input) => {
            const url = new URL(String(input));
            paths.push(url.pathname);
            queries.push(url);
            const isChargeSearch = url.pathname === '/authorized_payments/search';
            const incompleteNextPage =
                url.searchParams.get('offset') === '10' && chargeRecords.paging?.total === 7;
            const payload = incompleteNextPage
                ? { results: [], paging: { offset: 10, limit: 10, total: 7 } }
                : isChargeSearch
                  ? chargeRecords
                  : payment;
            return new Response(JSON.stringify(payload), {
                status: isChargeSearch && chargeRecords.status === 500 ? 500 : 200,
                headers: { 'content-type': 'application/json' }
            });
        }
    });
    return { adapter, paths, queries };
}
const rejectedExpected = {
    chargeId: '179087989627',
    createdAt: '2026-09-20T20:01:44.000-04:00',
    expiresAt: '2026-09-21T20:01:41.000-04:00',
    purpose: 'charge',
    authorizationId: AUTH,
    reference: 'HOS-1352-relojprod-renov-ok',
    status: 'rejected',
    declineReason: 'cc_rejected_high_risk',
    amount: { amountMinor: 1500, currency: 'ARS' },
    refundedAmount: { amountMinor: 0, currency: 'ARS' },
    chargedBack: false
};

describe('TEST:1710:6 AC:1710:5-6 measured charge window reads', () => {
    it('TEST:1710:6 AC:1710:5 selects failed cycle by date and sends bounded pagination', async () => {
        const { adapter, paths, queries } = adapterFor(rejected);
        expect((await adapter.readCharge({ chargeId: '179087989627' })).snapshot).toEqual(
            rejectedExpected
        );
        expect(paths).toEqual(['/v1/payments/179087989627', '/authorized_payments/search']);
        expect(Object.fromEntries(queries[1]!.searchParams)).toEqual({
            preapproval_id: AUTH,
            limit: '10',
            offset: '0'
        });
    });
    it('TEST:1710:6 AC:1710:5 chooses the record naming an approved payment despite overlap', async () => {
        const { adapter } = adapterFor(approved);
        expect((await adapter.readCharge({ chargeId: '179941738878' })).snapshot).toEqual({
            chargeId: '179941738878',
            createdAt: '2026-09-19T20:01:54.000-04:00',
            expiresAt: '2026-09-20T20:01:50.000-04:00',
            purpose: 'charge',
            authorizationId: AUTH,
            reference: 'HOS-1352-relojprod-renov-ok',
            status: 'approved',
            declineReason: null,
            amount: { amountMinor: 1500, currency: 'ARS' },
            refundedAmount: { amountMinor: 0, currency: 'ARS' },
            chargedBack: false
        });
    });
    it('TEST:1710:6 AC:1710:5 keeps selection stable with ascending record order', async () => {
        const reversed = structuredClone(records);
        reversed.results.reverse();
        expect(
            (await adapterFor(rejected, reversed).adapter.readCharge({ chargeId: '179087989627' }))
                .snapshot
        ).toEqual(rejectedExpected);
        expect(
            (await adapterFor(approved, reversed).adapter.readCharge({ chargeId: '179941738878' }))
                .snapshot.expiresAt
        ).toBe('2026-09-20T20:01:50.000-04:00');
    });
    it('TEST:1710:6 AC:1710:5 reads a fully refunded recurring payment without an unmeasured window', async () => {
        expect(
            (await adapterFor(refunded, empty).adapter.readCharge({ chargeId: '168470636028' }))
                .snapshot
        ).toEqual({
            chargeId: '168470636028',
            createdAt: '2026-07-12T13:01:56.000-04:00',
            expiresAt: null,
            purpose: 'charge',
            authorizationId: 'eebf948419bb4cdfaf8f5f3d73fe05ed',
            reference: '3e890bee-bbc5-4a30-ac8a-1457b680948c',
            status: 'approved',
            declineReason: null,
            amount: { amountMinor: 1500, currency: 'ARS' },
            refundedAmount: { amountMinor: 1500, currency: 'ARS' },
            chargedBack: false
        });
    });
});

describe('TEST:1710:7 AC:1710:5-6 boundary and failure variants', () => {
    it('TEST:1710:7 AC:1710:5 prioritizes a matching payment when its record date is later', async () => {
        const variant = structuredClone(records);
        variant.results.find((r: Json) => r.id === 7032086953)!.date_created =
            '2026-09-19T20:01:55.000-04:00';
        expect(
            (await adapterFor(approved, variant).adapter.readCharge({ chargeId: '179941738878' }))
                .snapshot.expiresAt
        ).toBe('2026-09-20T20:01:50.000-04:00');
    });
    it('TEST:1710:7 AC:1710:5 returns null before the first record, for absent or elapsed expiry', async () => {
        const before = structuredClone(rejected);
        before.date_created = '2026-09-15T00:00:00.000-04:00';
        expect(
            (await adapterFor(before).adapter.readCharge({ chargeId: String(before.id) })).snapshot
                .expiresAt
        ).toBeNull();
        const noExpiry = structuredClone(records);
        delete noExpiry.results[0]!.expire_date;
        expect(
            (
                await adapterFor(rejected, {
                    results: [noExpiry.results[0]!],
                    paging: { total: 1 }
                }).adapter.readCharge({ chargeId: String(rejected.id) })
            ).snapshot.expiresAt
        ).toBeNull();
        const atExpiry = structuredClone(rejected);
        atExpiry.date_created = '2026-09-21T20:01:41.000-04:00';
        expect(
            (await adapterFor(atExpiry).adapter.readCharge({ chargeId: String(atExpiry.id) }))
                .snapshot.expiresAt
        ).toBeNull();
        const equalCreated = structuredClone(rejected);
        equalCreated.date_created = '2026-09-20T20:01:41.000-04:00';
        expect(
            (
                await adapterFor(equalCreated).adapter.readCharge({
                    chargeId: String(equalCreated.id)
                })
            ).snapshot.expiresAt
        ).toBe('2026-09-21T20:01:41.000-04:00');
    });
    it('TEST:1710:7 AC:1710:5 does not request records for card validation', async () => {
        const card = structuredClone(rejected);
        Object.assign(card, {
            transaction_amount: 0,
            external_reference: null,
            metadata: {},
            point_of_interaction: { type: 'UNSPECIFIED' }
        });
        const { adapter, paths } = adapterFor(card);
        expect(
            (await adapter.readCharge({ chargeId: String(card.id) })).snapshot.expiresAt
        ).toBeNull();
        expect(paths).toEqual(['/v1/payments/179087989627']);
    });
    it('TEST:1710:7 AC:1710:6 fails closed for HTTP errors, duplicate names, invalid dates, ties and incomplete pages', async () => {
        const fail = async (variant: Json, payment = rejected) =>
            expect(
                adapterFor(payment, variant).adapter.readCharge({ chargeId: String(payment.id) })
            ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        await fail({ status: 500 });
        const duplicate = structuredClone(records);
        duplicate.results.push(
            structuredClone(
                duplicate.results.find((r: Json) => r.payment?.id === Number(rejected.id)) ??
                    duplicate.results[0]!
            )
        );
        duplicate.results.at(-1)!.payment = { id: Number(rejected.id) };
        duplicate.results.push({
            id: 998,
            date_created: '2026-09-20T20:01:40.000-04:00',
            payment: { id: Number(rejected.id) }
        });
        await fail(duplicate);
        const missingDate = {
            results: [{ id: 1, payment: null, expire_date: null }],
            paging: { total: 1 }
        };
        await fail(missingDate);
        const tie = structuredClone(records);
        tie.results.push({ id: 999, date_created: '2026-09-20T20:01:41.000-04:00' });
        await fail(tie);
        const incomplete = { results: records.results, paging: { offset: 0, limit: 10, total: 7 } };
        await fail(incomplete);
        const badExpiry = structuredClone(records);
        badExpiry.results[0]!.expire_date = 'not-a-date';
        await fail({ results: [badExpiry.results[0]!], paging: { total: 1 } });
    });
});
