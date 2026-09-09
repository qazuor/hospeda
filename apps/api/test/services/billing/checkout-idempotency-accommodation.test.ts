/**
 * Regression tests: HOS-1272. The accommodation (and tourist) checkout must
 * be IDEMPOTENT PER CUSTOMER while a checkout is still in flight — commerce
 * and partner already had this (`checkout-idempotency-by-entity.test.ts`);
 * accommodation was the one entity-driven checkout with NONE.
 *
 * ## The bug
 *
 * Every click on "pay" (`POST /start-paid`, monthly OR annual) opens a NEW
 * `pending_provider` `billing_subscriptions` row and a NEW, independently
 * payable MercadoPago share link (Path C) / `init_point` (own-preapproval).
 * Both stay valid, so a double click (or a retried request) charges the host
 * twice. `start-paid.ts`'s route-level guard cannot stop it: it keys on
 * `{active, trialing, comp}`, and an in-flight checkout sits at
 * `pending_provider`, deliberately outside that set (blocking it would wedge
 * the host forever on a single abandoned checkout).
 *
 * ## What is asserted
 *
 * Two consecutive service calls for the SAME customer return the SAME share
 * link and materialize ONE subscription — plus the cases a hasty fix breaks:
 * an expired pending, a drifted MercadoPago plan, a different plan, a
 * different customer, a live (non-pending) subscription, and — new relative
 * to commerce/partner, since accommodation has no bridge TABLE to key on — an
 * unrelated in-flight subscription in a DIFFERENT product domain for the SAME
 * customer (a dual-role host + restaurateur).
 *
 * ## Why the DB is simulated rather than stubbed away
 *
 * `@repo/db` is replaced by a STATEFUL in-memory store the service populates
 * through the very `createPendingProviderSubscription` helper it calls in
 * production, so the guards under test are genuinely exercised.
 *
 * @module test/services/billing/checkout-idempotency-accommodation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Hoisted fixtures
// ──────────────────────────────────────────────────────────────────────────

const H = vi.hoisted(() => {
    interface SubscriptionRow {
        id: string;
        customerId: string;
        status: string;
        productDomain: string;
        planId: string;
        mpSubscriptionId: string | null;
        metadata: unknown;
        createdAt: Date;
    }
    interface PendingCheckoutRow {
        localSubscriptionId: string;
        customerId: string;
        planId: string;
        mpPreapprovalPlanId: string;
        nonce: string;
        status: string;
        expiresAt: Date;
        pendingDiscount: unknown;
        pendingTrialExtension: unknown;
    }
    interface PlanRow {
        id: string;
        productDomain: string;
    }

    const store = {
        subscriptions: [] as SubscriptionRow[],
        pendingCheckouts: [] as PendingCheckoutRow[],
        plans: [] as PlanRow[]
    };

    /** Per-test knobs the mocked boundaries read. */
    const knobs = {
        mpPlanId: 'mp_plan_test',
        pendingTtlMs: 3 * 60 * 60 * 1000,
        subCounter: 0
    };

    const billingSubscriptions = {
        __table: 'billing_subscriptions',
        id: 'id',
        customerId: 'customerId',
        status: 'status',
        productDomain: 'productDomain',
        planId: 'planId',
        mpSubscriptionId: 'mpSubscriptionId',
        metadata: 'metadata',
        createdAt: 'createdAt'
    };
    const billingPendingCheckouts = {
        __table: 'billing_pending_checkouts',
        localSubscriptionId: 'localSubscriptionId',
        customerId: 'customerId',
        planId: 'planId',
        mpPreapprovalPlanId: 'mpPreapprovalPlanId',
        nonce: 'nonce',
        status: 'status',
        expiresAt: 'expiresAt',
        pendingDiscount: 'pendingDiscount',
        pendingTrialExtension: 'pendingTrialExtension'
    };
    const billingPlans = {
        __table: 'billing_plans',
        id: 'id',
        productDomain: 'productDomain'
    };

    type Condition = { op: 'eq'; col: string; val: unknown } | { op: 'and'; parts: unknown[] };

    const flattenEq = (condition: unknown): Array<{ col: string; val: unknown }> => {
        const node = condition as Condition | undefined;
        if (!node) return [];
        if (node.op === 'eq') return [{ col: node.col, val: node.val }];
        if (node.op === 'and') return node.parts.flatMap(flattenEq);
        return [];
    };

    const rowsFor = (table: unknown): Array<Record<string, unknown>> => {
        if (table === billingSubscriptions)
            return store.subscriptions as unknown as Array<Record<string, unknown>>;
        if (table === billingPendingCheckouts)
            return store.pendingCheckouts as unknown as Array<Record<string, unknown>>;
        if (table === billingPlans) return store.plans as unknown as Array<Record<string, unknown>>;
        throw new Error('fake db: unknown table');
    };

    /**
     * Minimal `select(projection).from(t).where(cond)` implementation, with
     * BOTH `.limit(n)` (correlation row / plan lookup) and
     * `.orderBy(desc(createdAt)).limit(n)` (the accommodation bridge lookup)
     * on the returned object — `loadAccommodationBridge` is the only caller
     * that chains `.orderBy()`.
     */
    const fakeDb = {
        select: (projection: Record<string, string>) => ({
            from: (table: unknown) => ({
                where: (condition: unknown) => {
                    const filters = flattenEq(condition);
                    const rawFiltered = rowsFor(table).filter((row) =>
                        filters.every((f) => row[f.col] === f.val)
                    );
                    const project = (rows: Array<Record<string, unknown>>) =>
                        rows.map((row) =>
                            Object.fromEntries(
                                Object.entries(projection).map(([key, marker]) => [
                                    key,
                                    row[marker]
                                ])
                            )
                        );
                    return {
                        limit: (n: number) => Promise.resolve(project(rawFiltered).slice(0, n)),
                        // `orderBy` only ever receives `desc(billingSubscriptions.createdAt)`
                        // in production code — the marker itself is unused; this fake
                        // always sorts by `createdAt` descending, which is the only
                        // ordering this suite's queries ever request.
                        orderBy: () => ({
                            limit: (n: number) => {
                                const sorted = [...rawFiltered].sort((a, b) => {
                                    const at = (a.createdAt as Date | undefined)?.getTime() ?? 0;
                                    const bt = (b.createdAt as Date | undefined)?.getTime() ?? 0;
                                    return bt - at;
                                });
                                return Promise.resolve(project(sorted).slice(0, n));
                            }
                        })
                    };
                }
            })
        }),
        // HOS-937 step 2: `getMpPayerEmail` reads via raw `db.execute(sql...)`,
        // not the typed `select` chain modeled above. No `mp_payer_email`
        // fixture is relevant to this suite's reuse assertions.
        execute: async () => ({ rows: [] })
    };

    /**
     * Stands in for `createPendingProviderSubscription`: writes the
     * `billing_subscriptions` row (the accommodation "bridge", HOS-1272) plus
     * its correlation row, exactly as production does, with a fresh id/nonce
     * per call.
     */
    const createPendingProviderSubscription = vi.fn(
        async (input: {
            customerId: string;
            planId: string;
            mpPreapprovalPlanId: string;
            productDomain: string;
        }) => {
            knobs.subCounter += 1;
            const localSubscriptionId = `sub-${knobs.subCounter}`;
            const nonce = `nonce-${knobs.subCounter}`;
            const expiresAt = new Date(Date.now() + knobs.pendingTtlMs);
            const createdAt = new Date(Date.now() + knobs.subCounter); // monotonic, distinct per row
            store.subscriptions.push({
                id: localSubscriptionId,
                customerId: input.customerId,
                status: 'pending_provider',
                productDomain: input.productDomain,
                planId: input.planId,
                mpSubscriptionId: null,
                metadata: null,
                createdAt
            });
            store.pendingCheckouts.push({
                localSubscriptionId,
                customerId: input.customerId,
                planId: input.planId,
                mpPreapprovalPlanId: input.mpPreapprovalPlanId,
                nonce,
                status: 'pending',
                expiresAt,
                pendingDiscount: null,
                pendingTrialExtension: null
            });
            return { localSubscriptionId, nonce, expiresAt: expiresAt.toISOString() };
        }
    );

    return {
        store,
        knobs,
        fakeDb,
        billingSubscriptions,
        billingPendingCheckouts,
        billingPlans,
        createPendingProviderSubscription
    };
});

