/**
 * Regression tests: the commerce and partner checkouts must be IDEMPOTENT PER
 * ENTITY while a checkout is still in flight.
 *
 * ## The bug
 *
 * Since the Path C migration (HOS-191 / PR #2832) every click on "pay" opens a
 * NEW `pending_provider` subscription and a NEW MercadoPago share link. Both
 * links stay valid, so a buyer who clicks twice can pay twice for one listing.
 * The 409 guard in `routes/commerce/protected/start-subscription.ts` cannot stop
 * it: it keys on `{active, trialing, past_due}`, and an in-flight checkout sits
 * at `pending_provider`, which is deliberately NOT in that set (blocking it
 * would wedge a listing forever on an abandoned checkout). The two ADMIN entry
 * points (`routes/commerce/admin/start-subscription.ts`,
 * `routes/partners/admin/send-link.ts`) have no guard at all.
 *
 * ## What is asserted
 *
 * Two consecutive service calls for the SAME entity return the SAME share link
 * and materialize ONE subscription — plus the cases a hasty fix breaks: an
 * expired pending, a drifted MercadoPago plan, an already-linked correlation
 * row, a non-pending bridge row (the live-subscription window the route's 409
 * owns), a changed owner, and two distinct entities.
 *
 * ## Why the DB is simulated rather than stubbed away
 *
 * `@repo/db` is replaced by a STATEFUL in-memory store that the service itself
 * populates through the very `writeDomainLinkRow` callback and pending-checkout
 * helper it calls in production. The store honours the entity key, the
 * correlation row's `status`, and its `expiresAt` — so the guards under test are
 * genuinely exercised rather than short-circuited by a mock that always answers
 * "nothing in flight".
 *
 * @module test/services/billing/checkout-idempotency-by-entity
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Hoisted fixtures — `vi.mock` factories are lifted above every top-level
// binding, so everything they touch has to live in here.
// ──────────────────────────────────────────────────────────────────────────

const H = vi.hoisted(() => {
    interface CommerceBridgeRow {
        entityType: string;
        entityId: string;
        subscriptionId: string;
        status: string;
    }
    interface PartnerBridgeRow {
        partnerId: string;
        subscriptionId: string;
        status: string;
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

    const store = {
        commerceBridge: [] as CommerceBridgeRow[],
        partnerBridge: [] as PartnerBridgeRow[],
        pendingCheckouts: [] as PendingCheckoutRow[]
    };

    /** Per-test knobs the mocked boundaries read. */
    const knobs = {
        /** What `resolveCheckoutMpPlanId` hands back — change it to simulate plan drift. */
        mpPlanId: 'mp_plan_test',
        /** TTL stamped on newly written correlation rows (ms). Negative ⇒ born expired. */
        pendingTtlMs: 3 * 60 * 60 * 1000,
        /** Promo snapshot stamped on newly written correlation rows (forward fence). */
        promoSnapshot: {} as { pendingDiscount?: unknown; pendingTrialExtension?: unknown },
        /** Monotonic counter behind the generated subscription ids / nonces. */
        subCounter: 0
    };

    /**
     * Mocked table objects. Every column marker is its own property name, so the
     * fake query engine maps an `eq(col, value)` leaf straight onto a row field.
     */
    const commerceListingSubscriptions = {
        __table: 'commerce_listing_subscriptions',
        entityType: 'entityType',
        entityId: 'entityId',
        subscriptionId: 'subscriptionId',
        status: 'status'
    };
    const partnerSubscriptions = {
        __table: 'partner_subscriptions',
        partnerId: 'partnerId',
        subscriptionId: 'subscriptionId',
        status: 'status'
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

    type Condition = { op: 'eq'; col: string; val: unknown } | { op: 'and'; parts: unknown[] };

    /** Flattens an `and(eq(...), eq(...))` tree into concrete column/value pairs. */
    const flattenEq = (condition: unknown): Array<{ col: string; val: unknown }> => {
        const node = condition as Condition | undefined;
        if (!node) return [];
        if (node.op === 'eq') return [{ col: node.col, val: node.val }];
        if (node.op === 'and') return node.parts.flatMap(flattenEq);
        return [];
    };

    const rowsFor = (table: unknown): Array<Record<string, unknown>> => {
        if (table === commerceListingSubscriptions)
            return store.commerceBridge as unknown as Array<Record<string, unknown>>;
        if (table === partnerSubscriptions)
            return store.partnerBridge as unknown as Array<Record<string, unknown>>;
        if (table === billingPendingCheckouts)
            return store.pendingCheckouts as unknown as Array<Record<string, unknown>>;
        throw new Error('fake db: unknown table');
    };

    /** Minimal `select(projection).from(t).where(cond).limit(n)` implementation. */
    const fakeDb = {
        select: (projection: Record<string, string>) => ({
            from: (table: unknown) => ({
                where: (condition: unknown) => {
                    const filters = flattenEq(condition);
                    const projected = rowsFor(table)
                        .filter((row) => filters.every((f) => row[f.col] === f.val))
                        .map((row) =>
                            Object.fromEntries(
                                Object.entries(projection).map(([key, marker]) => [
                                    key,
                                    row[marker]
                                ])
                            )
                        );
                    // Only `.limit(n)` is modelled — an unlimited select would
                    // silently resolve to `undefined` here, which is a louder
                    // failure than quietly inventing rows.
                    return { limit: (n: number) => Promise.resolve(projected.slice(0, n)) };
                }
            })
        })
    };

    /**
     * `tx` handed to `writeDomainLinkRow`. Applies the real upsert semantics of
     * the two bridge tables (UNIQUE on the entity key) against the in-memory
     * store, so the SECOND click genuinely finds the FIRST click's row.
     */
    const txStub = {
        insert: (table: unknown) => ({
            values: (values: Record<string, unknown>) => ({
                onConflictDoUpdate: ({
                    set
                }: {
                    target: unknown;
                    set: Record<string, unknown>;
                }) => {
                    if (table === commerceListingSubscriptions) {
                        const existing = store.commerceBridge.find(
                            (r) =>
                                r.entityType === values.entityType && r.entityId === values.entityId
                        );
                        if (existing) Object.assign(existing, set);
                        else store.commerceBridge.push(values as unknown as CommerceBridgeRow);
                        return Promise.resolve(undefined);
                    }
                    if (table === partnerSubscriptions) {
                        const existing = store.partnerBridge.find(
                            (r) => r.partnerId === values.partnerId
                        );
                        if (existing) Object.assign(existing, set);
                        else store.partnerBridge.push(values as unknown as PartnerBridgeRow);
                        return Promise.resolve(undefined);
                    }
                    throw new Error('fake tx: unknown table');
                }
            })
        }),
        update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })
    };

    /**
     * Stands in for `createPendingProviderSubscription`: writes ONE correlation
     * row plus the bridge row, exactly as production does, with a fresh
     * subscription id and nonce per call.
     */
    const createPendingProviderSubscription = vi.fn(
        async (input: {
            customerId: string;
            planId: string;
            mpPreapprovalPlanId: string;
            writeDomainLinkRow?: (params: {
                tx: unknown;
                localSubscriptionId: string;
            }) => Promise<void>;
        }) => {
            knobs.subCounter += 1;
            const localSubscriptionId = `sub-${knobs.subCounter}`;
            const nonce = `nonce-${knobs.subCounter}`;
            const expiresAt = new Date(Date.now() + knobs.pendingTtlMs);
            store.pendingCheckouts.push({
                localSubscriptionId,
                customerId: input.customerId,
                planId: input.planId,
                mpPreapprovalPlanId: input.mpPreapprovalPlanId,
                nonce,
                status: 'pending',
                expiresAt,
                pendingDiscount: knobs.promoSnapshot.pendingDiscount ?? null,
                pendingTrialExtension: knobs.promoSnapshot.pendingTrialExtension ?? null
            });
            await input.writeDomainLinkRow?.({ tx: txStub, localSubscriptionId });
            return { localSubscriptionId, nonce, expiresAt: expiresAt.toISOString() };
        }
    );

    return {
        store,
        knobs,
        fakeDb,
        txStub,
        commerceListingSubscriptions,
        partnerSubscriptions,
        billingPendingCheckouts,
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
    env: { HOSPEDA_BILLING_POLLING_ENABLED: false }
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

vi.mock('@repo/db', () => ({
    getDb: () => H.fakeDb,
    withTransaction: (cb: (tx: unknown) => Promise<unknown>) => cb(H.txStub),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
    and: (...parts: unknown[]) => ({ op: 'and', parts }),
    gt: (col: unknown, val: unknown) => ({ op: 'gt', col, val }),
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    billingPendingCheckouts: H.billingPendingCheckouts,
    commerceListingSubscriptions: H.commerceListingSubscriptions,
    partnerSubscriptions: H.partnerSubscriptions
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import {
    initiateCommerceMonthlySubscription,
    initiatePartnerMonthlySubscription
} from '../../../src/services/subscription-checkout.service';

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PLAN_SLUG = 'commerce-listing';
const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ENTITY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PARTNER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_PARTNER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/comercios/checkout/success/',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

function createBillingMock() {
    const plan = {
        id: PLAN_ID,
        name: PLAN_SLUG,
        metadata: { displayName: 'Comercios' },
        prices: [
            {
                id: 'price_m',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                unitAmount: 1_500_000,
                currency: 'ARS'
            }
        ]
    };
    const billing = {
        plans: {
            list: vi.fn().mockResolvedValue({ data: [plan] }),
            get: vi.fn().mockResolvedValue(plan)
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'owner@hospeda.test',
                name: 'Owner',
                livemode: false
            })
        },
        subscriptions: { create: vi.fn() },
        getStorage: vi.fn(() => ({ subscriptionPollingJobs: undefined }))
    };
    // TYPE-WORKAROUND: the stub implements only the QZPayBilling subset the
    // service touches; cast so call sites need no per-call `any`.
    return { billing: billing as unknown as QZPayBilling };
}

const COMMERCE_INPUT = {
    customerId: CUSTOMER_ID,
    planSlug: PLAN_SLUG,
    entityType: 'gastronomy',
    entityId: ENTITY_ID,
    urls: URLS
};

const PARTNER_INPUT = {
    customerId: CUSTOMER_ID,
    planId: PLAN_ID,
    partnerId: PARTNER_ID,
    urls: URLS
};

beforeEach(() => {
    vi.clearAllMocks();
    H.store.commerceBridge.length = 0;
    H.store.partnerBridge.length = 0;
    H.store.pendingCheckouts.length = 0;
    H.knobs.subCounter = 0;
    H.knobs.mpPlanId = 'mp_plan_test';
    H.knobs.pendingTtlMs = 3 * 60 * 60 * 1000;
    H.knobs.promoSnapshot = {};
});

// ──────────────────────────────────────────────────────────────────────────
// Commerce
// ──────────────────────────────────────────────────────────────────────────

describe('initiateCommerceMonthlySubscription — idempotent per entity', () => {
    it('returns the SAME share link and creates ONE subscription on two consecutive clicks', async () => {
        const { billing } = createBillingMock();

        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });
        const second = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        // Two live MercadoPago share links for one listing = two real charges.
        expect(second.checkoutUrl).toBe(first.checkoutUrl);
        expect(second.localSubscriptionId).toBe(first.localSubscriptionId);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(1);
        expect(H.store.pendingCheckouts).toHaveLength(1);
    });

    it('reuses the link across MANY clicks, not just the second one', async () => {
        const { billing } = createBillingMock();

        const urls: string[] = [];
        for (let i = 0; i < 4; i += 1) {
            const result = await initiateCommerceMonthlySubscription({
                ...COMMERCE_INPUT,
                billing
            });
            urls.push(result.checkoutUrl);
        }

        expect(new Set(urls).size).toBe(1);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(1);
    });

    it('creates a NEW checkout when the in-flight pending has EXPIRED', async () => {
        const { billing } = createBillingMock();

        // First click writes a correlation row already past its TTL — an
        // abandoned checkout must never wedge the listing.
        H.knobs.pendingTtlMs = -1_000;
        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        H.knobs.pendingTtlMs = 3 * 60 * 60 * 1000;
        const second = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(second.localSubscriptionId).not.toBe(first.localSubscriptionId);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the resolved MercadoPago plan DRIFTED', async () => {
        const { billing } = createBillingMock();

        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        // The commercial price changed, so `resolveOrProvisionMpPlan` handed back
        // a different preapproval_plan. Serving the old link would charge the old
        // price.
        H.knobs.mpPlanId = 'mp_plan_v2';
        const second = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(second.checkoutUrl).toContain('preapproval_plan_id=mp_plan_v2');
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the correlation row is no longer `pending` (already linked)', async () => {
        const { billing } = createBillingMock();

        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });
        // The buyer paid: F2/F3 flipped the correlation row to `linked`.
        const row = H.store.pendingCheckouts[0];
        if (row) row.status = 'linked';

        const second = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the bridge row is no longer pending_provider (live subscription)', async () => {
        const { billing } = createBillingMock();

        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });
        // The webhook activated the subscription. This is the window the route's
        // 409 owns; the service must never answer it with a stale share link.
        const bridge = H.store.commerceBridge[0];
        if (bridge) bridge.status = 'active';

        const second = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the OWNER (billing customer) changed', async () => {
        const { billing } = createBillingMock();

        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });
        const second = await initiateCommerceMonthlySubscription({
            ...COMMERCE_INPUT,
            customerId: 'cust_new_owner',
            billing
        });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the in-flight pending carries a promo snapshot', async () => {
        const { billing } = createBillingMock();

        // Forward fence: commerce takes no promo code today, so this can only
        // become reachable if someone adds one. Reuse must fail CLOSED then —
        // serving the old link would apply the previous coupon.
        H.knobs.promoSnapshot = {
            pendingDiscount: { promoCodeId: 'promo-1', finalAmountCentavos: 1_000_000 }
        };
        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        H.knobs.promoSnapshot = {};
        const second = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the in-flight pending carries a TRIAL EXTENSION snapshot', async () => {
        const { billing } = createBillingMock();

        // The promo fence reads TWO columns; a check that only looks at
        // `pendingDiscount` passes the previous test while leaving this one open.
        H.knobs.promoSnapshot = {
            pendingTrialExtension: { promoCodeId: 'promo-2', code: 'EXTRA30' }
        };
        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        H.knobs.promoSnapshot = {};
        const second = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('keeps two DIFFERENT listings on two independent checkouts', async () => {
        const { billing } = createBillingMock();

        const first = await initiateCommerceMonthlySubscription({ ...COMMERCE_INPUT, billing });
        const other = await initiateCommerceMonthlySubscription({
            ...COMMERCE_INPUT,
            entityId: OTHER_ENTITY_ID,
            billing
        });

        expect(other.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
        expect(H.store.commerceBridge).toHaveLength(2);
    });

    it('keeps the same entityId on two different entityTypes independent', async () => {
        const { billing } = createBillingMock();

        // gastronomy and experience ids are drawn from independent key spaces,
        // so the bridge lookup must be keyed on BOTH columns.
        const gastronomy = await initiateCommerceMonthlySubscription({
            ...COMMERCE_INPUT,
            billing
        });
        const experience = await initiateCommerceMonthlySubscription({
            ...COMMERCE_INPUT,
            entityType: 'experience',
            billing
        });

        expect(experience.checkoutUrl).not.toBe(gastronomy.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });
});

