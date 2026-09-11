/**
 * SPEC-262 T-012 P2 / HOS-1160 — subscription-comp-create.service unit tests.
 *
 * Proves the comp subscription creator:
 *  - inserts a `status='comp'` row with NO mp_subscription_id, far-future period,
 *    and the chosen interval.
 *  - stamps promo_code_id + records the redemption inside ONE transaction.
 *  - rolls back (throws) when the redemption fails (fail-closed comp grant).
 *  - HOS-1160: writes the CALLER'S vertical into `product_domain`, for each of
 *    the verticals the issue names, and refuses when the caller's vertical and
 *    the plan's disagree.
 *
 * The domain block carries the mutation coverage this change turns on, in BOTH
 * directions, because one direction alone would sign off the wrong fix:
 *
 *  - toward the BUG (revert the guard — accept any plan without checking):
 *    `refuses a plan whose domain disagrees…` and `treats a NULL plan domain as
 *    accommodation and REFUSES a gastronomy request for it` go red.
 *  - toward the EXCESS (hardcode `productDomain: ACCOMMODATION` in the INSERT
 *    again, i.e. let comp through but file every row as accommodation): the
 *    per-vertical cases go red on the inserted value.
 *
 * Without the second direction a "fix" that opens comp to gastronomy while
 * still stamping `accommodation` passes green — and that row hands the customer
 * the full accommodation entitlements, because `subscriptionMatchesDomain`
 * fails OPEN for accommodation. Opening the door without writing the domain is
 * strictly worse than the closed door it replaces.
 *
 * DB + service-core redemption are fully mocked — no real infra. Typed Drizzle
 * queries as of HOS-75 T-005 (previously raw SQL).
 *
 * @module test/services/subscription-comp-create.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
const txUpdateMock = vi.fn(() => ({ set: updateSetMock }));

/** A fake tx object passed to the withTransaction callback. */
const txStub = {
    insert: vi.fn(() => ({ values: insertValuesMock })),
    update: txUpdateMock
};

const withTransactionMock = vi.fn(
    async (cb: (tx: typeof txStub) => Promise<unknown>, _existing?: unknown) => cb(txStub)
);

/** The plan domain check SELECT (returns a row with productDomain, or none). */
const selectLimitMock = vi.fn();
const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));

/**
 * The customer's existing `billing_subscriptions` rows, as the HOS-1322
 * duplicate guard reads them. Mutable so a test can seed a live subscription
 * (or one in another vertical) before granting the comp.
 */
let existingSubscriptionRows: Array<Record<string, unknown>> = [];

/**
 * TWO selects share this stub since HOS-1322, told apart by the columns they
 * project rather than by call order: the plan-domain lookup projects
 * `{ productDomain }` and ends in `.limit(1)`; the duplicate guard's scan
 * projects `status` too and ends at `.where()`.
 */
const selectMock = vi.fn((columns?: Record<string, unknown>) => {
    if (columns !== undefined && 'status' in columns) {
        return {
            from: vi.fn(() => ({
                where: vi.fn(() => Promise.resolve(existingSubscriptionRows))
            }))
        };
    }
    return { from: selectFromMock };
});

vi.mock('@repo/db', () => ({
    billingSubscriptions: {
        __table: 'billing_subscriptions',
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        productDomain: 'product_domain',
        deletedAt: 'deleted_at'
    },
    billingPlans: { id: 'id', productDomain: 'product_domain' },
    and: vi.fn((...parts: unknown[]) => ({ op: 'and', parts })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    getDb: vi.fn(() => ({ select: selectMock })),
    withTransaction: (...args: unknown[]) =>
        (withTransactionMock as (...a: unknown[]) => unknown)(...args)
}));

// HOS-1160: all SIX members, not the four the issue's text assumed. `tourist`
// arrived with HOS-1233 and `addon` with HOS-847; a mock frozen at four would
// let a comparison against either of them read `undefined` on both sides and
// compare equal.
// HOS-1322: spreads the real module now. It used to be a full replacement
// exporting `SubscriptionStatusEnum: { COMP: 'comp' }`, and a one-member enum
// silently defeats `normalizeStoredSubscriptionStatus` — which maps the stored
// status string through it — so `isLiveSubscriptionStatus('active')` answered
// FALSE and the duplicate guard found no conflict in any row. Every guard case
// would have passed while blocking nothing. `ServiceErrorCode` is needed for the
// same reason: the refusal names one.
vi.mock('@repo/schemas', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/schemas')>()),
    ProductDomainEnum: {
        ACCOMMODATION: 'accommodation',
        GASTRONOMY: 'gastronomy',
        EXPERIENCE: 'experience',
        PARTNER: 'partner',
        TOURIST: 'tourist',
        ADDON: 'addon'
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const redeemAndRecordUsageMock = vi.fn();
// HOS-1322: spreads the real module. It used to export `redeemAndRecordUsage`
// alone, which left the duplicate guard's `subscriptionMatchesDomain` and
// `ServiceError` imports `undefined` — the guard would have thrown a TypeError
// instead of a refusal, on every call.
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    redeemAndRecordUsage: (...args: unknown[]) => redeemAndRecordUsageMock(...args)
}));

