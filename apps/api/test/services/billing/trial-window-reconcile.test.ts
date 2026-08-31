/**
 * Tests for HOS-936's creation-time trial reconciliation.
 *
 * The measured incident is reproduced end-to-end here, not just in the pure
 * derivation: a local row promising 30 days, a preapproval whose
 * `next_payment_date` equals its `date_created`, and the assertion that the
 * promise is cleared. The same fixture carries the identical
 * `auto_recurring.free_trial` MercadoPago advertised, so a regression that
 * starts believing it again writes no correction and fails here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/env.js', () => ({
    env: { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token' }
}));
vi.mock('../../../src/utils/env', () => ({
    env: { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token' }
}));

const loggerErrorMock = vi.fn();
const loggerWarnMock = vi.fn();
vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        error: (...args: unknown[]) => loggerErrorMock(...args),
        warn: (...args: unknown[]) => loggerWarnMock(...args),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@repo/db', () => ({
    billingSubscriptions: {
        id: 'id',
        trialStart: 'trial_start',
        trialEnd: 'trial_end',
        updatedAt: 'updated_at'
    },
    eq: (...args: unknown[]) => ({ __eq: args }),
    getDb: () => {
        throw new Error('getDb() must not be reached — every test injects its own client');
    }
}));

import { reconcileTrialWindowAgainstProvider } from '../../../src/services/billing/trial-window-reconcile.js';
import { env } from '../../../src/utils/env.js';

const LOCAL_SUBSCRIPTION_ID = 'sub-local-1';
const MP_PREAPPROVAL_ID = '54889b0a';

/** The trial terms MercadoPago advertised on BOTH measured preapprovals. */
const ADVERTISED_TRIAL_TERMS = {
    free_trial: { frequency: 30, frequency_type: 'days' },
    first_invoice_offset: 30
} as const;

/**
 * Minimal Drizzle stub: one `select(...).from(...).where(...).limit()` chain
 * resolving to `rows`, and one recording `update(...).set(...).where(...)`.
 */
function makeDbStub(rows: Array<{ trialStart: Date | null; trialEnd: Date | null }>) {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    return {
        setMock,
        client: {
            select: () => ({
                from: () => ({
                    where: () => ({ limit: () => Promise.resolve(rows) })
                })
            }),
            update: () => ({ set: setMock })
        } as never
    };
}

/** A `fetch` double answering the raw `GET /preapproval/{id}` with `body`. */
function makeFetchStub(body: unknown, status = 200) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body)
    }) as unknown as typeof fetch;
}

const promisedTrialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const rowPromisingATrial = [{ trialStart: new Date(), trialEnd: promisedTrialEnd }];

beforeEach(() => {
    loggerErrorMock.mockClear();
    loggerWarnMock.mockClear();
});

describe('reconcileTrialWindowAgainstProvider — the measured incident', () => {
    it('clears the promised window when next_payment_date equals date_created', async () => {
        // Arrange — the 2nd measured preapproval: same payer, same plan, and an
        // `auto_recurring` identical to the one that WAS honoured.
        const created = new Date('2026-08-31T03:28:04.000Z');
        const { client, setMock } = makeDbStub(rowPromisingATrial);
        const fetchImpl = makeFetchStub({
            id: MP_PREAPPROVAL_ID,
            date_created: created.toISOString(),
            next_payment_date: created.toISOString(),
            auto_recurring: { ...ADVERTISED_TRIAL_TERMS }
        });

        // Act
        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl
        });

        // Assert — the promise is retracted, both columns at once.
        expect(result.outcome).toBe('corrected');
        expect(result.deferralMs).toBe(0);
        expect(setMock).toHaveBeenCalledTimes(1);
        const written = setMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(written.trialStart).toBeNull();
        expect(written.trialEnd).toBeNull();
    });

    it('reports the correction to Sentry — a broken promise is actionable', async () => {
        const created = new Date('2026-08-31T03:28:04.000Z');
        const { client } = makeDbStub(rowPromisingATrial);
        const fetchImpl = makeFetchStub({
            date_created: created.toISOString(),
            next_payment_date: created.toISOString()
        });

        await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl
        });

        expect(loggerErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ localSubscriptionId: LOCAL_SUBSCRIPTION_ID, deferralMs: 0 }),
            expect.stringContaining('did not grant the free trial'),
            { capture: true }
        );
    });

    it('leaves the window alone when the provider DID defer the charge', async () => {
        // Arrange — the 1st measured preapproval, 30 days out.
        const created = new Date('2026-08-31T03:28:02.000Z');
        const { client, setMock } = makeDbStub(rowPromisingATrial);
        const fetchImpl = makeFetchStub({
            date_created: created.toISOString(),
            next_payment_date: new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            auto_recurring: { ...ADVERTISED_TRIAL_TERMS }
        });

        // Act
        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl
        });

        // Assert
        expect(result.outcome).toBe('confirmed');
        expect(setMock).not.toHaveBeenCalled();
        expect(loggerErrorMock).not.toHaveBeenCalled();
    });
});

