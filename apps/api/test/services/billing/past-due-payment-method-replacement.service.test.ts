/**
 * Unit tests for the past-due payment-method replacement service (HOS-348
 * Part B).
 *
 * Deliberately does NOT mock `createPaidSubscription` / `resolveReactivationPlan`
 * (the repo's "whole-module vi.mock leaves the new import undefined" trap) —
 * instead a fake `QZPayBilling` (`plans.listAll` / `subscriptions.create` /
 * `subscriptions.cancel`) drives the REAL helpers, so these tests exercise the
 * actual plan-resolution + preapproval-create logic, not a mock of it.
 *
 * Covers:
 * - A fresh mint stamps `supersedesSubscriptionId`, the HOS-348 replacement
 *   marker, and `unpaidPeriodForgiven` on the new row's metadata.
 * - Minting NEVER calls `billing.subscriptions.cancel()` — the load-bearing
 *   invariant that the old preapproval is untouched until the webhook
 *   confirms the new one (verified in RED with the bug reintroduced below).
 * - An in-flight attempt within the reuse window is returned instead of
 *   minting a second preapproval (idempotency layer 2), GIVEN a row already
 *   shaped the way `findReusableReplacementAttempt`'s SQL `WHERE` expects —
 *   the freshness/customer conditions themselves live in that `WHERE` clause
 *   and are not re-verified here (HOS-1315: this file's fake `db.select`
 *   stubs ignore the actual query condition object and simply return
 *   whatever rows the test hands it, so a "stale row is excluded" / "foreign
 *   customer's row is excluded" behavioral test is not meaningfully
 *   expressible against this mock — a PREVIOUS version of this docblock
 *   claimed that coverage; it was never actually written).
 * - (HOS-1315) The PRODUCER and the CONSUMER actually agree: a row minted by
 *   the real `replacePastDuePaymentMethod` write path is found and reused by
 *   its own `findReusableReplacementAttempt` predicate on a second call — the
 *   in-flight row is never hand-fabricated, only the eventual DB rows a
 *   REAL mint call itself produces (see the stateful fake DB below).
 *
 * @module test/services/billing/past-due-payment-method-replacement.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    PAST_DUE_PAYMENT_METHOD_REPLACEMENT_METADATA_KEY,
    replacePastDuePaymentMethod
} from '../../../src/services/billing/past-due-payment-method-replacement.service';
import { mockPlanDomainRead } from '../../helpers/plan-domain-read.js';

const PLAN_ID = 'plan-uuid-001';
const CUSTOMER_ID = 'customer-uuid-001';
const OTHER_CUSTOMER_ID = 'customer-uuid-002';
const PAST_DUE_SUBSCRIPTION_ID = 'sub-past-due-001';
const GASTRONOMY_ENTITY_ID = 'entity-gastro-001';
const EXPERIENCE_ENTITY_ID = 'entity-exp-001';
const PARTNER_ID = 'partner-001';

/**
 * The accommodation past-due row the pre-HOS-1287 tests were implicitly
 * describing: `product_domain` NULL (the column post-dates most rows) and no
 * entity pointer on `metadata`. Stated rather than defaulted — HOS-1287 made
 * both fields REQUIRED on the input precisely so no call site can leave the
 * vertical unstated.
 */
const ACCOMMODATION_PAST_DUE_ROW = {
    id: PAST_DUE_SUBSCRIPTION_ID,
    planId: PLAN_ID,
    productDomain: null,
    metadata: null
} as const;

/** Minimal real-shaped plan with one active monthly price, for resolveReactivationPlan. */
function makePlan() {
    return {
        id: PLAN_ID,
        prices: [
            {
                id: 'price-monthly-001',
                active: true,
                billingInterval: 'month',
                intervalCount: 1,
                unitAmount: 500000
            }
        ]
    };
}

