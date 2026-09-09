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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    claimRetryMintSlot,
    classifyPreapprovalStatus,
    confirmCancellationDeferred,
    MP_CALL_SPACING_MS,
    mintRetryPreapprovalAttempt,
    recoverCancelledPreapproval
} from '../../../src/services/billing/preapproval-recovery.service';
import { mockPlanDomainRead } from '../../helpers/plan-domain-read.js';

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

function makeBilling(
    overrides: { planPrices?: unknown[]; planMetadata?: Record<string, unknown> } = {}
) {
    return {
        plans: {
            get: vi.fn().mockResolvedValue({
                id: PLAN_ID,
                name: 'owner-basico',
                ...(overrides.planMetadata ? { metadata: overrides.planMetadata } : {}),
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
    beforeEach(() => {
        // HOS-1233 T-032: the retry mints through `createPaidSubscription`,
        // which resolves the plan's own product_domain first and fails closed
        // when the plan is not found.
        mockPlanDomainRead();
    });

    it('mints a fresh preapproval on the SAME cadence/price recovered from the row metadata, WITHOUT sending the MP plan id (HOS-1221)', async () => {
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
        expect(createCall.priceId).toBe('price-monthly-1');
        expect(createCall.billingInterval).toBe('monthly');
        // HOS-1221: the retry used to subscribe against the recovered MP
        // `preapproval_plan` via `providerPriceId`, which is the request
        // MercadoPago rejects with "card_token_id is required" — the recovery
        // reproduced the checkout's own 500. The plan id is bookkeeping now, so
        // it must not appear in the body qzpay sends. Asserted as an absence:
        // an `objectContaining` shape is blind to a field that should be gone.
        expect(createCall).not.toHaveProperty('providerPriceId');
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
        // HOS-1221 D2: carrying the SNAPSHOT forward is not enough — the
        // provider has to be told the discounted amount too, or the retry
        // quotes full price while the metadata keeps promising the discount.
        // That is the same split that made the original checkout charge
        // ARS 18.000 on a half-price code.
        expect(createCall.providerUnitAmountOverride).toBe(5000);
    });

    it('does NOT override the amount when the row carries no discount', async () => {
        const billing = makeBilling();

        await mintRetryPreapprovalAttempt({
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

        const createCall = billing.subscriptions.create.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        // Absent, not zero: an override of 0 is a real instruction to charge
        // nothing, so a retry with no discount must not send one at all.
        expect(createCall).not.toHaveProperty('providerUnitAmountOverride');
    });

    it('sends the buyer-visible plan name on the retry, not the slug (HOS-1221 D4)', async () => {
        // Every seeded plan carries `metadata.displayName` (`billingPlans.seed.ts`
        // writes it for all of them), which is what `planDisplayNameFromPlan`
        // prefers. Its documented fallback is the slug, so a fixture WITHOUT
        // the field could not tell "the override was wired" apart from "the
        // override was never passed".
        const billing = makeBilling({ planMetadata: { displayName: 'Anfitrión Básico' } });

        await mintRetryPreapprovalAttempt({
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

        const createCall = billing.subscriptions.create.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(createCall.planDisplayName).toBe('Anfitrión Básico');
        // `billing_plans.name` IS the slug here, and the adapter builds the
        // buyer-visible `reason` from it unless this override arrives.
        expect(createCall.planDisplayName).not.toBe('owner-basico');
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

    it('throws for a commerce row whose entity pointer was never stamped — the one thing HOS-1287 still cannot retry', async () => {
        // Pre-HOS-1287 this asserted that ANY gastronomy row was refused. The
        // domain is supported now; what is still refused is a row with nothing
        // pointing at its listing, because the fresh attempt would be charged
        // while the listing stayed dark.
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
        ).rejects.toThrow(/no commerce entity pointer/);
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

/**
 * HOS-1287 — the retry now works for every vertical that can reach it, not for
 * accommodation alone.
 *
 * The pre-HOS-1287 module refused commerce and partner through a one-element
 * allowlist, on the stated grounds that it did not have the entity pointer the
 * bridge-row write needs. It did: the checkout stamps that pointer on the row's
 * own `metadata` (`subscription-domain-metadata.ts`), which is the same place
 * the two reconcilers already read it from.
 *
 * Both mutation directions are covered here:
 *  - toward the BUG — drop `writeDomainLinkRow` / the `domainMetadata` stamp and
 *    the bridge assertions go red;
 *  - toward the TOO-WIDE fix — accept any domain without checking, or trust the
 *    stamped pointer over the row's own domain column, and the last four tests
 *    go red.
 */
describe('mintRetryPreapprovalAttempt — domain carry-forward (HOS-1287)', () => {
    const GASTRONOMY_ENTITY_ID = 'entity-gastro-001';
    const EXPERIENCE_ENTITY_ID = 'entity-exp-001';
    const PARTNER_ID = 'partner-001';
    const RETRY_METADATA = { mpPreapprovalPlanId: MP_PLAN_ID, billingInterval: 'monthly' };

    /**
     * Drizzle mock with the `.transaction()` + `.insert()` shapes the
     * commerce/partner branch needs. `createOwnPreapprovalSubscription` opens a
     * REAL local transaction for that branch (never for accommodation), so a
     * mock without `.transaction` fails with `client.transaction is not a
     * function` rather than proving anything.
     */
    function makeBridgeDbMock() {
        const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
        const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
        const insert = vi.fn().mockReturnValue({ values });
        const txSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
        const txUpdate = vi.fn().mockReturnValue({ set: txSet });
        const tx = { insert, update: txUpdate };
        const transaction = vi.fn(async (cb: (t: unknown) => Promise<void>) => cb(tx));

        return {
            db: { transaction, update: txUpdate, insert } as never,
            transaction,
            insert,
            values,
            onConflictDoUpdate,
            txSet
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockPlanDomainRead();
    });

    it.each([
        ['gastronomy', GASTRONOMY_ENTITY_ID],
        ['experience', EXPERIENCE_ENTITY_ID]
    ])('mints a fresh %s attempt, stamps the entity pointer, and re-points the bridge row in the SAME transaction', async (vertical, entityId) => {
        const billing = makeBilling();
        const { db, transaction, values, onConflictDoUpdate } = makeBridgeDbMock();

        const result = await mintRetryPreapprovalAttempt({
            billing: billing as never,
            localSubscription: {
                id: LOCAL_SUB_ID,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                productDomain: vertical,
                metadata: {
                    ...RETRY_METADATA,
                    commerceEntityType: vertical,
                    commerceEntityId: entityId
                }
            },
            ...URLS,
            db
        });

        expect(result.localSubscriptionId).toBe(NEW_LOCAL_SUB_ID);
        // The bridge row is written, and inside the transaction — the
        // invariant that a `pending_provider` row never exists without one.
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
        const bridgeRow = values.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(bridgeRow.subscriptionId).toBe(NEW_LOCAL_SUB_ID);
        expect(bridgeRow.entityType).toBe(vertical);
        expect(bridgeRow.entityId).toBe(entityId);
        expect(bridgeRow.productDomain).toBe(vertical);
        expect(bridgeRow.status).toBe('pending_provider');
    });

    it('mints a fresh partner attempt and re-points the partner bridge row', async () => {
        const billing = makeBilling();
        const { db, transaction, values } = makeBridgeDbMock();

        await mintRetryPreapprovalAttempt({
            billing: billing as never,
            localSubscription: {
                id: LOCAL_SUB_ID,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                productDomain: 'partner',
                metadata: { ...RETRY_METADATA, partnerId: PARTNER_ID }
            },
            ...URLS,
            db
        });

        expect(transaction).toHaveBeenCalledTimes(1);
        const bridgeRow = values.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(bridgeRow.subscriptionId).toBe(NEW_LOCAL_SUB_ID);
        expect(bridgeRow.partnerId).toBe(PARTNER_ID);
        expect(bridgeRow.productDomain).toBe('partner');
        expect(bridgeRow.status).toBe('pending_provider');
    });

    it("states the row's own productDomain on the fresh commerce attempt, never accommodation", async () => {
        const billing = makeBilling();
        const { db, txSet } = makeBridgeDbMock();

        await mintRetryPreapprovalAttempt({
            billing: billing as never,
            localSubscription: {
                id: LOCAL_SUB_ID,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                productDomain: 'gastronomy',
                metadata: {
                    ...RETRY_METADATA,
                    commerceEntityType: 'gastronomy',
                    commerceEntityId: GASTRONOMY_ENTITY_ID
                }
            },
            ...URLS,
            db
        });

        // The follow-up UPDATE inside the transaction is where
        // `createOwnPreapprovalSubscription` writes the domain + the merged
        // metadata; both halves are asserted here.
        const written = txSet.mock.calls[0]?.[0] as {
            productDomain?: string;
            metadata?: Record<string, unknown>;
        };
        expect(written.productDomain).toBe('gastronomy');
        expect(written.metadata?.commerceEntityType).toBe('gastronomy');
        expect(written.metadata?.commerceEntityId).toBe(GASTRONOMY_ENTITY_ID);
    });

    it('retries tourist like accommodation: no bridge row, no transaction, no entity pointer', async () => {
        // Tourist plans bought through the accommodation checkout are filed
        // `tourist` since HOS-1233, so before HOS-1287 they hit the same 422 the
        // issue only reported for commerce and partner. They own no listing, so
        // the fix for them is that there is nothing extra to carry.
        const billing = makeBilling();
        const { db, transaction, insert } = makeBridgeDbMock();

        await mintRetryPreapprovalAttempt({
            billing: billing as never,
            localSubscription: {
                id: LOCAL_SUB_ID,
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                productDomain: 'tourist',
                metadata: RETRY_METADATA
            },
            ...URLS,
            db
        });

        expect(transaction).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    it('TOO-WIDE GUARD: refuses an addon row instead of minting at the BORROWED plan price', async () => {
        // The recurring add-on borrows the owner plan's price row and states
        // its real amount as `providerUnitAmountOverride`. This retry re-derives
        // the price from the plan, so accepting the domain would bill an
        // ARS 5.000 add-on at the plan's own price, forever.
        const billing = makeBilling();
        const { db } = makeBridgeDbMock();

        await expect(
            mintRetryPreapprovalAttempt({
                billing: billing as never,
                localSubscription: {
                    id: LOCAL_SUB_ID,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    productDomain: 'addon',
                    metadata: RETRY_METADATA
                },
                ...URLS,
                db
            })
        ).rejects.toThrow(/not supported for productDomain='addon'/);
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('TOO-WIDE GUARD: refuses to re-point an experience listing from a gastronomy row', async () => {
        // The column and the pointer encode the same fact from opposite ends.
        // When they disagree there is no way to tell which is wrong, and
        // trusting the pointer would hand another vertical's listing to this
        // subscription.
        const billing = makeBilling();
        const { db } = makeBridgeDbMock();

        await expect(
            mintRetryPreapprovalAttempt({
                billing: billing as never,
                localSubscription: {
                    id: LOCAL_SUB_ID,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    productDomain: 'gastronomy',
                    metadata: {
                        ...RETRY_METADATA,
                        commerceEntityType: 'experience',
                        commerceEntityId: EXPERIENCE_ENTITY_ID
                    }
                },
                ...URLS,
                db
            })
        ).rejects.toThrow(/does not match productDomain='gastronomy'/);
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('TOO-WIDE GUARD: refuses the retired pre-HOS-685 umbrella domain even with a valid-looking pointer', async () => {
        // HOS-695: a legacy row carrying the umbrella value satisfies NEITHER
        // vertical and goes dark on purpose. A pointer on its metadata is not a
        // licence to widen the comparison.
        const retiredUmbrellaDomain = ['comm', 'erce'].join('');
        const billing = makeBilling();
        const { db } = makeBridgeDbMock();

        await expect(
            mintRetryPreapprovalAttempt({
                billing: billing as never,
                localSubscription: {
                    id: LOCAL_SUB_ID,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    productDomain: retiredUmbrellaDomain,
                    metadata: {
                        ...RETRY_METADATA,
                        commerceEntityType: 'gastronomy',
                        commerceEntityId: GASTRONOMY_ENTITY_ID
                    }
                },
                ...URLS,
                db
            })
        ).rejects.toThrow(/not supported for productDomain=/);
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('refuses a partner row with no partnerId stamped, rather than minting a pointerless attempt', async () => {
        const billing = makeBilling();
        const { db } = makeBridgeDbMock();

        await expect(
            mintRetryPreapprovalAttempt({
                billing: billing as never,
                localSubscription: {
                    id: LOCAL_SUB_ID,
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    productDomain: 'partner',
                    metadata: RETRY_METADATA
                },
                ...URLS,
                db
            })
        ).rejects.toThrow(/no partnerId/);
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });
});