describe('reconcileTrialWindowAgainstProvider — it only ever narrows', () => {
    it('never calls MercadoPago for a row that promises no trial', async () => {
        const { client, setMock } = makeDbStub([{ trialStart: null, trialEnd: null }]);
        const fetchImpl = makeFetchStub({});

        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl
        });

        expect(result.outcome).toBe('no-local-trial');
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(setMock).not.toHaveBeenCalled();
    });

    it('writes nothing when the row does not exist', async () => {
        const { client, setMock } = makeDbStub([]);
        const fetchImpl = makeFetchStub({});

        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl
        });

        expect(result.outcome).toBe('no-local-trial');
        expect(setMock).not.toHaveBeenCalled();
    });

    it('writes nothing when the provider response carries neither date', async () => {
        // An unreadable answer must never strip a trial. This is the direction
        // that would silently cost customers a benefit they were sold.
        const { client, setMock } = makeDbStub(rowPromisingATrial);
        const fetchImpl = makeFetchStub({ id: MP_PREAPPROVAL_ID, status: 'authorized' });

        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl
        });

        expect(result.outcome).toBe('indeterminate');
        expect(setMock).not.toHaveBeenCalled();
    });

    it('writes nothing, and never calls MercadoPago, without an access token', async () => {
        // An unconfigured environment must not look like "no trial granted".
        const { client, setMock } = makeDbStub(rowPromisingATrial);
        const fetchImpl = makeFetchStub({});
        const realToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
        (env as { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN?: string }).HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN =
            '';

        try {
            const result = await reconcileTrialWindowAgainstProvider({
                localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
                mpPreapprovalId: MP_PREAPPROVAL_ID,
                db: client,
                fetchImpl
            });

            expect(result.outcome).toBe('indeterminate');
            expect(fetchImpl).not.toHaveBeenCalled();
            expect(setMock).not.toHaveBeenCalled();
            expect(loggerWarnMock).toHaveBeenCalledWith(
                expect.objectContaining({ localSubscriptionId: LOCAL_SUBSCRIPTION_ID }),
                expect.stringContaining('ACCESS_TOKEN not configured')
            );
        } finally {
            (
                env as { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN?: string }
            ).HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = realToken;
        }
    });

    it('writes nothing when MercadoPago answers 404', async () => {
        const { client, setMock } = makeDbStub(rowPromisingATrial);
        const fetchImpl = makeFetchStub({}, 404);

        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl
        });

        expect(result.outcome).toBe('indeterminate');
        expect(setMock).not.toHaveBeenCalled();
    });
});

describe('reconcileTrialWindowAgainstProvider — never fails the checkout', () => {
    it('swallows a network failure and reports indeterminate', async () => {
        const { client, setMock } = makeDbStub(rowPromisingATrial);
        const fetchImpl = vi
            .fn()
            .mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;

        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl
        });

        expect(result.outcome).toBe('indeterminate');
        expect(setMock).not.toHaveBeenCalled();
    });

    it('swallows a non-Error rejection too', async () => {
        // The catch stringifies whatever it caught. A thrown string must not
        // escape as `undefined` in the log and must not reach the caller.
        const client = {
            select: () => {
                throw 'connection terminated unexpectedly';
            }
        } as never;

        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl: makeFetchStub({})
        });

        expect(result.outcome).toBe('indeterminate');
        expect(loggerWarnMock).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'connection terminated unexpectedly' }),
            expect.stringContaining('reconciliation failed')
        );
    });

    it('degrades instead of throwing when no client is injected', async () => {
        // Exercises the `getDb()` default. The mock makes it throw, which is
        // the point: even a database that cannot be reached at all must not
        // take the checkout down with it.
        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            fetchImpl: makeFetchStub({})
        });

        expect(result.outcome).toBe('indeterminate');
    });

    it('swallows a database failure and reports indeterminate', async () => {
        const client = {
            select: () => {
                throw new Error('connection terminated');
            }
        } as never;

        const result = await reconcileTrialWindowAgainstProvider({
            localSubscriptionId: LOCAL_SUBSCRIPTION_ID,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            db: client,
            fetchImpl: makeFetchStub({})
        });

        expect(result.outcome).toBe('indeterminate');
        expect(loggerWarnMock).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'connection terminated' }),
            expect.stringContaining('reconciliation failed')
        );
    });
});
