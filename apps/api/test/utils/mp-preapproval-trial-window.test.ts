/**
 * Tests for the raw MercadoPago preapproval trial-window lookup (HOS-936).
 *
 * This wrapper exists because qzpay's mapped subscription shape carries neither
 * `date_created` nor `next_payment_date`, so the only way to reach them is the
 * REST resource directly. Its whole contract is "never throws" — it sits on the
 * checkout hot path, where a failure must degrade into a verdict the caller can
 * ignore rather than into a failed checkout. So the error paths are the point of
 * this file, not an afterthought: each one is asserted to produce its own
 * distinguishable `kind`, because a caller that cannot tell a 404 from a timeout
 * cannot log anything useful about either.
 */
import { describe, expect, it, vi } from 'vitest';
import { fetchPreapprovalTrialWindow } from '../../src/utils/mp-preapproval-trial-window.js';

const PREAPPROVAL_ID = '54889b0a';
const ACCESS_TOKEN = 'TEST-token';
const DAY_MS = 24 * 60 * 60 * 1000;

/** A `fetch` double answering with `body` at `status`. */
function makeFetchStub(body: unknown, status = 200) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body)
    }) as unknown as typeof fetch;
}

async function run(fetchImpl: typeof fetch) {
    return fetchPreapprovalTrialWindow({
        preapprovalId: PREAPPROVAL_ID,
        accessToken: ACCESS_TOKEN,
        fetchImpl
    });
}

describe('fetchPreapprovalTrialWindow — the happy path', () => {
    it('derives a granted window from the provider’s own dates', async () => {
        const created = new Date('2026-08-31T03:28:02.000Z');
        const result = await run(
            makeFetchStub({
                id: PREAPPROVAL_ID,
                date_created: created.toISOString(),
                next_payment_date: new Date(created.getTime() + 30 * DAY_MS).toISOString()
            })
        );

        expect(result.kind).toBe('ok');
        if (result.kind !== 'ok') return;
        expect(result.window.outcome).toBe('granted');
        expect(result.window.deferralMs).toBe(30 * DAY_MS);
    });

    it('derives `not-granted` when the first charge is due at creation', async () => {
        const created = new Date('2026-08-31T03:28:04.000Z');
        const result = await run(
            makeFetchStub({
                date_created: created.toISOString(),
                next_payment_date: created.toISOString(),
                // The terms MercadoPago advertised on the measured preapproval.
                // Present on purpose: reading them would flip this verdict.
                auto_recurring: { free_trial: { frequency: 30, frequency_type: 'days' } }
            })
        );

        expect(result.kind).toBe('ok');
        if (result.kind !== 'ok') return;
        expect(result.window.outcome).toBe('not-granted');
    });

    it('sends a bearer token to the preapproval resource, not the search endpoint', async () => {
        // The finding verified both; `search` reports its own inconsistent view,
        // and the single-resource GET is the one that agreed with what
        // MercadoPago went on to charge.
        const fetchImpl = makeFetchStub({});
        await run(fetchImpl);

        const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            RequestInit & { headers: Record<string, string> }
        ];
        expect(url).toBe(`https://api.mercadopago.com/preapproval/${PREAPPROVAL_ID}`);
        expect(url).not.toContain('/search');
        expect(init.method).toBe('GET');
        expect(init.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    });

    it('reports `ok` with an `unknown` window when the body carries neither date', async () => {
        // The call succeeded; it simply cannot support a verdict. That is not an
        // error, and conflating the two would let a caller "correct" a row off a
        // response it never actually read.
        const result = await run(makeFetchStub({ id: PREAPPROVAL_ID, status: 'authorized' }));

        expect(result.kind).toBe('ok');
        if (result.kind !== 'ok') return;
        expect(result.window.outcome).toBe('unknown');
    });
});

describe('fetchPreapprovalTrialWindow — every failure is its own kind', () => {
    it('maps 404 to `not-found`', async () => {
        expect((await run(makeFetchStub({}, 404))).kind).toBe('not-found');
    });

    it.each([401, 403])('maps %i to `unauthorized`', async (status) => {
        expect((await run(makeFetchStub({}, status))).kind).toBe('unauthorized');
    });

    it('maps any other non-ok status to `error`, naming the status', async () => {
        const result = await run(makeFetchStub({}, 500));

        expect(result.kind).toBe('error');
        if (result.kind !== 'error') return;
        expect(result.message).toContain('500');
    });

    it('aborts a hung request on its own deadline and maps it to `error`', async () => {
        // Drives the real AbortController: the stub never resolves on its own
        // and only settles when the module's own timer fires `abort()`. That is
        // what proves the deadline exists — a stub that simply rejects with an
        // AbortError would assert the mapping while leaving the timer untested.
        const fetchImpl = vi.fn().mockImplementation(
            (_url: string, init: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        const abortError = new Error('The operation was aborted');
                        abortError.name = 'AbortError';
                        reject(abortError);
                    });
                })
        ) as unknown as typeof fetch;

        const result = await fetchPreapprovalTrialWindow({
            preapprovalId: PREAPPROVAL_ID,
            accessToken: ACCESS_TOKEN,
            timeoutMs: 25,
            fetchImpl
        });

        expect(result.kind).toBe('error');
        if (result.kind !== 'error') return;
        expect(result.message).toContain('timed out');
        expect(result.message).toContain('25ms');
    });

    it('maps a network failure to `error`, carrying its message', async () => {
        const fetchImpl = vi
            .fn()
            .mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;

        const result = await run(fetchImpl);

        expect(result.kind).toBe('error');
        if (result.kind !== 'error') return;
        expect(result.message).toBe('ECONNRESET');
    });

    it('maps an unparseable body to `error` instead of throwing', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.reject(new Error('Unexpected end of JSON input'))
        }) as unknown as typeof fetch;

        const result = await run(fetchImpl);

        expect(result.kind).toBe('error');
    });

    it('never throws, whatever the provider does', async () => {
        // The contract the checkout path depends on, asserted directly rather
        // than inferred from the cases above.
        const throwingFetch = vi.fn().mockImplementation(() => {
            throw 'a non-Error rejection';
        }) as unknown as typeof fetch;

        await expect(run(throwingFetch)).resolves.toMatchObject({ kind: 'error' });
    });
});
