/**
 * Unit tests: HOS-765 paced MercadoPago reconciliation client + parsers.
 *
 * Coverage:
 * - `MpPacedClient` pacing gate: two concurrent `getJson` calls serialize.
 * - 429 retry: succeeds after a retry, tracks `rateLimitedCount`, and sleeps
 *   with the documented backoff values.
 * - 429 persistent: exhausts retries and throws, `rateLimitedCount` reflects
 *   every attempt.
 * - 404 -> `null` (not a throw). Any other error status -> throws.
 * - The gate does not poison: a failed call does not block the next one.
 * - `extractPreapprovalId`: metadata, `point_of_interaction` fallback, and the
 *   normal `null` case (the $0 authorization charge).
 * - `parsePaymentRecord` / `parsePreapprovalRecord`: field mapping, missing id
 *   -> `null`, and `""` normalizing to `null` (critical for
 *   `preapproval.payer_email`, which is empty on every real preapproval).
 * - `searchApprovedPayments` / `searchPreapprovals`: pagination until
 *   exhausted, `truncated: true` at the page ceiling, `truncated: false` on a
 *   short last page.
 * - `fetchPaymentById` / `fetchPreapprovalById`: 404 -> null, 200 -> parsed.
 *
 * @module test/utils/mp-reconciliation-search
 */

import { describe, expect, it, vi } from 'vitest';
import {
    extractPreapprovalId,
    fetchPaymentById,
    fetchPreapprovalById,
    MP_RECONCILIATION_TUNING,
    MpPacedClient,
    parsePaymentRecord,
    parsePreapprovalRecord,
    searchApprovedPayments,
    searchPreapprovals
} from '../../src/utils/mp-reconciliation-search';

/** Builds a `Response` the way the real `fetch` would for a JSON body. */
function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

/** A raw MercadoPago payment object, overridable per test. */
function makeMpPayment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'pay-1',
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100,
        currency_id: 'ARS',
        date_created: '2026-08-01T00:00:00.000Z',
        date_approved: '2026-08-01T00:00:05.000Z',
        payer: { email: 'buyer@example.com', id: 'payer-1' },
        metadata: { preapproval_id: 'pa-1' },
        external_reference: 'ref-1',
        description: 'monthly charge',
        ...overrides
    };
}

/** A raw MercadoPago preapproval object, overridable per test. */
function makeMpPreapproval(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'pa-1',
        status: 'authorized',
        reason: 'Plan mensual',
        auto_recurring: { transaction_amount: 500, currency_id: 'ARS' },
        date_created: '2026-08-01T00:00:00.000Z',
        next_payment_date: '2026-09-01T00:00:00.000Z',
        external_reference: 'nonce-1',
        preapproval_plan_id: 'plan-1',
        payer_id: 'payer-1',
        // Measured EMPTY on every real preapproval — see the module JSDoc.
        payer_email: '',
        ...overrides
    };
}

/** A `/v1/payments/search` or `/preapproval/search` page. */
function makeSearchPage(params: {
    readonly results: readonly Record<string, unknown>[];
    readonly total?: number;
}): Record<string, unknown> {
    return {
        results: params.results,
        paging: { total: params.total ?? params.results.length }
    };
}

/** A no-op sleep, so retry/backoff tests do not actually wait. */
const instantSleep = async (_ms: number) => {
    /* no-op */
};

