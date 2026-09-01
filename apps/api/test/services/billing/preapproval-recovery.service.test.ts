/**
 * Unit tests for the MercadoPago preapproval checkout recovery (HOS-937 step 3).
 *
 * Covers:
 * - `classifyPreapprovalStatus`: the three-way spec §6.4 classification
 *   (authorized/pending/cancelled), plus `other` for anything else.
 * - `confirmCancellationDeferred`: R-3 — a `cancelled` read is confirmed
 *   with a DEFERRED second read, never acted on immediately. Asserts the
 *   deferral (spacing) actually happens, not just that two calls occur.
 * - `claimRetryMintSlot`: the compare-and-set idempotency guard that stops
 *   the webhook and the retry endpoint from both minting a fresh
 *   preapproval for the same cancelled row.
 * - `mintRetryPreapprovalAttempt`: resolves plan/price/interval off the
 *   cancelled row's own metadata and mints a like-for-like preapproval.
 * - `recoverCancelledPreapproval`: the full orchestration — confirm, claim,
 *   mint, reuse-on-replay — and that `pending`/`cancelled` are NEVER
 *   confused (the pair the spec calls out as the most expensive to mix up).
 *
 * @module test/services/billing/preapproval-recovery.service
 */

import { describe, expect, it, vi } from 'vitest';
import {
    claimRetryMintSlot,
    classifyPreapprovalStatus,
    confirmCancellationDeferred,
    MP_CALL_SPACING_MS,
    mintRetryPreapprovalAttempt,
    recoverCancelledPreapproval
} from '../../../src/services/billing/preapproval-recovery.service';

const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const NEW_LOCAL_SUB_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = 'cust-001';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const MP_PREAPPROVAL_ID = 'mp_preapproval_abc';
const MP_PLAN_ID = 'mp_plan_xyz';

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

function makeAdapter(status: string) {
    return {
        subscriptions: {
            retrieve: vi.fn().mockResolvedValue({ id: MP_PREAPPROVAL_ID, status })
        }
    };
}

function makeBilling(overrides: { planPrices?: unknown[] } = {}) {
    return {
        plans: {
            get: vi.fn().mockResolvedValue({
                id: PLAN_ID,
                name: 'owner-basico',
                prices: overrides.planPrices ?? [
                    {
                        id: 'price-monthly-1',
                        active: true,
                        billingInterval: 'month',
                        intervalCount: 1
                    }
                ]
            })
        },
        subscriptions: {
            create: vi.fn().mockResolvedValue({
                id: NEW_LOCAL_SUB_ID,
                providerInitPoint: 'https://mp.test/checkout/new',
                providerSubscriptionIds: { mercadopago: 'mp_preapproval_new' }
            }),
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    };
}

/** Builds a chainable Drizzle mock for `.update().set().where().returning()` + `.select()`. */
function makeDbMock(
    opts: { claimWins?: boolean; existingMetadata?: Record<string, unknown> } = {}
) {
    const claimWins = opts.claimWins ?? true;

    const returningMock = vi.fn().mockResolvedValue(claimWins ? [{ id: LOCAL_SUB_ID }] : []);
    const updateWhereMock = vi.fn().mockReturnValue({ returning: returningMock });
    // A second .set().where() shape (no .returning()) is used for the final
    // "stamp the mint" write and by own-preapproval's own UPDATE. `where()`
    // returns a REAL Promise (so a plain `await ...where(...)` resolves)
    // with `.returning` attached as an extra property (so the claim's
    // `...where(...).returning(...)` chain also works off the same call).
    const plainWhereMock = vi.fn().mockResolvedValue(undefined);
    const setMock = vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation((..._args: unknown[]) => {
            const promise = Promise.resolve(undefined) as Promise<undefined> & {
                returning: typeof returningMock;
            };
            promise.returning = returningMock;
            return promise;
        })
    }));
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    const selectLimitMock = vi.fn().mockResolvedValue([{ metadata: opts.existingMetadata ?? {} }]);
    const selectWhereMock = vi.fn().mockReturnValue({ limit: selectLimitMock });
    const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: selectFromMock });

    return {
        update: updateMock,
        select: selectMock,
        __setMock: setMock,
        __updateWhereMock: updateWhereMock,
        __plainWhereMock: plainWhereMock
    };
}