const clearEntitlementCacheMock = vi.fn();
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: (...args: unknown[]) => clearEntitlementCacheMock(...args)
}));

import { createCompSubscription } from '../../src/services/subscription-comp-create.service';

describe('createCompSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        insertValuesMock.mockResolvedValue(undefined);
        updateWhereMock.mockResolvedValue(undefined);
        redeemAndRecordUsageMock.mockResolvedValue({ success: true, data: {} });
        // Default: plan exists with NULL productDomain (accommodation by historical default).
        selectLimitMock.mockResolvedValue([{ productDomain: null }]);
        // Default: the customer holds no subscription at all (HOS-1322).
        existingSubscriptionRows = [];
    });

    // -----------------------------------------------------------------------
    // HOS-1322 — the duplicate guard, inside the primitive
    // -----------------------------------------------------------------------
    describe('the duplicate guard (HOS-1322)', () => {
        function grant(productDomain: 'accommodation' | 'gastronomy') {
            return createCompSubscription({
                customerId: 'cust-1',
                planId: 'plan-uuid-1',
                interval: 'monthly',
                productDomain,
                livemode: true
            });
        }

        it('refuses a comp when the customer already holds a live subscription in the SAME domain', async () => {
            existingSubscriptionRows = [
                { id: 'sub_live', status: 'active', productDomain: 'accommodation' }
            ];

            await expect(grant('accommodation')).rejects.toThrow(
                /already have a live 'accommodation' subscription/
            );
            expect(insertValuesMock).not.toHaveBeenCalled();
        });

        it('refuses on an EXISTING COMP too — a perpetual row has no period end to wait out', async () => {
            existingSubscriptionRows = [
                { id: 'sub_comp', status: 'comp', productDomain: 'accommodation' }
            ];

            await expect(grant('accommodation')).rejects.toThrow(
                /already have a live 'accommodation' subscription/
            );
        });

        it('still grants when the live subscription is in ANOTHER domain (the dual owner)', async () => {
            // The host who already pays for accommodation and is being comped on
            // gastronomy. Without this pair the case above passes just as well
            // with a customer-wide check that refuses a legitimate grant.
            existingSubscriptionRows = [
                { id: 'sub_accommodation', status: 'active', productDomain: 'accommodation' }
            ];
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await grant('gastronomy');

            expect(insertValuesMock).toHaveBeenCalledTimes(1);
            expect(
                (insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>).productDomain
            ).toBe('gastronomy');
        });
    });

    it('inserts a comp row (no mp id, far-future period, accommodation domain) + records redemption atomically', async () => {
        // Act
        const result = await createCompSubscription({
            customerId: 'cust-1',
            planId: 'plan-uuid-1',
            promoCodeId: 'pc-1',
            code: 'COMPVIP',
            interval: 'monthly',
            productDomain: 'accommodation',
            livemode: true
        });

        // Assert — returns the created id.
        expect(result.localSubscriptionId).toMatch(/[0-9a-f-]{36}/);

        // Insert shape: status='comp', no mp_subscription_id, period far-future.
        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.status).toBe('comp');
        expect(inserted).not.toHaveProperty('mpSubscriptionId');
        expect(inserted.customerId).toBe('cust-1');
        expect(inserted.planId).toBe('plan-uuid-1');
        expect(inserted.billingInterval).toBe('month');
        expect(inserted.livemode).toBe(true);
        const periodEnd = inserted.currentPeriodEnd as Date;
        const periodStart = inserted.currentPeriodStart as Date;
        // Far future: at least 50 years out.
        expect(periodEnd.getTime() - periodStart.getTime()).toBeGreaterThan(
            50 * 365 * 24 * 60 * 60 * 1000
        );

        // HOS-1233 T-035: product_domain and promo_code_id are stated in the
        // INSERT, not stamped by a follow-up UPDATE.
        //
        // The old assertion said the row ENDS UP right; this one says it is
        // BORN right, which is what AC-15b actually requires. In between the
        // two statements the row existed filed under the column's own default —
        // the mechanism that made every tourist plan report `accommodation` in
        // prod and staging alike (spec F-4b) — and once T-036 drops that
        // default the INSERT is rejected before any correction can run.
        expect(inserted.productDomain).toBe('accommodation');
        expect(inserted.promoCodeId).toBe('pc-1');
        expect(updateSetMock).not.toHaveBeenCalled();

        // Redemption recorded against the NEW sub id, discountAmount 0, inside tx.
        expect(redeemAndRecordUsageMock).toHaveBeenCalledOnce();
        const redeemArg = redeemAndRecordUsageMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(redeemArg.promoCodeId).toBe('pc-1');
        expect(redeemArg.subscriptionId).toBe(result.localSubscriptionId);
        expect(redeemArg.discountAmount).toBe(0);
        expect(redeemArg.tx).toBe(txStub);
    });

    it('maps annual interval to billingInterval=year', async () => {
        await createCompSubscription({
            customerId: 'cust-1',
            planId: 'plan-uuid-1',
            promoCodeId: 'pc-1',
            code: 'COMPVIP',
            interval: 'annual',
            productDomain: 'accommodation',
            livemode: false
        });
        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.billingInterval).toBe('year');
    });

    it('throws (rolls back) when the redemption fails — comp not granted', async () => {
        redeemAndRecordUsageMock.mockResolvedValue({
            success: false,
            error: { code: 'PROMO_CODE_MAX_USES', message: 'exhausted' }
        });

        await expect(
            createCompSubscription({
                customerId: 'cust-1',
                planId: 'plan-uuid-1',
                promoCodeId: 'pc-1',
                code: 'COMPVIP',
                interval: 'monthly',
                productDomain: 'accommodation',
                livemode: false
            })
        ).rejects.toThrow(/Comp redemption failed/);
    });

    // -----------------------------------------------------------------------
    // HOS-1160 — the vertical the row is born with
    // -----------------------------------------------------------------------
    describe('HOS-1160: product_domain is the caller vertical, not a literal', () => {
        // The four verticals the issue names. `accommodation` is included on
        // purpose rather than assumed from the cases above: the point of the
        // table is that no vertical is privileged in the INSERT, and leaving out
        // the one that used to be hardcoded would hide a fix that still
        // special-cases it.
        const VERTICALS = ['accommodation', 'gastronomy', 'experience', 'partner'] as const;

        for (const vertical of VERTICALS) {
            it(`comps a ${vertical} plan and files the row under '${vertical}'`, async () => {
                selectLimitMock.mockResolvedValue([{ productDomain: vertical }]);

                const result = await createCompSubscription({
                    customerId: 'cust-1',
                    planId: `plan-${vertical}`,
                    interval: 'monthly',
                    productDomain: vertical,
                    livemode: false
                });

                expect(result.localSubscriptionId).toMatch(/[0-9a-f-]{36}/);

                const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
                // The whole point: the row states ITS OWN vertical. A fix that
                // opens the guard but leaves `ProductDomainEnum.ACCOMMODATION`
                // in the INSERT fails here for three of the four rows — and that
                // fix is the dangerous one, because accommodation is the domain
                // `subscriptionMatchesDomain` fails OPEN for.
                expect(inserted.productDomain).toBe(vertical);
                expect(inserted.status).toBe('comp');
                expect(inserted).not.toHaveProperty('mpSubscriptionId');
            });
        }

        it('refuses a plan whose domain disagrees with the requested vertical, before any write', async () => {
            // The plan is accommodation; the caller believes it is comping
            // gastronomy. Resolving this in the plan's favour would file a
            // gastronomy courtesy as an accommodation entitlement.
            selectLimitMock.mockResolvedValue([{ productDomain: 'accommodation' }]);

            await expect(
                createCompSubscription({
                    customerId: 'cust-1',
                    planId: 'plan-accommodation',
                    interval: 'monthly',
                    productDomain: 'gastronomy',
                    livemode: false
                })
            ).rejects.toThrow(
                /is domain 'accommodation' but the comp was requested for 'gastronomy'/
            );

            expect(withTransactionMock).not.toHaveBeenCalled();
            expect(insertValuesMock).not.toHaveBeenCalled();
        });

        it('refuses the mirror case too — a gastronomy plan requested as accommodation', async () => {
            // The direction that used to be the ONLY thing the guard checked.
            // It still has to refuse, or the door opens both ways.
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await expect(
                createCompSubscription({
                    customerId: 'cust-1',
                    planId: 'plan-gastronomy',
                    interval: 'monthly',
                    productDomain: 'accommodation',
                    livemode: false
                })
            ).rejects.toThrow(
                /is domain 'gastronomy' but the comp was requested for 'accommodation'/
            );

            expect(withTransactionMock).not.toHaveBeenCalled();
        });

        it('treats a NULL plan domain as accommodation and ALLOWS an accommodation request', async () => {
            // Legacy plans predating the column. Accommodation fails open, the
            // same asymmetry `subscriptionMatchesDomain` applies.
            selectLimitMock.mockResolvedValue([{ productDomain: null }]);

            const result = await createCompSubscription({
                customerId: 'cust-1',
                planId: 'plan-legacy',
                interval: 'monthly',
                productDomain: 'accommodation',
                livemode: false
            });

            expect(result.localSubscriptionId).toMatch(/[0-9a-f-]{36}/);
            const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(inserted.productDomain).toBe('accommodation');
        });

        it('treats a NULL plan domain as accommodation and REFUSES a gastronomy request for it', async () => {
            // The other half of the fail-open asymmetry, and the one that keeps
            // it from becoming a hole: a plan that never stated its vertical
            // cannot be claimed as gastronomy just because the caller says so.
            selectLimitMock.mockResolvedValue([{ productDomain: null }]);

            await expect(
                createCompSubscription({
                    customerId: 'cust-1',
                    planId: 'plan-legacy',
                    interval: 'monthly',
                    productDomain: 'gastronomy',
                    livemode: false
                })
            ).rejects.toThrow(
                /is domain 'accommodation' but the comp was requested for 'gastronomy'/
            );

            expect(withTransactionMock).not.toHaveBeenCalled();
        });

        it("refuses a retired 'commerce' plan for both gastronomy and experience", async () => {
            // `'commerce'` is a RETIRED value surviving only on legacy rows
            // (release B / HOS-692). HOS-695 narrowed the match on purpose: such
            // a row satisfies NEITHER `gastronomy` NOR `experience` and goes
            // dark rather than silently matching a vertical it was never
            // resolved to. Do not "fix" this by widening the comparison.
            for (const requested of ['gastronomy', 'experience'] as const) {
                vi.clearAllMocks();
                selectLimitMock.mockResolvedValue([{ productDomain: 'commerce' }]);

                await expect(
                    createCompSubscription({
                        customerId: 'cust-1',
                        planId: 'plan-legacy-commerce',
                        interval: 'monthly',
                        productDomain: requested,
                        livemode: false
                    })
                ).rejects.toThrow(/is domain 'commerce' but the comp was requested for/);

                expect(withTransactionMock).not.toHaveBeenCalled();
            }
        });
    });

    it('throws when plan is not found (missing from billing_plans)', async () => {
        selectLimitMock.mockResolvedValue([]); // empty result → plan not found

        await expect(
            createCompSubscription({
                customerId: 'cust-1',
                planId: 'plan-nonexistent',
                promoCodeId: 'pc-1',
                code: 'COMPVIP',
                interval: 'monthly',
                productDomain: 'accommodation',
                livemode: false
            })
        ).rejects.toThrow(/plan.*not found/i);

        expect(withTransactionMock).not.toHaveBeenCalled();
    });

    // HOS-453 / H-91 — the comp path served stale (pre-comp) entitlements from
    // the in-memory cache for up to the full 5-minute TTL, because unlike every
    // other money-mutating lifecycle handler (INV-1), this service never called
    // clearEntitlementCache(customerId). Regression test for the fix below.
    it('HOS-453: clears the entitlement cache for the customer on success (INV-1)', async () => {
        const result = await createCompSubscription({
            customerId: 'cust-1',
            planId: 'plan-uuid-1',
            promoCodeId: 'pc-1',
            code: 'COMPVIP',
            interval: 'monthly',
            productDomain: 'accommodation',
            livemode: true
        });

        expect(clearEntitlementCacheMock).toHaveBeenCalledOnce();
        expect(clearEntitlementCacheMock).toHaveBeenCalledWith('cust-1');
        expect(result.localSubscriptionId).toMatch(/[0-9a-f-]{36}/);
    });

    it('HOS-453: does NOT clear the entitlement cache when the redemption fails (fail-closed, nothing granted)', async () => {
        redeemAndRecordUsageMock.mockResolvedValue({
            success: false,
            error: { code: 'PROMO_CODE_MAX_USES', message: 'exhausted' }
        });

        await expect(
            createCompSubscription({
                customerId: 'cust-1',
                planId: 'plan-uuid-1',
                promoCodeId: 'pc-1',
                code: 'COMPVIP',
                interval: 'monthly',
                productDomain: 'accommodation',
                livemode: false
            })
        ).rejects.toThrow(/Comp redemption failed/);

        expect(clearEntitlementCacheMock).not.toHaveBeenCalled();
    });
});
