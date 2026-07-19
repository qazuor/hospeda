/**
 * Unit tests: HOS-191 Path C linkPreapprovalToLocalSub (F2/F3 shared core).
 *
 * Coverage (outcome matrix):
 * - already linked (exact mp_subscription_id match) -> 'already'
 * - back_url ownership-verified success -> 'linked' (markLinked)
 * - back_url wrong customer -> 'idor'
 * - back_url unknown localSubscriptionId -> 'not_found'
 * - webhook exact nonce match -> 'linked' (markLinked)
 * - webhook unknown nonce -> 'not_found'
 * - webhook heuristic: 1 candidate -> 'linked' (markReconcileAssisted, viaHeuristic)
 * - webhook heuristic: 0 candidates -> 'reconcile_assisted'
 * - webhook heuristic: 2 candidates -> 'reconcile_assisted' (both marked)
 * - webhook heuristic: no access token configured -> 'not_found'
 * - live preapproval external_reference belongs to a different nonce -> 'idor'
 * - CAS race lost (concurrent linking) -> 'already'
 * - deferred discount applied on successful link (best-effort, non-blocking)
 * - FIX 1: ownership guard compares `checkout.payerEmail` (checkout-time
 *   snapshot), not a live customer lookup -> immune to live-email drift,
 *   falls back to 'reconcile_assisted' when the snapshot is unset
 *
 * @module test/services/billing/link-preapproval.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const selectResultsQueue: unknown[][] = [];
function queueSelectResult(rows: unknown[]) {
    selectResultsQueue.push(rows);
}

const dbSelectMock = vi.fn(() => ({
    from: vi.fn(() => ({
        where: vi.fn(() => ({
            limit: vi.fn(async () => selectResultsQueue.shift() ?? [])
        }))
    }))
}));

const dbMock = { select: dbSelectMock };

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/env.js', () => ({
    env: { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token' }
}));
vi.mock('../../../src/utils/env', () => ({
    env: { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token' }
}));

const fetchPreapprovalPlanIdMock = vi.fn();
vi.mock('../../../src/utils/mp-preapproval-plan-lookup.js', () => ({
    fetchPreapprovalPlanId: (...args: unknown[]) => fetchPreapprovalPlanIdMock(...args)
}));

const applySignupDiscountToMonthlyMock = vi.fn();
vi.mock('../../../src/services/subscription-discount-signup.service.js', () => ({
    applySignupDiscountToMonthly: (...args: unknown[]) => applySignupDiscountToMonthlyMock(...args)
}));

const getPromoCodeByIdMock = vi.fn();

// txCasResult controls what the CAS update (inside withServiceTransaction)
// returns: an array of rows (non-empty = CAS won).
let txCasResult: unknown[] = [{ id: 'sub-1' }];
// When set, the CAS `.returning()` throws it (simulates a Postgres error, e.g.
// the mp-id unique-violation — FIX C).
let txCasError: Error | null = null;
// Captures the `.set(...)` payload of the CAS so tests can assert the
// resurrection status flip (FIX B layer 2).
const txSetMock = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getPromoCodeById: (...args: unknown[]) => getPromoCodeByIdMock(...args),
        withServiceTransaction: vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
            const tx = {
                update: vi.fn(() => ({
                    set: vi.fn((values: unknown) => {
                        txSetMock(values);
                        return {
                            where: vi.fn(() => ({
                                returning: vi.fn(async () => {
                                    if (txCasError) {
                                        throw txCasError;
                                    }
                                    return txCasResult;
                                })
                            }))
                        };
                    })
                }))
            };
            return cb({ tx, hookState: {} });
        })
    };
});

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

const findByNonceMock = vi.fn();
const findByLocalSubscriptionIdMock = vi.fn();
const findReconcileCandidatesMock = vi.fn();
const markLinkedMock = vi.fn();
const markReconcileAssistedMock = vi.fn();

vi.mock('@repo/db', () => ({
    billingSubscriptions: {
        id: 'id',
        mpSubscriptionId: 'mp_subscription_id',
        status: 'status',
        updatedAt: 'updated_at',
        livemode: 'livemode'
    },
    billingPendingCheckoutModel: {
        findByNonce: (...args: unknown[]) => findByNonceMock(...args),
        findByLocalSubscriptionId: (...args: unknown[]) => findByLocalSubscriptionIdMock(...args),
        findReconcileCandidates: (...args: unknown[]) => findReconcileCandidatesMock(...args),
        markLinked: (...args: unknown[]) => markLinkedMock(...args),
        markReconcileAssisted: (...args: unknown[]) => markReconcileAssistedMock(...args)
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    and: vi.fn((...conds: unknown[]) => ({ op: 'and', conds })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    inArray: vi.fn((col: unknown, vals: unknown) => ({ op: 'inArray', col, vals })),
    getDb: vi.fn(() => dbMock)
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/node';
import { linkPreapprovalToLocalSub } from '../../../src/services/billing/link-preapproval.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePendingCheckout(overrides: Record<string, unknown> = {}) {
    return {
        id: 'pc-1',
        localSubscriptionId: 'sub-1',
        customerId: 'cust-1',
        planId: 'plan-1',
        mpPreapprovalPlanId: 'mp-plan-1',
        nonce: 'nonce-abc',
        payerEmail: 'user@example.com',
        pendingDiscount: null,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function makeAdapter(retrieveResult: Record<string, unknown> = {}) {
    return {
        subscriptions: {
            retrieve: vi.fn().mockResolvedValue({
                id: 'pa-1',
                status: 'active',
                externalReference: null,
                payerEmail: null,
                ...retrieveResult
            }),
            update: vi.fn().mockResolvedValue(undefined)
        }
    };
}

function makeBilling(customerEmail = 'user@example.com') {
    return {
        plans: {
            get: vi.fn().mockResolvedValue({
                id: 'plan-1',
                prices: [{ billingInterval: 'month', unitAmount: 10000 }]
            })
        },
        customers: {
            get: vi.fn().mockResolvedValue({ id: 'cust-1', email: customerEmail })
        }
    };
}

describe('linkPreapprovalToLocalSub', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectResultsQueue.length = 0;
        txCasResult = [{ id: 'sub-1' }];
        txCasError = null;
        // Default: the live preapproval's plan matches the checkout's, so the
        // FIX A ownership guard passes on the happy path. Tests that assert an
        // IDOR override this to a mismatching plan id.
        fetchPreapprovalPlanIdMock.mockResolvedValue({
            kind: 'ok',
            preapprovalPlanId: 'mp-plan-1'
        });
        findByNonceMock.mockResolvedValue(null);
        findByLocalSubscriptionIdMock.mockResolvedValue(null);
        findReconcileCandidatesMock.mockResolvedValue([]);
        markLinkedMock.mockResolvedValue(undefined);
        markReconcileAssistedMock.mockResolvedValue(undefined);
        applySignupDiscountToMonthlyMock.mockResolvedValue({
            success: true,
            data: { discountedAmountCentavos: 8000, remainingCyclesSeed: null }
        });
    });

    it('returns "already" when the preapproval is already linked', async () => {
        queueSelectResult([{ id: 'sub-existing' }]);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter() as never
        });

        expect(result).toEqual({ outcome: 'already', localSubscriptionId: 'sub-existing' });
        expect(findByNonceMock).not.toHaveBeenCalled();
        expect(findByLocalSubscriptionIdMock).not.toHaveBeenCalled();
    });

    it('links via ownership-verified back_url path (markLinked)', async () => {
        queueSelectResult([]); // no existing sub with this mp_subscription_id
        findByLocalSubscriptionIdMock.mockResolvedValue(makePendingCheckout());

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            expectedLocalSubscriptionId: 'sub-1',
            expectedCustomerId: 'cust-1',
            billing: makeBilling('user@example.com') as never,
            // FIX 1: the common legitimate back_url case — the authorized
            // preapproval carries the customer's own payer email, so the
            // fail-closed Tier 1 ownership guard positively verifies identity.
            adapter: makeAdapter({ payerEmail: 'user@example.com' }) as never
        });

        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        expect(markLinkedMock).toHaveBeenCalledWith({ id: 'pc-1' }, expect.anything());
        expect(markReconcileAssistedMock).not.toHaveBeenCalled();
    });

    it('FIX 1: refuses a back_url link (reconcile_assisted, NOT linked) when the live preapproval exposes no payer email', async () => {
        queueSelectResult([]);
        findByLocalSubscriptionIdMock.mockResolvedValue(makePendingCheckout());

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            expectedLocalSubscriptionId: 'sub-1',
            expectedCustomerId: 'cust-1',
            billing: makeBilling('user@example.com') as never,
            // Tier 1, but the preapproval has no payer email → identity cannot be
            // positively verified → fail closed (recoverable), never blind-link.
            adapter: makeAdapter({ payerEmail: null }) as never
        });

        expect(result).toEqual({ outcome: 'reconcile_assisted' });
        expect(markLinkedMock).not.toHaveBeenCalled();
        expect(markReconcileAssistedMock).not.toHaveBeenCalled();
    });

    it('FIX 1: links using the checkout-time payer-email snapshot even when the live customer account email has since drifted', async () => {
        queueSelectResult([]);
        findByLocalSubscriptionIdMock.mockResolvedValue(
            makePendingCheckout({ payerEmail: 'user@example.com' })
        );

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            expectedLocalSubscriptionId: 'sub-1',
            expectedCustomerId: 'cust-1',
            // The customer's LIVE account email has since changed (email
            // drift between checkout and return) — the ownership guard must
            // compare against `checkout.payerEmail` (the snapshot taken at
            // checkout time), never a live `billing.customers.get()` lookup,
            // or this would misread a legitimate return as a mismatch.
            billing: makeBilling('new-email@example.com') as never,
            adapter: makeAdapter({ payerEmail: 'user@example.com' }) as never
        });

        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        expect(markLinkedMock).toHaveBeenCalledWith({ id: 'pc-1' }, expect.anything());
    });

    it('FIX 1: falls back to reconcile_assisted when the checkout snapshot has no payer email (Tier 1)', async () => {
        queueSelectResult([]);
        findByLocalSubscriptionIdMock.mockResolvedValue(makePendingCheckout({ payerEmail: null }));

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            expectedLocalSubscriptionId: 'sub-1',
            expectedCustomerId: 'cust-1',
            billing: makeBilling('user@example.com') as never,
            // Live email present, but the checkout has no snapshot to compare
            // against — identity cannot be positively verified.
            adapter: makeAdapter({ payerEmail: 'user@example.com' }) as never
        });

        expect(result).toEqual({ outcome: 'reconcile_assisted' });
        expect(markLinkedMock).not.toHaveBeenCalled();
    });

    it('FIX 1: links via nonce (Tier 2) even when the live preapproval exposes no payer email', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling('user@example.com') as never,
            // Nonce tier: the unforgeable nonce already bound identity, so an
            // absent payer email must NOT degrade the trusted match.
            adapter: makeAdapter({ externalReference: 'nonce-abc', payerEmail: null }) as never
        });

        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        expect(markLinkedMock).toHaveBeenCalledWith({ id: 'pc-1' }, expect.anything());
    });

    it('returns "idor" when the caller does not own the resolved pending checkout', async () => {
        queueSelectResult([]);
        findByLocalSubscriptionIdMock.mockResolvedValue(
            makePendingCheckout({ customerId: 'cust-OTHER' })
        );

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            expectedLocalSubscriptionId: 'sub-1',
            expectedCustomerId: 'cust-1',
            billing: makeBilling() as never,
            adapter: makeAdapter() as never
        });

        expect(result).toEqual({ outcome: 'idor' });
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('returns "not_found" when expectedLocalSubscriptionId has no pending checkout', async () => {
        queueSelectResult([]);
        findByLocalSubscriptionIdMock.mockResolvedValue(null);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            expectedLocalSubscriptionId: 'sub-missing',
            expectedCustomerId: 'cust-1',
            billing: makeBilling() as never,
            adapter: makeAdapter() as never
        });

        expect(result).toEqual({ outcome: 'not_found' });
    });

    it('links via exact nonce match (webhook path, F2 already ran)', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter({ externalReference: 'nonce-abc' }) as never
        });

        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        expect(markLinkedMock).toHaveBeenCalledWith({ id: 'pc-1' }, expect.anything());
    });

    it('returns "not_found" when the nonce matches no pending checkout', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(null);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'unknown-nonce',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter() as never
        });

        expect(result).toEqual({ outcome: 'not_found' });
    });

    it('links via heuristic reconciliation when exactly one candidate matches (markReconcileAssisted)', async () => {
        queueSelectResult([]);
        fetchPreapprovalPlanIdMock.mockResolvedValue({
            kind: 'ok',
            preapprovalPlanId: 'mp-plan-1'
        });
        findReconcileCandidatesMock.mockResolvedValue([makePendingCheckout()]);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: 'user@example.com',
            billing: makeBilling('user@example.com') as never,
            // FIX 1: the heuristic path also requires a positive payer-email
            // match, so the live preapproval must carry the customer's email.
            adapter: makeAdapter({ payerEmail: 'user@example.com' }) as never
        });

        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        expect(markReconcileAssistedMock).toHaveBeenCalledWith({ id: 'pc-1' }, expect.anything());
        expect(markLinkedMock).not.toHaveBeenCalled();
    });

    it('FIX 1: refuses a heuristic link (reconcile_assisted) when the live preapproval exposes no payer email', async () => {
        queueSelectResult([]);
        fetchPreapprovalPlanIdMock.mockResolvedValue({
            kind: 'ok',
            preapprovalPlanId: 'mp-plan-1'
        });
        findReconcileCandidatesMock.mockResolvedValue([makePendingCheckout()]);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: 'user@example.com',
            billing: makeBilling('user@example.com') as never,
            // Heuristic candidate resolved, but the live preapproval has no payer
            // email → cannot positively verify → refuse (never blind-link).
            adapter: makeAdapter({ payerEmail: null }) as never
        });

        expect(result).toEqual({ outcome: 'reconcile_assisted' });
        expect(markLinkedMock).not.toHaveBeenCalled();
    });

    it('returns "reconcile_assisted" and marks nothing when zero candidates match', async () => {
        queueSelectResult([]);
        fetchPreapprovalPlanIdMock.mockResolvedValue({
            kind: 'ok',
            preapprovalPlanId: 'mp-plan-1'
        });
        findReconcileCandidatesMock.mockResolvedValue([]);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: 'user@example.com',
            billing: makeBilling() as never,
            adapter: makeAdapter() as never
        });

        expect(result).toEqual({ outcome: 'reconcile_assisted' });
        expect(markReconcileAssistedMock).not.toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('returns "reconcile_assisted" and marks every candidate when multiple candidates match', async () => {
        queueSelectResult([]);
        fetchPreapprovalPlanIdMock.mockResolvedValue({
            kind: 'ok',
            preapprovalPlanId: 'mp-plan-1'
        });
        findReconcileCandidatesMock.mockResolvedValue([
            makePendingCheckout({ id: 'pc-1' }),
            makePendingCheckout({ id: 'pc-2', localSubscriptionId: 'sub-2' })
        ]);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: 'user@example.com',
            billing: makeBilling() as never,
            adapter: makeAdapter() as never
        });

        expect(result).toEqual({ outcome: 'reconcile_assisted' });
        expect(markReconcileAssistedMock).toHaveBeenCalledTimes(2);
        expect(markReconcileAssistedMock).toHaveBeenCalledWith({ id: 'pc-1' });
        expect(markReconcileAssistedMock).toHaveBeenCalledWith({ id: 'pc-2' });
    });

    it('returns "not_found" (no heuristic attempt) when the access token is not configured', async () => {
        vi.doMock('../../../src/utils/env.js', () => ({ env: {} }));
        vi.resetModules();
        // Re-import with the fresh mock in place for this single test.
        const mod = await import('../../../src/services/billing/link-preapproval.service');

        queueSelectResult([]);

        const result = await mod.linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter() as never
        });

        expect(result).toEqual({ outcome: 'not_found' });
        expect(fetchPreapprovalPlanIdMock).not.toHaveBeenCalled();

        vi.doUnmock('../../../src/utils/env.js');
        vi.resetModules();
    });

    it('returns "idor" when the live preapproval external_reference belongs to a different nonce', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter({ externalReference: 'someone-elses-nonce' }) as never
        });

        expect(result).toEqual({ outcome: 'idor' });
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('returns "already" when the CAS write loses a concurrent-linking race', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());
        txCasResult = []; // CAS update matched no row (already set by a concurrent caller)

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter({ externalReference: 'nonce-abc' }) as never
        });

        expect(result).toEqual({ outcome: 'already', localSubscriptionId: 'sub-1' });
        expect(markLinkedMock).not.toHaveBeenCalled();
    });

    it('sets external_reference on the live preapproval when unset', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());
        const adapter = makeAdapter({ externalReference: null });

        await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: adapter as never
        });

        expect(adapter.subscriptions.update).toHaveBeenCalledWith('pa-1', {
            externalReference: 'nonce-abc'
        });
    });

    it('does not re-set external_reference when it already matches the resolved nonce', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());
        const adapter = makeAdapter({ externalReference: 'nonce-abc' });

        await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: adapter as never
        });

        expect(adapter.subscriptions.update).not.toHaveBeenCalled();
    });

    it('applies a deferred discount best-effort after a successful link', async () => {
        queueSelectResult([]); // idempotency check
        findByNonceMock.mockResolvedValue(
            makePendingCheckout({
                pendingDiscount: { promoCodeId: 'promo-1', finalAmountCentavos: 8000 }
            })
        );
        queueSelectResult([{ livemode: true }]); // livemode lookup
        getPromoCodeByIdMock.mockResolvedValue({
            success: true,
            data: {
                id: 'promo-1',
                code: 'SAVE20',
                effect: { kind: 'discount', valueKind: 'percentage', value: 20, durationCycles: 1 }
            }
        });

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter({ externalReference: 'nonce-abc' }) as never
        });

        expect(result.outcome).toBe('linked');
        expect(applySignupDiscountToMonthlyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: 'sub-1',
                mpSubscriptionId: 'pa-1',
                promoCodeId: 'promo-1',
                code: 'SAVE20',
                fullPriceCentavos: 10000,
                livemode: true
            })
        );
    });

    it('does not block linking when the deferred discount promo code is no longer valid', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(
            makePendingCheckout({
                pendingDiscount: { promoCodeId: 'promo-1', finalAmountCentavos: 8000 }
            })
        );
        queueSelectResult([{ livemode: false }]);
        getPromoCodeByIdMock.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'gone' }
        });

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter({ externalReference: 'nonce-abc' }) as never
        });

        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        expect(applySignupDiscountToMonthlyMock).not.toHaveBeenCalled();
    });

    // ── FIX A: ownership guard (IDOR) ────────────────────────────────────────

    it('returns "idor" when the live preapproval belongs to a DIFFERENT MercadoPago plan', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(
            makePendingCheckout({ mpPreapprovalPlanId: 'mp-plan-1' })
        );
        // The live preapproval was created against a different plan than the
        // resolved checkout — a hijack attempt.
        fetchPreapprovalPlanIdMock.mockResolvedValue({
            kind: 'ok',
            preapprovalPlanId: 'mp-plan-SOMEONE-ELSE'
        });

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter({ externalReference: 'nonce-abc' }) as never
        });

        expect(result).toEqual({ outcome: 'idor' });
        expect(markLinkedMock).not.toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('returns "idor" when the live payer email differs from the checkout customer (Tier 1/2)', async () => {
        queueSelectResult([]);
        findByLocalSubscriptionIdMock.mockResolvedValue(
            makePendingCheckout({ customerId: 'cust-1' })
        );

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            expectedLocalSubscriptionId: 'sub-1',
            expectedCustomerId: 'cust-1',
            // customer's real email is user@example.com; the live preapproval was
            // authorized by someone else.
            billing: makeBilling('user@example.com') as never,
            adapter: makeAdapter({ payerEmail: 'attacker@evil.test' }) as never
        });

        expect(result).toEqual({ outcome: 'idor' });
        expect(markLinkedMock).not.toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('downgrades a payer-email mismatch on the HEURISTIC path to "reconcile_assisted"', async () => {
        queueSelectResult([]);
        fetchPreapprovalPlanIdMock.mockResolvedValue({
            kind: 'ok',
            preapprovalPlanId: 'mp-plan-1'
        });
        findReconcileCandidatesMock.mockResolvedValue([
            makePendingCheckout({ customerId: 'cust-1' })
        ]);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: 'attacker@evil.test',
            billing: makeBilling('user@example.com') as never,
            adapter: makeAdapter({ payerEmail: 'attacker@evil.test' }) as never
        });

        expect(result).toEqual({ outcome: 'reconcile_assisted' });
        expect(markReconcileAssistedMock).not.toHaveBeenCalled();
    });

    it('links when both the plan and the payer email match (case-insensitive)', async () => {
        queueSelectResult([]);
        findByLocalSubscriptionIdMock.mockResolvedValue(
            makePendingCheckout({ customerId: 'cust-1' })
        );

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: null,
            payerEmail: null,
            expectedLocalSubscriptionId: 'sub-1',
            expectedCustomerId: 'cust-1',
            billing: makeBilling('User@Example.com') as never,
            adapter: makeAdapter({ payerEmail: '  user@example.com  ' }) as never
        });

        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        expect(markLinkedMock).toHaveBeenCalledWith({ id: 'pc-1' }, expect.anything());
    });

    // ── FIX B layer 2: resurrection of an abandoned row ──────────────────────

    it('CAS flips status to pending_provider so an abandoned row is resurrected on link', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter({ externalReference: 'nonce-abc' }) as never
        });

        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        // The CAS SET must carry both the mp id and the pending_provider status
        // (the WHERE restricts resurrection to pending_provider/abandoned rows).
        expect(txSetMock).toHaveBeenCalledWith(
            expect.objectContaining({ mpSubscriptionId: 'pa-1', status: 'pending_provider' })
        );
    });

    // ── FIX C: unique-violation on mp_subscription_id ────────────────────────

    it('treats a Postgres 23505 unique-violation on the CAS as "already"', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());
        txCasError = Object.assign(new Error('duplicate key'), { cause: { code: '23505' } });

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: 'pa-1',
            externalReference: 'nonce-abc',
            payerEmail: null,
            billing: makeBilling() as never,
            adapter: makeAdapter({ externalReference: 'nonce-abc' }) as never
        });

        expect(result).toEqual({ outcome: 'already', localSubscriptionId: 'sub-1' });
        expect(markLinkedMock).not.toHaveBeenCalled();
    });

    it('rethrows a non-23505 error from the CAS', async () => {
        queueSelectResult([]);
        findByNonceMock.mockResolvedValue(makePendingCheckout());
        txCasError = Object.assign(new Error('connection reset'), { cause: { code: '08006' } });

        await expect(
            linkPreapprovalToLocalSub({
                preapprovalId: 'pa-1',
                externalReference: 'nonce-abc',
                payerEmail: null,
                billing: makeBilling() as never,
                adapter: makeAdapter({ externalReference: 'nonce-abc' }) as never
            })
        ).rejects.toThrow('connection reset');
    });
});