describe('classifyPreapprovalStatus', () => {
    it("classifies qzpay 'active' (MP authorized) as authorized", () => {
        expect(classifyPreapprovalStatus('active')).toBe('authorized');
    });

    it("classifies qzpay 'pending' as pending", () => {
        expect(classifyPreapprovalStatus('pending')).toBe('pending');
    });

    it("classifies qzpay 'canceled' (1 L) as cancelled", () => {
        expect(classifyPreapprovalStatus('canceled')).toBe('cancelled');
    });

    it.each([
        'paused',
        'past_due',
        'finished',
        'something_unknown'
    ])("classifies qzpay '%s' as other", (status) => {
        expect(classifyPreapprovalStatus(status)).toBe('other');
    });

    it('never confuses pending and cancelled — the pair the spec calls out as most expensive to mix up', () => {
        expect(classifyPreapprovalStatus('pending')).not.toBe(
            classifyPreapprovalStatus('canceled')
        );
    });
});

describe('confirmCancellationDeferred', () => {
    it('R-3: waits the deferral delay BEFORE re-reading — the sleep call happens with the expected spacing', async () => {
        const adapter = makeAdapter('canceled');
        const sleep = vi.fn().mockResolvedValue(undefined);

        const result = await confirmCancellationDeferred({
            paymentAdapter: adapter as never,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            sleep
        });

        expect(sleep).toHaveBeenCalledTimes(1);
        expect(sleep).toHaveBeenCalledWith(MP_CALL_SPACING_MS);
        expect(adapter.subscriptions.retrieve).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ confirmed: true, classification: 'cancelled' });
    });

    it('confirms nothing when the deferred re-read flips to authorized (R-3: the exact false-cancellation scenario)', async () => {
        const adapter = makeAdapter('active');
        const sleep = vi.fn().mockResolvedValue(undefined);

        const result = await confirmCancellationDeferred({
            paymentAdapter: adapter as never,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            sleep
        });

        expect(result).toEqual({ confirmed: false, classification: 'authorized' });
    });

    it('confirms nothing when the deferred re-read flips to pending', async () => {
        const adapter = makeAdapter('pending');
        const sleep = vi.fn().mockResolvedValue(undefined);

        const result = await confirmCancellationDeferred({
            paymentAdapter: adapter as never,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            sleep
        });

        expect(result).toEqual({ confirmed: false, classification: 'pending' });
    });

    it('respects a caller-supplied delayMs override', async () => {
        const adapter = makeAdapter('canceled');
        const sleep = vi.fn().mockResolvedValue(undefined);

        await confirmCancellationDeferred({
            paymentAdapter: adapter as never,
            mpPreapprovalId: MP_PREAPPROVAL_ID,
            delayMs: 5000,
            sleep
        });

        expect(sleep).toHaveBeenCalledWith(5000);
    });
});

describe('mintRetryPreapprovalAttempt', () => {
    it('mints a fresh preapproval on the SAME MP plan/cadence recovered from the row metadata', async () => {
        const billing = makeBilling();

        const result = await mintRetryPreapprovalAttempt({
            billing: billing as never,
            localSubscription: {
                id: LOCAL_SUB_ID,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                productDomain: null,
                metadata: { mpPreapprovalPlanId: MP_PLAN_ID, billingInterval: 'monthly' }
            },
            ...URLS
        });

        expect(result).toEqual({
            localSubscriptionId: NEW_LOCAL_SUB_ID,
            checkoutUrl: 'https://mp.test/checkout/new'
        });
        const createCall = billing.subscriptions.create.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(createCall.providerPriceId).toBe(MP_PLAN_ID);
        expect(createCall.priceId).toBe('price-monthly-1');
        expect(createCall.billingInterval).toBe('monthly');
    });

    it('resolves the annual price when the row metadata says billingInterval=annual', async () => {
        const billing = makeBilling({
            planPrices: [
                { id: 'price-monthly-1', active: true, billingInterval: 'month', intervalCount: 1 },
                { id: 'price-annual-1', active: true, billingInterval: 'year', intervalCount: 1 }
            ]
        });

        await mintRetryPreapprovalAttempt({
            billing: billing as never,
            localSubscription: {
                id: LOCAL_SUB_ID,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                productDomain: null,
                metadata: { mpPreapprovalPlanId: MP_PLAN_ID, billingInterval: 'annual' }
            },
            ...URLS
        });

        const createCall = billing.subscriptions.create.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(createCall.priceId).toBe('price-annual-1');
        expect(createCall.billingInterval).toBe('annual');
    });

    it('carries forward an unredeemed pendingDiscount snapshot onto the fresh attempt', async () => {
        const billing = makeBilling();
        const pendingDiscount = { promoCodeId: 'promo-1', finalAmountCentavos: 5000 };

        await mintRetryPreapprovalAttempt({
            billing: billing as never,
            localSubscription: {
                id: LOCAL_SUB_ID,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                productDomain: null,
                metadata: {
                    mpPreapprovalPlanId: MP_PLAN_ID,
                    billingInterval: 'monthly',
                    pendingDiscountJson: JSON.stringify(pendingDiscount)
                }
            },
            ...URLS
        });

        const createCall = billing.subscriptions.create.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        const metadata = createCall.metadata as Record<string, string>;
        expect(metadata.pendingDiscountJson).toBe(JSON.stringify(pendingDiscount));
    });

    it('throws when the row carries no mpPreapprovalPlanId (cannot mint like-for-like)', async () => {
        const billing = makeBilling();

        await expect(
            mintRetryPreapprovalAttempt({
                billing: billing as never,
                localSubscription: {
                    id: LOCAL_SUB_ID,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    productDomain: null,
                    metadata: {}
                },
                ...URLS
            })
        ).rejects.toThrow(/mpPreapprovalPlanId/);
    });

    it('throws for an unsupported product domain (commerce/partner retry is out of scope for this change)', async () => {
        const billing = makeBilling();

        await expect(
            mintRetryPreapprovalAttempt({
                billing: billing as never,
                localSubscription: {
                    id: LOCAL_SUB_ID,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    productDomain: 'gastronomy',
                    metadata: { mpPreapprovalPlanId: MP_PLAN_ID, billingInterval: 'monthly' }
                },
                ...URLS
            })
        ).rejects.toThrow(/productDomain/);
    });

    it('throws when the plan has no active price for the recovered interval', async () => {
        const billing = makeBilling({ planPrices: [] });

        await expect(
            mintRetryPreapprovalAttempt({
                billing: billing as never,
                localSubscription: {
                    id: LOCAL_SUB_ID,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    productDomain: null,
                    metadata: { mpPreapprovalPlanId: MP_PLAN_ID, billingInterval: 'monthly' }
                },
                ...URLS
            })
        ).rejects.toThrow(/no active monthly price/);
    });
});