describe('MpPacedClient — pacing gate', () => {
    it('serializes two concurrent getJson calls: the second never starts before the first ends', async () => {
        const events: string[] = [];
        let callIndex = 0;

        const fetchImpl = vi.fn(async () => {
            const idx = ++callIndex;
            events.push(`start-${idx}`);
            if (idx === 1) {
                // A real async delay: if the gate failed to serialize, call 2
                // (which resolves immediately) would finish first.
                await new Promise((resolve) => setTimeout(resolve, 30));
            }
            events.push(`end-${idx}`);
            return jsonResponse({});
        });

        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            minIntervalMs: 0,
            sleepImpl: instantSleep
        });

        await Promise.all([client.getJson('/a'), client.getJson('/b')]);

        expect(events).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('retries once on 429 and succeeds, incrementing rateLimitedCount and sleeping the documented backoff', async () => {
        let call = 0;
        const fetchImpl = vi.fn(async () => {
            call += 1;
            if (call === 1) {
                return jsonResponse({ message: 'rate limited' }, 429);
            }
            return jsonResponse({ ok: true });
        });
        const sleepImpl = vi.fn(instantSleep);

        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl
        });

        const result = await client.getJson('/v1/payments/1');

        expect(result).toEqual({ ok: true });
        expect(client.rateLimitedCount).toBe(1);
        expect(client.callCount).toBe(2);
        // Sequence: pace before attempt 1, backoff after the 429, pace before
        // attempt 2. The default pacing floor is MIN_CALL_INTERVAL_MS (350ms);
        // the backoff before the first retry is the documented 1000ms — much
        // larger than the pacing floor, on purpose (see RETRY_BACKOFF_MS JSDoc).
        expect(sleepImpl.mock.calls).toEqual([
            [MP_RECONCILIATION_TUNING.MIN_CALL_INTERVAL_MS],
            [1_000],
            [MP_RECONCILIATION_TUNING.MIN_CALL_INTERVAL_MS]
        ]);
    });

    it('throws after exhausting retries on a persistent 429, with rateLimitedCount reflecting every attempt', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ message: 'rate limited' }, 429));

        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl: instantSleep
        });

        await expect(client.getJson('/v1/payments/1')).rejects.toThrow(/rate-limited/i);

        // MAX_RETRIES_ON_RATE_LIMIT retries plus the original attempt.
        const expectedAttempts = MP_RECONCILIATION_TUNING.MAX_RETRIES_ON_RATE_LIMIT + 1;
        expect(fetchImpl).toHaveBeenCalledTimes(expectedAttempts);
        expect(client.rateLimitedCount).toBe(expectedAttempts);
        expect(client.callCount).toBe(expectedAttempts);
    });

    it('returns null on 404 without throwing', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(null, 404));
        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl: instantSleep
        });

        const result = await client.getJson('/v1/payments/missing');

        expect(result).toBeNull();
    });

    it('throws on a non-404 error status', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ message: 'boom' }, 500));
        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl: instantSleep
        });

        await expect(client.getJson('/v1/payments/1')).rejects.toThrow(/HTTP 500/);
    });

    it('does not poison the gate: a failed call is followed by a successful one on the same client', async () => {
        let call = 0;
        const fetchImpl = vi.fn(async () => {
            call += 1;
            if (call === 1) {
                return jsonResponse({ message: 'boom' }, 500);
            }
            return jsonResponse({ ok: true });
        });

        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl: instantSleep
        });

        await expect(client.getJson('/v1/payments/1')).rejects.toThrow(/HTTP 500/);

        // The gate itself must never reject downstream callers — the next call
        // on this same client still runs.
        const second = await client.getJson('/v1/payments/2');
        expect(second).toEqual({ ok: true });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
});

describe('extractPreapprovalId', () => {
    it('reads metadata.preapproval_id when present', () => {
        expect(extractPreapprovalId({ metadata: { preapproval_id: 'pa-abc' } })).toBe('pa-abc');
    });

    it('falls back to point_of_interaction.transaction_data.subscription_id', () => {
        expect(
            extractPreapprovalId({
                point_of_interaction: { transaction_data: { subscription_id: 'pa-xyz' } }
            })
        ).toBe('pa-xyz');
    });

    it('prefers metadata over point_of_interaction when both are present', () => {
        expect(
            extractPreapprovalId({
                metadata: { preapproval_id: 'pa-from-metadata' },
                point_of_interaction: { transaction_data: { subscription_id: 'pa-from-poi' } }
            })
        ).toBe('pa-from-metadata');
    });

    it('returns null when neither source names a preapproval — the normal $0-authorization-charge case', () => {
        // Documented in the module JSDoc: the $0 validation charge carries the
        // payer email but reports no subscription at all. This is NOT a
        // parsing failure.
        expect(extractPreapprovalId({ metadata: {}, point_of_interaction: {} })).toBeNull();
        expect(extractPreapprovalId({})).toBeNull();
    });

    it('ignores an empty-string preapproval_id and falls through to the point_of_interaction source', () => {
        expect(
            extractPreapprovalId({
                metadata: { preapproval_id: '' },
                point_of_interaction: { transaction_data: { subscription_id: 'pa-xyz' } }
            })
        ).toBe('pa-xyz');
    });
});