/** Minimal real-shaped result for billing.subscriptions.create(). */
function makeCreatedSubscription(overrides: { id?: string } = {}) {
    return {
        id: overrides.id ?? 'sub-new-001',
        providerInitPoint: 'https://mercadopago.example/checkout/sub-new-001',
        providerSandboxInitPoint: null,
        providerSubscriptionIds: { mercadopago: 'mp-preapproval-new-001' }
    };
}

/** Fake QZPayBilling exposing only what createPaidSubscription/resolveReactivationPlan touch. */
function makeFakeBilling(
    overrides: {
        createResult?: ReturnType<typeof makeCreatedSubscription>;
        listAllResult?: ReturnType<typeof makePlan>[];
    } = {}
) {
    const create = vi.fn().mockResolvedValue(overrides.createResult ?? makeCreatedSubscription());
    const cancel = vi.fn().mockResolvedValue(undefined);
    const listAll = vi.fn().mockResolvedValue(overrides.listAllResult ?? [makePlan()]);

    return {
        billing: {
            plans: { listAll },
            subscriptions: { create, cancel }
        } as unknown as QZPayBilling,
        create,
        cancel,
        listAll
    };
}

/** Chainable fake Drizzle client covering exactly the calls this service issues. */
function makeFakeDb(selectRows: Record<string, unknown>[] = []) {
    const limit = vi.fn().mockResolvedValue(selectRows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set });

    return { db: { select, update } as never, select, update, updateWhere, set };
}

describe('replacePastDuePaymentMethod (HOS-348 Part B)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // HOS-1233 T-032: the shared paid-create helper resolves the plan's
        // domain before minting the replacement preapproval, and fails closed
        // when the plan is not found. Armed AFTER clearAllMocks, which would
        // otherwise wipe it.
        mockPlanDomainRead();
    });

    it('mints a fresh preapproval stamped with supersedesSubscriptionId and the debt-forgiveness markers', async () => {
        // Arrange
        const { billing, create, cancel } = makeFakeBilling();
        const { db } = makeFakeDb([]); // no in-flight attempt found

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result.reused).toBe(false);
        expect(result.localSubscriptionId).toBe('sub-new-001');
        expect(result.checkoutUrl).toBe('https://mercadopago.example/checkout/sub-new-001');

        expect(create).toHaveBeenCalledTimes(1);
        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        expect(createArgs.metadata).toMatchObject({
            supersedesSubscriptionId: PAST_DUE_SUBSCRIPTION_ID,
            [PAST_DUE_PAYMENT_METHOD_REPLACEMENT_METADATA_KEY]: 'true',
            unpaidPeriodForgiven: 'true',
            previousPlanId: PLAN_ID
        });
        // No trial field of any kind — guard G-1's whole point.
        expect(createArgs).not.toHaveProperty('freeTrialDays');
        expect(createArgs).not.toHaveProperty('startDate');

        // The load-bearing invariant: minting NEVER cancels the old
        // preapproval. Cancellation is entirely the webhook's job, gated on
        // the new subscription's confirmed PENDING_PROVIDER -> ACTIVE
        // transition (subscription-logic.ts) — untouched by this service.
        expect(cancel).not.toHaveBeenCalled();
    });

    it('states trialDays: 0 explicitly — a past-due replacement never re-opens a trial (HOS-1315)', async () => {
        // This is NOT the same fix as the status-seal above, and is easy to
        // mistake for cosmetic. Before this PR, the call into
        // `createPaidSubscription` omitted `trialDays` entirely. qzpay-core's
        // OWN fallback (`packages/core/src/billing.ts`, verified in the qzpay
        // clone): `if (input.trialDays !== undefined) createInput.trialDays =
        // input.trialDays; else if (price?.trialDays != null)
        // createInput.trialDays = price.trialDays;` — so an OMITTED trialDays
        // silently inherited the RESOLVED PRICE's own `trial_days` column,
        // which every `owner-*`/`tourist-*` monthly price carries as 30 (see
        // `own-preapproval-subscription-create.ts`'s identical
        // `trialDays: 0` JSDoc, measured on staging 5 of 5). qzpay-drizzle's
        // storage adapter then writes `trial_end = now + 30d` on the new row
        // regardless of `mode` (`drizzle-storage.adapter.ts:435-436` in the
        // qzpay clone — this computation does not check `mode` the way the
        // `initialStatus` one does), and `deriveTrialingStatus` reads that
        // `trial_end` once the preapproval is confirmed authorized. Net
        // effect: a customer who was `past_due` — the WORST candidate for a
        // free trial — got 30 days of `trialing` on the replacement, unbilled,
        // purely because this call site forgot to state the one field that
        // suppresses qzpay-core's own default. `trialDays: 0` (via routing
        // through `createOwnPreapprovalSubscription`, which REQUIRES it) is
        // what closes that — not merely "the same semantics made explicit".
        //
        // Only testable at this file's own boundary (the fake `QZPayBilling`
        // stands in for qzpay-core entirely, so its internal trialDays
        // fallback never runs here): assert this service states `trialDays: 0`
        // on every call into `billing.subscriptions.create`, so a future edit
        // that drops the field goes red instead of silently reopening the
        // trial-leak.
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        const createArgs = create.mock.calls[0]?.[0] as { trialDays?: number };
        expect(createArgs.trialDays).toBe(0);
    });

    it('reuses an in-flight replacement attempt within the reuse window instead of minting a second preapproval', async () => {
        // Arrange — an existing pending_provider row already supersedes this
        // exact past-due subscription, created moments ago.
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([
            {
                id: 'sub-inflight-001',
                metadata: { checkoutUrl: 'https://mercadopago.example/checkout/inflight-001' },
                createdAt: new Date()
            }
        ]);

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result).toEqual({
            reused: true,
            localSubscriptionId: 'sub-inflight-001',
            checkoutUrl: 'https://mercadopago.example/checkout/inflight-001'
        });
        expect(create).not.toHaveBeenCalled();
    });

    it('does NOT reuse an in-flight row missing its checkoutUrl stamp — mints instead', async () => {
        // Arrange — a row exists (mint started) but the checkoutUrl stamp
        // update never landed (e.g. a crash between create and the stamp).
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([
            { id: 'sub-inflight-002', metadata: {}, createdAt: new Date() }
        ]);

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result.reused).toBe(false);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('propagates SubscriptionCheckoutError from resolveReactivationPlan (e.g. unknown plan)', async () => {
        // Arrange — plans.listAll() returns no plan matching planId.
        const { billing } = makeFakeBilling({ listAllResult: [] });
        const { db } = makeFakeDb([]);

        // Act / Assert
        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });
});