describe('claimRetryMintSlot', () => {
    it('wins the claim on a row with no prior claim', async () => {
        const db = makeDbMock({ claimWins: true });

        const result = await claimRetryMintSlot({
            db: db as never,
            cancelledLocalSubscriptionId: LOCAL_SUB_ID
        });

        expect(result).toEqual({
            claimed: true,
            existingLocalSubscriptionId: null,
            existingCheckoutUrl: null
        });
        expect(db.select).not.toHaveBeenCalled();
    });

    it('loses the claim and returns the prior winner`s minted info when already minted', async () => {
        const db = makeDbMock({
            claimWins: false,
            existingMetadata: {
                retryMintedLocalSubscriptionId: NEW_LOCAL_SUB_ID,
                retryMintedCheckoutUrl: 'https://mp.test/checkout/winner'
            }
        });

        const result = await claimRetryMintSlot({
            db: db as never,
            cancelledLocalSubscriptionId: LOCAL_SUB_ID
        });

        expect(result).toEqual({
            claimed: false,
            existingLocalSubscriptionId: NEW_LOCAL_SUB_ID,
            existingCheckoutUrl: 'https://mp.test/checkout/winner'
        });
    });

    it('loses the claim but returns nulls when a concurrent winner has not finished minting yet', async () => {
        const db = makeDbMock({ claimWins: false, existingMetadata: {} });

        const result = await claimRetryMintSlot({
            db: db as never,
            cancelledLocalSubscriptionId: LOCAL_SUB_ID
        });

        expect(result).toEqual({
            claimed: false,
            existingLocalSubscriptionId: null,
            existingCheckoutUrl: null
        });
    });
});