// ──────────────────────────────────────────────────────────────────────────
// Partner (admin `send-link` — the entry point with NO route-level guard)
// ──────────────────────────────────────────────────────────────────────────

describe('initiatePartnerMonthlySubscription — idempotent per partner', () => {
    it('returns the SAME share link and creates ONE subscription on two consecutive sends', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePartnerMonthlySubscription({ ...PARTNER_INPUT, billing });
        const second = await initiatePartnerMonthlySubscription({ ...PARTNER_INPUT, billing });

        expect(second.checkoutUrl).toBe(first.checkoutUrl);
        expect(second.localSubscriptionId).toBe(first.localSubscriptionId);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(1);
    });

    it('creates a NEW checkout when the in-flight pending has EXPIRED', async () => {
        const { billing } = createBillingMock();

        H.knobs.pendingTtlMs = -1_000;
        const first = await initiatePartnerMonthlySubscription({ ...PARTNER_INPUT, billing });

        H.knobs.pendingTtlMs = 3 * 60 * 60 * 1000;
        const second = await initiatePartnerMonthlySubscription({ ...PARTNER_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('creates a NEW checkout when the admin picked a different plan (MP plan drift)', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePartnerMonthlySubscription({ ...PARTNER_INPUT, billing });

        H.knobs.mpPlanId = 'mp_plan_partner_v2';
        const second = await initiatePartnerMonthlySubscription({ ...PARTNER_INPUT, billing });

        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
    });

    it('keeps two DIFFERENT partners on two independent checkouts', async () => {
        const { billing } = createBillingMock();

        const first = await initiatePartnerMonthlySubscription({ ...PARTNER_INPUT, billing });
        const other = await initiatePartnerMonthlySubscription({
            ...PARTNER_INPUT,
            partnerId: OTHER_PARTNER_ID,
            billing
        });

        expect(other.checkoutUrl).not.toBe(first.checkoutUrl);
        expect(H.createPendingProviderSubscription).toHaveBeenCalledTimes(2);
        expect(H.store.partnerBridge).toHaveLength(2);
    });
});