/**
 * HOS-1287 — the SILENT half of the defect the checkout retry documented out
 * loud.
 *
 * These are the tests that matter most in this file. Everything above asserts
 * that a replacement preapproval is minted; these assert WHOSE it is. Before
 * HOS-1287 this service minted the replacement with no entity pointer at all,
 * so once the new preapproval confirmed and `completeSupersessionPairing`
 * cancelled the old one, the listing's bridge row was left pointing at a
 * CANCELLED subscription — a paying customer with a dark listing, no throw and
 * no log line.
 *
 * Two directions, both required:
 *  - toward the BUG: dropping the pointer must go red (the four
 *    `commerceEntityId` / `partnerId` assertions below).
 *  - toward the TOO-WIDE fix: minting for a domain whose price is not derivable
 *    from its plan (`addon`), or re-pointing a listing the row does not own (a
 *    gastronomy row carrying an experience pointer), must ALSO go red — those
 *    are the `DOMAIN_NOT_REPLACEABLE` cases.
 */
describe('replacePastDuePaymentMethod — domain carry-forward (HOS-1287)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPlanDomainRead();
    });

    it('carries the gastronomy entity pointer onto the replacement row', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: {
                id: PAST_DUE_SUBSCRIPTION_ID,
                planId: PLAN_ID,
                productDomain: 'gastronomy',
                metadata: {
                    commerceEntityType: 'gastronomy',
                    commerceEntityId: GASTRONOMY_ENTITY_ID
                }
            },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        // Read field by field, never through `objectContaining`: this whole
        // test exists because the fields were ABSENT, and `objectContaining` is
        // blind to a missing field.
        expect(createArgs.metadata?.commerceEntityType).toBe('gastronomy');
        expect(createArgs.metadata?.commerceEntityId).toBe(GASTRONOMY_ENTITY_ID);
        // The forgiveness marker still stands — the pointer is additive.
        expect(createArgs.metadata?.unpaidPeriodForgiven).toBe('true');
    });

    it('carries the experience entity pointer onto the replacement row', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: {
                id: PAST_DUE_SUBSCRIPTION_ID,
                planId: PLAN_ID,
                productDomain: 'experience',
                metadata: {
                    commerceEntityType: 'experience',
                    commerceEntityId: EXPERIENCE_ENTITY_ID
                }
            },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        expect(createArgs.metadata?.commerceEntityType).toBe('experience');
        expect(createArgs.metadata?.commerceEntityId).toBe(EXPERIENCE_ENTITY_ID);
    });

    it('carries the partner pointer onto the replacement row', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: {
                id: PAST_DUE_SUBSCRIPTION_ID,
                planId: PLAN_ID,
                productDomain: 'partner',
                metadata: { partnerId: PARTNER_ID }
            },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        expect(createArgs.metadata?.partnerId).toBe(PARTNER_ID);
    });

    it('stamps NO entity pointer for accommodation or tourist — the domains that own no listing', async () => {
        for (const productDomain of [null, 'accommodation', 'tourist']) {
            vi.clearAllMocks();
            mockPlanDomainRead();
            const { billing, create } = makeFakeBilling();
            const { db } = makeFakeDb([]);

            await replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain,
                    metadata: null
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            });

            const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
            expect(createArgs.metadata).not.toHaveProperty('commerceEntityId');
            expect(createArgs.metadata).not.toHaveProperty('partnerId');
        }
    });

    it('TOO-WIDE GUARD: refuses an addon row instead of minting at the BORROWED plan price', async () => {
        // A recurring add-on borrows the owner plan's price row and states its
        // real amount through `providerUnitAmountOverride`. This service
        // re-derives the price from the plan, so minting here would bill an
        // ARS 5.000 add-on at the plan's ARS 18.000-and-up. Refusing is the
        // whole point.
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain: 'addon',
                    metadata: null
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'DOMAIN_NOT_REPLACEABLE' });

        // Refused BEFORE anything reached MercadoPago — a preapproval minted
        // and then rejected would still need cancelling.
        expect(create).not.toHaveBeenCalled();
    });

    it('TOO-WIDE GUARD: refuses a gastronomy row whose stamped pointer names an experience listing', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain: 'gastronomy',
                    metadata: {
                        commerceEntityType: 'experience',
                        commerceEntityId: EXPERIENCE_ENTITY_ID
                    }
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'DOMAIN_NOT_REPLACEABLE' });
        expect(create).not.toHaveBeenCalled();
    });

    it('refuses a commerce row whose entity pointer was never stamped, rather than minting a pointerless replacement', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain: 'gastronomy',
                    metadata: {}
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'DOMAIN_NOT_REPLACEABLE' });
        expect(create).not.toHaveBeenCalled();
    });

    it('refuses the retired pre-HOS-685 umbrella domain rather than guessing a vertical for it', async () => {
        // HOS-695: a legacy row still carrying the umbrella value satisfies
        // NEITHER gastronomy NOR experience, and goes dark on purpose. The
        // pointer it carries is not enough to widen the comparison.
        const retiredUmbrellaDomain = ['comm', 'erce'].join('');
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain: retiredUmbrellaDomain,
                    metadata: {
                        commerceEntityType: 'gastronomy',
                        commerceEntityId: GASTRONOMY_ENTITY_ID
                    }
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'DOMAIN_NOT_REPLACEABLE' });
        expect(create).not.toHaveBeenCalled();
    });
});