// ──────────────────────────────────────────────────────────────────────────
// Module mocks
// ──────────────────────────────────────────────────────────────────────────

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/env', () => ({
    // Path C — the production default (own-preapproval is dark-by-default).
    env: { HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: false }
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    resolveFreeTrialExtensionPromo: vi.fn(() => null),
    applyTestControl: vi.fn(async (_op: string, _args: unknown, realCall: () => Promise<unknown>) =>
        realCall()
    ),
    TEST_DAILY_PLAN: { slug: 'owner-test-daily' }
}));

vi.mock('../../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        // `buildPreapprovalPlanShareLink` stays REAL (pure) so the "same URL"
        // assertion exercises the actual builder.
        resolveCheckoutMpPlanId: vi.fn(async () => H.knobs.mpPlanId),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

vi.mock('../../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: (input: never) => H.createPendingProviderSubscription(input)
}));

vi.mock('../../../src/services/billing/own-preapproval-subscription-create', () => ({
    createOwnPreapprovalSubscription: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb: () => H.fakeDb,
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
    and: (...parts: unknown[]) => ({ op: 'and', parts }),
    desc: (col: unknown) => ({ op: 'desc', col }),
    billingSubscriptions: H.billingSubscriptions,
    billingPendingCheckouts: H.billingPendingCheckouts,
    billingPlans: H.billingPlans,
    // Unused by monthly/annual (commerce/partner only) — present so the
    // service module's top-level import does not resolve to `undefined`.
    entitySubscriptions: { __table: 'entity_subscriptions' },
    partnerSubscriptions: { __table: 'partner_subscriptions' }
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum } from '@repo/schemas';
import {
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription
} from '../../../src/services/subscription-checkout.service';

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cust_host';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const OTHER_PLAN_ID = '00000000-0000-4000-8000-0000000000bb';
const PLAN_SLUG = 'owner-premium';
const OTHER_PLAN_SLUG = 'owner-basico';

const MONTHLY_URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

const ANNUAL_URLS = {
    successUrl: 'https://hospeda.test/es/suscriptores/checkout/annual/success/',
    cancelUrl: 'https://hospeda.test/es/suscriptores/checkout/annual/cancel/',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

function createPlan(id: string, slug: string) {
    return {
        id,
        name: slug,
        metadata: { displayName: 'Anfitrión Premium' },
        prices: [
            {
                id: `price_m_${id}`,
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                unitAmount: 1_500_000,
                currency: 'ARS'
            },
            {
                id: `price_y_${id}`,
                billingInterval: 'year',
                intervalCount: 1,
                active: true,
                unitAmount: 15_000_000,
                currency: 'ARS'
            }
        ]
    };
}

function createBillingMock() {
    const plans = [createPlan(PLAN_ID, PLAN_SLUG), createPlan(OTHER_PLAN_ID, OTHER_PLAN_SLUG)];
    const billing = {
        plans: {
            listAll: vi.fn().mockResolvedValue(plans),
            get: vi.fn(async (id: string) => plans.find((p) => p.id === id) ?? null)
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'host@hospeda.test',
                name: 'Maria Rodriguez',
                livemode: false
            })
        },
        subscriptions: { create: vi.fn() }
    };
    // TYPE-WORKAROUND: the stub implements only the QZPayBilling subset the
    // service touches; cast so call sites need no per-call `any`.
    return { billing: billing as unknown as QZPayBilling };
}

const MONTHLY_INPUT = {
    customerId: CUSTOMER_ID,
    userId: 'user-1',
    planSlug: PLAN_SLUG,
    urls: MONTHLY_URLS
};

const ANNUAL_INPUT = {
    customerId: CUSTOMER_ID,
    userId: 'user-1',
    planSlug: PLAN_SLUG,
    urls: ANNUAL_URLS
};

beforeEach(() => {
    vi.clearAllMocks();
    H.store.subscriptions.length = 0;
    H.store.pendingCheckouts.length = 0;
    H.store.plans.length = 0;
    H.store.plans.push(
        { id: PLAN_ID, productDomain: ProductDomainEnum.ACCOMMODATION },
        { id: OTHER_PLAN_ID, productDomain: ProductDomainEnum.ACCOMMODATION }
    );
    H.knobs.subCounter = 0;
    H.knobs.mpPlanId = 'mp_plan_test';
    H.knobs.pendingTtlMs = 3 * 60 * 60 * 1000;
});

// ──────────────────────────────────────────────────────────────────────────
// Monthly (the live-in-production Path C branch — flag off)
// ──────────────────────────────────────────────────────────────────────────

describe('initiatePaidMonthlySubscription — idempotent per customer (HOS-1272)', () => {
    it('returns the SAME share link and creates ONE subscription on two consecutive clicks', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });
        const second = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });

        // Two live MercadoPago share links for one host = two real charges.
        expect(second.checkoutUrl).toBe(first.checkoutUrl);
        expect(second.localSubscriptionId).toBe(first.localSubscriptionId);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(1);
        expect(H.store.pendingCheckouts).toHaveLength(1);
    });

    it('reuses the link across MANY clicks, not just the second one', async () => {
        const { billing } = createBillingMock();

        const urls: string[] = [];
        for (let i = 0; i < 4; i += 1) {
            const result = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });
            urls.push(result.checkoutUrl);
        }

        expect(new Set(urls).size).toBe(1);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(1);
    });

    it('creates a NEW checkout when the in-flight pending has EXPIRED', async () => {
        const { billing } = createBillingMock();

        H.knobs.pendingTtlMs = -1_000;
        const first = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });

        H.knobs.pendingTtlMs = 3 * 60 * 60 * 1000;
        const second = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(second.localSubscriptionId).not.toBe(first.localSubscriptionId);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the resolved MercadoPago plan DRIFTED', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });

        H.knobs.mpPlanId = 'mp_plan_v2';
        const second = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(second.checkoutUrl).toContain('preapproval_plan_id=mp_plan_v2');
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the bridge row is no longer pending_provider (live subscription)', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });
        // The webhook activated the subscription. This is the window
        // start-paid.ts's ALREADY_SUBSCRIBED guard owns; the service must
        // never answer it with a stale share link.
        const row = H.store.subscriptions[0];
        if (row) row.status = 'active';

        const second = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout for a DIFFERENT customer (SYMMETRIC case: two legitimately distinct buyers must never collapse into one checkout)', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });
        const second = await initiatePaidMonthlySubscription({
            ...MONTHLY_INPUT,
            customerId: 'cust_other_host',
            billing
        });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
        expect(H.store.subscriptions).toHaveLength(2);
    });

    it('creates a NEW checkout when the SAME customer picks a DIFFERENT plan (SYMMETRIC case)', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });
        const second = await initiatePaidMonthlySubscription({
            ...MONTHLY_INPUT,
            planSlug: OTHER_PLAN_SLUG,
            billing
        });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('never reuses an in-flight subscription from a DIFFERENT product domain for the SAME customer (dual-role host + restaurateur)', async () => {
        const { billing } = createBillingMock();

        // A gastronomy pending_provider row for the SAME customer id — the
        // kind of row a dual-role host+restaurateur can genuinely have.
        // Accommodation has no bridge TABLE to scope by (unlike commerce/
        // partner), so the productDomain filter is what has to catch this.
        H.store.subscriptions.push({
            id: 'gastronomy-sub-1',
            customerId: CUSTOMER_ID,
            status: 'pending_provider',
            productDomain: ProductDomainEnum.GASTRONOMY,
            planId: 'gastronomy-plan',
            mpSubscriptionId: null,
            metadata: null,
            createdAt: new Date()
        });

        const result = await initiatePaidMonthlySubscription({ ...MONTHLY_INPUT, billing });

        // A fresh accommodation checkout was minted — the gastronomy row was
        // never touched or read as a bridge.
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(1);
        expect(result.localSubscriptionId).not.toBe('gastronomy-sub-1');
    });
});