describe('parsePaymentRecord', () => {
    it('maps every field from a well-formed payment', () => {
        const record = parsePaymentRecord(makeMpPayment());

        expect(record).toEqual({
            id: 'pay-1',
            status: 'approved',
            statusDetail: 'accredited',
            transactionAmount: 100,
            currencyId: 'ARS',
            dateCreated: '2026-08-01T00:00:00.000Z',
            dateApproved: '2026-08-01T00:00:05.000Z',
            payerEmail: 'buyer@example.com',
            payerId: 'payer-1',
            preapprovalId: 'pa-1',
            externalReference: 'ref-1',
            description: 'monthly charge'
        });
    });

    it('returns null when the raw payment has no id', () => {
        const { id: _omit, ...withoutId } = makeMpPayment();
        expect(parsePaymentRecord(withoutId)).toBeNull();
    });

    it('normalizes an empty payer.email to null, not an empty string', () => {
        const record = parsePaymentRecord(makeMpPayment({ payer: { email: '', id: 'payer-1' } }));
        expect(record?.payerEmail).toBeNull();
    });

    it('normalizes a missing status_detail to null', () => {
        const { status_detail: _omit, ...withoutDetail } = makeMpPayment();
        const record = parsePaymentRecord(withoutDetail);
        expect(record?.statusDetail).toBeNull();
    });

    it('resolves preapprovalId to null when the payment names none (the $0 authorization charge)', () => {
        const record = parsePaymentRecord(
            makeMpPayment({ metadata: {}, point_of_interaction: undefined })
        );
        expect(record?.preapprovalId).toBeNull();
    });
});

describe('parsePreapprovalRecord', () => {
    it('maps every field from a well-formed preapproval', () => {
        const record = parsePreapprovalRecord(makeMpPreapproval());

        expect(record).toEqual({
            id: 'pa-1',
            status: 'authorized',
            reason: 'Plan mensual',
            transactionAmount: 500,
            currencyId: 'ARS',
            dateCreated: '2026-08-01T00:00:00.000Z',
            nextPaymentDate: '2026-09-01T00:00:00.000Z',
            externalReference: 'nonce-1',
            preapprovalPlanId: 'plan-1',
            payerId: 'payer-1',
            payerEmail: null
        });
    });

    it('returns null when the raw preapproval has no id', () => {
        const { id: _omit, ...withoutId } = makeMpPreapproval();
        expect(parsePreapprovalRecord(withoutId)).toBeNull();
    });

    it('normalizes an empty payer_email to null — the critical, always-true-in-practice case', () => {
        const record = parsePreapprovalRecord(makeMpPreapproval({ payer_email: '' }));
        expect(record?.payerEmail).toBeNull();
    });

    it('reports transactionAmount/currencyId as null when auto_recurring is absent', () => {
        const { auto_recurring: _omit, ...withoutAutoRecurring } = makeMpPreapproval();
        const record = parsePreapprovalRecord(withoutAutoRecurring);
        expect(record?.transactionAmount).toBeNull();
        expect(record?.currencyId).toBeNull();
    });
});