/**
 * HOS-1315 — the second idempotency layer never matched its own producer.
 *
 * `findReusableReplacementAttempt` filters on `status = pending_provider`
 * (Hospeda's own vocabulary). Before this fix, `replacePastDuePaymentMethod`
 * minted through `createPaidSubscription` directly, and qzpay-core /
 * qzpay-drizzle write a freshly-`mode: 'paid'` row as `incomplete` (qzpay's
 * OWN vocabulary — see `subscription-status-normalize.ts`) and NEVER as
 * `pending_provider`. The predicate and the writer spoke two different
 * vocabularies and could never agree.
 *
 * Every other test in this file above proves the CONSUMER side works when
 * handed a row already shaped the way the predicate expects — but that row is
 * hand-fabricated by `makeFakeDb`, so those tests would stay green even if
 * the real producer wrote something the predicate could never match (exactly
 * what shipped). This suite instead drives BOTH sides through one shared,
 * STATEFUL fake `billing_subscriptions` table: `billing.subscriptions.create`
 * mimics qzpay-drizzle's real INSERT-time status (`incomplete`), and the fake
 * `db.update` mutates that SAME row the way `createOwnPreapprovalSubscription`
 * (or, pre-fix, nothing) actually does. A second `replacePastDuePaymentMethod`
 * call then re-runs the REAL `findReusableReplacementAttempt` SELECT against
 * whatever the first call's write path actually left behind — no row is ever
 * asserted into existence by the test itself.
 */