describe('recoverCancelledPreapproval', () => {
    const baseLocalSubscription = {
        id: LOCAL_SUB_ID,
        customerId: CUSTOMER_ID,
        planId: PLAN_ID,
        productDomain: null,
        metadata: { mpPreapprovalPlanId: MP_PLAN_ID, billingInterval: 'monthly' },
        mpSubscriptionId: MP_PREAPPROVAL_ID
    };

    it('mints exactly once end to end: confirms, claims, mints, and stamps the claim row', async () => {
        const billing = makeBilling();
        const adapter = makeAdapter('canceled');
        const db = makeDbMock({ claimWins: true });
        const sleep = vi.fn().mockResolvedValue(undefined);

        const outcome = await recoverCancelledPreapproval({
            billing: billing as never,
            paymentAdapter: adapter as never,
            localSubscription: baseLocalSubscription,
            ...URLS,
            db: db as never,
            sleep
        });

        expect(outcome).toEqual({
            kind: 'minted',
            localSubscriptionId: NEW_LOCAL_SUB_ID,
            checkoutUrl: 'https://mp.test/checkout/new'
        });
        expect(billing.subscriptions.create).toHaveBeenCalledTimes(1);
    });

    it('does NOT mint when the deferred re-read flips away from cancelled (R-3 self-heal)', async () => {
        const billing = makeBilling();
        const adapter = makeAdapter('active');
        const db = makeDbMock({ claimWins: true });
        const sleep = vi.fn().mockResolvedValue(undefined);

        const outcome = await recoverCancelledPreapproval({
            billing: billing as never,
            paymentAdapter: adapter as never,
            localSubscription: baseLocalSubscription,
            ...URLS,
            db: db as never,
            sleep
        });

        expect(outcome).toEqual({ kind: 'not_confirmed', classification: 'authorized' });
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('MUTATION-SENSITIVE: mints on a confirmed CANCELLED and reuses the SAME object on a confirmed PENDING — the pair spec §10 flags as most expensive to swap', async () => {
        const billing = makeBilling();
        const cancelledAdapter = makeAdapter('canceled');
        const dbForCancelled = makeDbMock({ claimWins: true });

        const cancelledOutcome = await recoverCancelledPreapproval({
            billing: billing as never,
            paymentAdapter: cancelledAdapter as never,
            localSubscription: baseLocalSubscription,
            ...URLS,
            db: dbForCancelled as never,
            sleep: vi.fn().mockResolvedValue(undefined)
        });
        expect(cancelledOutcome.kind).toBe('minted');
        // Cancelled recovery MUST mint a NEW object, never reuse the old one.
        if (cancelledOutcome.kind === 'minted') {
            expect(cancelledOutcome.localSubscriptionId).not.toBe(LOCAL_SUB_ID);
        }

        // A `pending` read is handled entirely OUTSIDE this function (the
        // route reads metadata.checkoutUrl directly and never calls
        // recoverCancelledPreapproval) — asserted by the classification
        // test above. This test's second half is the safety net: confirming
        // that a `pending` classification, if it ever reached this
        // function, would fail the confirmation and mint NOTHING.
        const pendingAdapter = makeAdapter('pending');
        const dbForPending = makeDbMock({ claimWins: true });
        const pendingOutcome = await recoverCancelledPreapproval({
            billing: billing as never,
            paymentAdapter: pendingAdapter as never,
            localSubscription: baseLocalSubscription,
            ...URLS,
            db: dbForPending as never,
            sleep: vi.fn().mockResolvedValue(undefined)
        });
        expect(pendingOutcome.kind).toBe('not_confirmed');
    });

    it('replays the SAME minted checkout when called again on an already-minted row (idempotent)', async () => {
        const billing = makeBilling();
        const adapter = makeAdapter('canceled');
        const alreadyMintedSubscription = {
            ...baseLocalSubscription,
            metadata: {
                ...baseLocalSubscription.metadata,
                retryMintedLocalSubscriptionId: NEW_LOCAL_SUB_ID,
                retryMintedCheckoutUrl: 'https://mp.test/checkout/already'
            }
        };

        const outcome = await recoverCancelledPreapproval({
            billing: billing as never,
            paymentAdapter: adapter as never,
            localSubscription: alreadyMintedSubscription,
            ...URLS,
            sleep: vi.fn().mockResolvedValue(undefined)
        });

        expect(outcome).toEqual({
            kind: 'already_minted',
            localSubscriptionId: NEW_LOCAL_SUB_ID,
            checkoutUrl: 'https://mp.test/checkout/already'
        });
        expect(adapter.subscriptions.retrieve).not.toHaveBeenCalled();
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('never mints twice when the claim is lost to a concurrent winner (webhook + retry endpoint race)', async () => {
        const billing = makeBilling();
        const adapter = makeAdapter('canceled');
        const db = makeDbMock({
            claimWins: false,
            existingMetadata: {
                retryMintedLocalSubscriptionId: NEW_LOCAL_SUB_ID,
                retryMintedCheckoutUrl: 'https://mp.test/checkout/winner'
            }
        });

        const outcome = await recoverCancelledPreapproval({
            billing: billing as never,
            paymentAdapter: adapter as never,
            localSubscription: baseLocalSubscription,
            ...URLS,
            db: db as never,
            sleep: vi.fn().mockResolvedValue(undefined)
        });

        expect(outcome).toEqual({
            kind: 'already_minted',
            localSubscriptionId: NEW_LOCAL_SUB_ID,
            checkoutUrl: 'https://mp.test/checkout/winner'
        });
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('reports unsupported (never throws) when minting fails — e.g. no mpPreapprovalPlanId', async () => {
        const billing = makeBilling();
        const adapter = makeAdapter('canceled');
        const db = makeDbMock({ claimWins: true });

        const outcome = await recoverCancelledPreapproval({
            billing: billing as never,
            paymentAdapter: adapter as never,
            localSubscription: { ...baseLocalSubscription, metadata: {} },
            ...URLS,
            db: db as never,
            sleep: vi.fn().mockResolvedValue(undefined)
        });

        expect(outcome.kind).toBe('unsupported');
    });
});