describe('searchApprovedPayments — pagination', () => {
    it('returns truncated:false and reportedTotal when the sweep finishes on a short page', async () => {
        const fullPage = Array.from({ length: MP_RECONCILIATION_TUNING.MP_MAX_PAGE_SIZE }, (_, i) =>
            makeMpPayment({ id: `pay-full-${i}` })
        );
        const shortPage = Array.from({ length: 20 }, (_, i) =>
            makeMpPayment({ id: `pay-tail-${i}` })
        );

        let call = 0;
        const fetchImpl = vi.fn(async () => {
            call += 1;
            if (call <= 2) {
                return jsonResponse(makeSearchPage({ results: fullPage, total: 120 }));
            }
            return jsonResponse(makeSearchPage({ results: shortPage, total: 120 }));
        });

        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            minIntervalMs: 0,
            sleepImpl: instantSleep
        });

        const result = await searchApprovedPayments({ client, since: new Date('2026-01-01') });

        expect(result.truncated).toBe(false);
        expect(result.items).toHaveLength(
            MP_RECONCILIATION_TUNING.MP_MAX_PAGE_SIZE * 2 + shortPage.length
        );
        expect(result.reportedTotal).toBe(120);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('marks truncated:true when the sweep hits MAX_PAGES_PER_SWEEP with the last page still full', async () => {
        const fullPage = Array.from({ length: MP_RECONCILIATION_TUNING.MP_MAX_PAGE_SIZE }, (_, i) =>
            makeMpPayment({ id: `pay-${i}` })
        );
        const fetchImpl = vi.fn(async () => jsonResponse(makeSearchPage({ results: fullPage })));

        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            minIntervalMs: 0,
            sleepImpl: instantSleep
        });

        const result = await searchApprovedPayments({ client, since: new Date('2026-01-01') });

        expect(result.truncated).toBe(true);
        expect(result.items).toHaveLength(
            MP_RECONCILIATION_TUNING.MAX_PAGES_PER_SWEEP * MP_RECONCILIATION_TUNING.MP_MAX_PAGE_SIZE
        );
        expect(fetchImpl).toHaveBeenCalledTimes(MP_RECONCILIATION_TUNING.MAX_PAGES_PER_SWEEP);
    });

    it('stops the sweep and returns what it has when MercadoPago answers 404', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(null, 404));
        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            minIntervalMs: 0,
            sleepImpl: instantSleep
        });

        const result = await searchApprovedPayments({ client, since: new Date('2026-01-01') });

        expect(result.items).toEqual([]);
        expect(result.truncated).toBe(false);
        expect(result.reportedTotal).toBeNull();
    });
});

describe('searchPreapprovals — pagination', () => {
    it('returns truncated:false on a single short page', async () => {
        const page = [makeMpPreapproval({ id: 'pa-1' }), makeMpPreapproval({ id: 'pa-2' })];
        const fetchImpl = vi.fn(async () =>
            jsonResponse(makeSearchPage({ results: page, total: 2 }))
        );

        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            minIntervalMs: 0,
            sleepImpl: instantSleep
        });

        const result = await searchPreapprovals({ client });

        expect(result.truncated).toBe(false);
        expect(result.items.map((item) => item.id)).toEqual(['pa-1', 'pa-2']);
        expect(result.reportedTotal).toBe(2);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('marks truncated:true when the sweep hits MAX_PAGES_PER_SWEEP with the last page still full', async () => {
        const fullPage = Array.from({ length: MP_RECONCILIATION_TUNING.MP_MAX_PAGE_SIZE }, (_, i) =>
            makeMpPreapproval({ id: `pa-${i}` })
        );
        const fetchImpl = vi.fn(async () => jsonResponse(makeSearchPage({ results: fullPage })));

        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            minIntervalMs: 0,
            sleepImpl: instantSleep
        });

        const result = await searchPreapprovals({ client });

        expect(result.truncated).toBe(true);
        expect(result.items).toHaveLength(
            MP_RECONCILIATION_TUNING.MAX_PAGES_PER_SWEEP * MP_RECONCILIATION_TUNING.MP_MAX_PAGE_SIZE
        );
    });
});

describe('fetchPaymentById / fetchPreapprovalById', () => {
    it('fetchPaymentById returns null on 404', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(null, 404));
        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl: instantSleep
        });

        expect(await fetchPaymentById({ client, mpPaymentId: 'missing' })).toBeNull();
    });

    it('fetchPaymentById returns the parsed record on 200', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(makeMpPayment({ id: 'pay-42' })));
        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl: instantSleep
        });

        const record = await fetchPaymentById({ client, mpPaymentId: 'pay-42' });
        expect(record?.id).toBe('pay-42');
    });

    it('fetchPreapprovalById returns null on 404', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(null, 404));
        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl: instantSleep
        });

        expect(await fetchPreapprovalById({ client, preapprovalId: 'missing' })).toBeNull();
    });

    it('fetchPreapprovalById returns the parsed record on 200', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(makeMpPreapproval({ id: 'pa-42' })));
        const client = new MpPacedClient({
            accessToken: 'TEST-token',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            sleepImpl: instantSleep
        });

        const record = await fetchPreapprovalById({ client, preapprovalId: 'pa-42' });
        expect(record?.id).toBe('pa-42');
    });
});