describe('replacePastDuePaymentMethod — producer writes what the consumer reads (HOS-1315)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPlanDomainRead();
    });

    /** One row of the fake `billing_subscriptions` table below. */
    interface FakeSubscriptionRow {
        readonly id: string;
        readonly customerId: string;
        status: string;
        metadata: Record<string, unknown> | null;
        readonly createdAt: Date;
    }

    /**
     * `apps/api/test/setup.ts` mocks `@repo/db` wholesale
     * (`test/helpers/mocks/db-mock.ts`), which replaces `eq`/`and`/`gte` with
     * plain, INSPECTABLE object builders rather than real `drizzle-orm` SQL —
     * `eq(a, b)` → `{ type: 'eq', left: a, right: b }`, `and(...args)` →
     * `{ type: 'and', conditions: args }` (verified empirically: logged the
     * actual object `findReusableReplacementAttempt`'s `and(...)` call
     * produces under this mock before writing the two helpers below). Column
     * references resolve to their plain DB-name string (the SAME mock file's
     * `billingSubscriptions.customerId === 'customer_id'`), so a leaf's
     * `left` is directly comparable to a column name — no SQL-AST walking
     * needed, unlike a suite that exercises the real `drizzle-orm` package.
     */
    interface MockCondition {
        readonly type?: string;
        readonly left?: unknown;
        readonly right?: unknown;
        readonly conditions?: readonly unknown[];
    }

    /** Flattens an `and(...)`-composed mock condition into its leaf conditions. */
    function flattenAndClause(clause: unknown): unknown[] {
        const condition = clause as MockCondition | undefined;
        if (condition?.type === 'and' && Array.isArray(condition.conditions)) {
            return condition.conditions.flatMap((child) => flattenAndClause(child));
        }
        return [clause];
    }

    /**
     * Reads the value a real `eq(<column named columnName>, value)` leaf
     * bound in `clause`, or `undefined` when no such leaf exists (e.g. a
     * mutation deleted it from the source's `and(...)` list). Used so the
     * fake SELECT below filters on what the query genuinely asked for,
     * instead of a value the test asserts in from the outside.
     */
    function eqValueFor(clause: unknown, columnName: string): string | undefined {
        for (const leaf of flattenAndClause(clause)) {
            const condition = leaf as MockCondition | undefined;
            if (
                condition?.type === 'eq' &&
                condition.left === columnName &&
                typeof condition.right === 'string'
            ) {
                return condition.right;
            }
        }
        return undefined;
    }

    /**
     * A stateful fake `QZPayBilling` + Drizzle client sharing ONE in-memory
     * `billing_subscriptions` table.
     *
     * `billing.subscriptions.create()` inserts a row exactly the way
     * qzpay-drizzle's real storage adapter does for a `mode: 'paid'` create —
     * `status: 'incomplete'`
     * (`packages/drizzle/src/adapter/drizzle-storage.adapter.ts:452` in the
     * qzpay clone: `input.mode === 'paid' ? 'incomplete' : ...`) — never
     * Hospeda's own `pending_provider`. `db.update(billingSubscriptions)...`
     * mutates that same row for real, so whatever
     * `createOwnPreapprovalSubscription`'s follow-up UPDATE writes (or, with
     * the bug reintroduced, whatever `createPaidSubscription` alone leaves
     * untouched) is exactly what a later `db.select(...)` sees — the two
     * halves of the bug, reproduced by letting the actual code drive both.
     *
     * The SELECT's `customerId` filter is read from the REAL condition object
     * `findReusableReplacementAttempt` passes to `.where(...)` (via
     * {@link eqValueFor}), not hardcoded — so a mutation that drops
     * `eq(billingSubscriptions.customerId, ...)` from that `and(...)` list
     * changes what THIS fake actually filters on, same as it would change a
     * real query. The `status` / `supersedesSubscriptionId` conditions are
     * still matched against fixed test constants (see the "not chased" note
     * on the mutation report for why — those two don't cross a tenant
     * boundary the way `customerId` does).
     */
    function makeStatefulFakeDbAndBilling() {
        const table: FakeSubscriptionRow[] = [];
        let lastCreatedId: string | null = null;
        let nextId = 1;

        const create = vi
            .fn()
            .mockImplementation(
                async (createInput: {
                    readonly customerId: string;
                    readonly metadata?: Record<string, unknown>;
                }) => {
                    const id = `sub-new-${nextId++}`;
                    lastCreatedId = id;
                    table.push({
                        id,
                        customerId: createInput.customerId,
                        // The real qzpay-drizzle write for a `mode: 'paid'` create.
                        // NEVER hand-set to `pending_provider` here — that would be
                        // exactly the fabrication this suite exists to avoid.
                        status: 'incomplete',
                        metadata: createInput.metadata ?? null,
                        createdAt: new Date()
                    });
                    return {
                        id,
                        providerInitPoint: `https://mercadopago.example/checkout/${id}`,
                        providerSandboxInitPoint: null,
                        providerSubscriptionIds: { mercadopago: `mp-${id}` }
                    };
                }
            );
        const cancel = vi.fn().mockResolvedValue(undefined);
        const listAll = vi.fn().mockResolvedValue([makePlan()]);

        const billing = {
            plans: { listAll },
            subscriptions: { create, cancel }
        } as unknown as QZPayBilling;

        // Evaluated against the table's CURRENT state — i.e. whatever the
        // production write path actually left there, not a value the test
        // asserted in. The `customerId` bound is read off the REAL `where(...)`
        // argument (see `eqValueFor` above); `status` /
        // `supersedesSubscriptionId` are matched against fixed test constants.
        const db = {
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn((condition: unknown) => ({
                        orderBy: vi.fn(() => ({
                            limit: vi.fn(async (n: number) => {
                                const boundCustomerId = eqValueFor(condition, 'customer_id');
                                return table
                                    .filter(
                                        (row) =>
                                            // `undefined` means the SOURCE'S OWN
                                            // condition carried no customerId
                                            // `eq(...)` leaf at all (e.g. a mutation
                                            // deleted it) — mirrored here as "do not
                                            // filter by customer", exactly what a real
                                            // query missing that clause would do.
                                            (boundCustomerId === undefined ||
                                                row.customerId === boundCustomerId) &&
                                            row.status ===
                                                SubscriptionStatusEnum.PENDING_PROVIDER &&
                                            (row.metadata as Record<string, unknown> | null)
                                                ?.supersedesSubscriptionId ===
                                                PAST_DUE_SUBSCRIPTION_ID
                                    )
                                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                                    .slice(0, n)
                                    .map((row) => ({
                                        id: row.id,
                                        metadata: row.metadata,
                                        createdAt: row.createdAt
                                    }));
                            })
                        }))
                    }))
                }))
            })),
            update: vi.fn(() => ({
                set: vi.fn((payload: Partial<FakeSubscriptionRow>) => ({
                    where: vi.fn(async () => {
                        const row = table.find((r) => r.id === lastCreatedId);
                        if (row) {
                            Object.assign(row, payload);
                        }
                    })
                }))
            }))
        };

        /** Shorthand: calls `replacePastDuePaymentMethod` bound to this fake's own `billing`/`db`. */
        const callReplace = (
            replaceInput: Omit<Parameters<typeof replacePastDuePaymentMethod>[0], 'billing' | 'db'>
        ) => replacePastDuePaymentMethod({ ...replaceInput, billing, db: db as never });

        return { billing, db: db as never, table, create, cancel, callReplace };
    }

    it('a second attempt reuses the FIRST mint’s own row instead of minting again', async () => {
        // Arrange
        const { billing, db, create } = makeStatefulFakeDbAndBilling();

        // Act — first attempt mints for real.
        const first = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Act — second attempt, same past-due row, same customer.
        const second = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert — the SAME row the first call minted is what the second call
        // reads back and reuses. This is the exact contract HOS-1315 found
        // broken: before the fix, the row created above stayed `incomplete`
        // forever, `findReusableReplacementAttempt` never matched it, and this
        // assertion failed with `second.reused === false` plus a SECOND
        // `create` call.
        expect(first.reused).toBe(false);
        expect(second.reused).toBe(true);
        expect(second.localSubscriptionId).toBe(first.localSubscriptionId);
        expect(second.checkoutUrl).toBe(first.checkoutUrl);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('the minted row is actually sealed to pending_provider, not left at qzpay’s raw incomplete', async () => {
        // Arrange
        const { billing, db, table } = makeStatefulFakeDbAndBilling();

        // Act
        await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert — read the table directly (not through the predicate) so
        // this test fails on the WRITE side specifically, independent of
        // whatever the SELECT filters on.
        expect(table).toHaveLength(1);
        expect(table[0]?.status).toBe(SubscriptionStatusEnum.PENDING_PROVIDER);
        expect(table[0]?.status).not.toBe('incomplete');
    });

    it('does NOT reuse another customer’s in-flight row, even one pointing at the SAME past-due subscription id', async () => {
        // Arrange — deliberately adversarial: two DIFFERENT customers, whose
        // in-flight rows both carry `supersedesSubscriptionId ===
        // PAST_DUE_SUBSCRIPTION_ID` (a real deployment could never collide on
        // a past-due subscription id this way — ids are unique — but the
        // point is to isolate the customerId condition on its own, not to
        // model a realistic scenario). If `findReusableReplacementAttempt`'s
        // `eq(billingSubscriptions.customerId, ...)` condition were ever
        // dropped, customer B would walk away with customer A's checkout.
        const { callReplace, create } = makeStatefulFakeDbAndBilling();

        const forCustomerA = await callReplace({
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook'
        });

        // Act — customer B, same billing/db instance, same past-due id.
        const forCustomerB = await callReplace({
            customerId: OTHER_CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook'
        });

        // Assert — customer B mints their OWN row rather than being handed
        // customer A's checkout.
        expect(forCustomerB.reused).toBe(false);
        expect(forCustomerB.localSubscriptionId).not.toBe(forCustomerA.localSubscriptionId);
        expect(create).toHaveBeenCalledTimes(2);
    });
});