// ──────────────────────────────────────────────────────────────────────────
// Annual (same underlying fix — must not be monthly-only)
// ──────────────────────────────────────────────────────────────────────────

describe('initiatePaidAnnualSubscription — idempotent per customer (HOS-1272)', () => {
    it('returns the SAME share link and creates ONE subscription on two consecutive clicks', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePaidAnnualSubscription({ ...ANNUAL_INPUT, billing });
        const second = await initiatePaidAnnualSubscription({ ...ANNUAL_INPUT, billing });

        expect(second.checkoutUrl).toBe(first.checkoutUrl);
        expect(second.localSubscriptionId).toBe(first.localSubscriptionId);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(1);
    });

    it('creates a NEW checkout for a DIFFERENT customer (SYMMETRIC case)', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePaidAnnualSubscription({ ...ANNUAL_INPUT, billing });
        const second = await initiatePaidAnnualSubscription({
            ...ANNUAL_INPUT,
            customerId: 'cust_other_host',
            billing
        });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the in-flight pending has EXPIRED', async () => {
        const { billing } = createBillingMock();

        H.knobs.pendingTtlMs = -1_000;
        const first = await initiatePaidAnnualSubscription({ ...ANNUAL_INPUT, billing });

        H.knobs.pendingTtlMs = 3 * 60 * 60 * 1000;
        const second = await initiatePaidAnnualSubscription({ ...ANNUAL_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });
});
