/**
 * HOS-1012 T-021 — no checkout may send a trial to MercadoPago.
 *
 * ## What this asserts, and against what
 *
 * Every one of the four checkout verticals — accommodation monthly, commerce
 * monthly (gastronomy/experience), partner monthly and accommodation annual —
 * builds its MercadoPago-bound payloads with NONE of the three banned keys:
 * `freeTrialDays`, `free_trial` and `start_date`. HOS-171 measured that the
 * latter two are the same mechanism, which is why both are banned rather than
 * just the one that bit us.
 *
 * There are exactly two MercadoPago-bound payloads on these paths, and this
 * suite pins both:
 *
 *  1. **The `preapproval_plan` provisioning input** (`resolveCheckoutMpPlanId`).
 *     This is where a trial reaches MercadoPago on the Path C hosted share-link
 *     flow: the adapter bakes `auto_recurring.free_trial` into the MP plan
 *     whenever `trialDays > 0`, and the checkout then redirects the buyer to
 *     that plan's share link. `trialDays` must be a literal 0 on all four.
 *  2. **The preapproval create body** (`billing.subscriptions.create`, reached
 *     through `createOwnPreapprovalSubscription` → `createPaidSubscription`
 *     when `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` is on). This is the real
 *     `POST /preapproval`. It is asserted RECURSIVELY — no banned key anywhere
 *     in the object graph, not merely at the top level — because a trial that
 *     travelled nested inside `auto_recurring` or `metadata` would satisfy a
 *     shallow check and still reach MercadoPago.
 *
 * ## The same body also pins two HOS-1221 invariants
 *
 * Both are about the same create body and the same four call paths, so they
 * live here rather than in 200 duplicated lines of scaffolding elsewhere.
 *
 * The second one is a LOCAL trial, not a provider one, and the distinction is
 * the whole point: omitting `trialDays` makes qzpay-core inherit the resolved
 * price's own value (30 on every owner-* / tourist-* monthly row in staging)
 * and the storage adapter then writes a `trial_end` a month out. Nothing asks
 * MercadoPago for anything — MP charges on day 1 — but the webhook's
 * `deriveTrialingStatus` reads that future date and reports the paying
 * customer as `trialing` for thirty days. The banned-key scan below cannot see
 * it: `trialDays` is deliberately NOT a banned key (it never reaches the
 * provider), which is exactly why it needed its own assertion.
 *
 * ## The plan id (HOS-1221 D1)
 *
 * Payload 2 is the only place in the suite tree where the REAL preapproval body
 * can be read for all four verticals at once, so it also asserts the absence of
 * `providerPriceId` — the field that turns this request into MercadoPago's
 * "subscription WITH an associated plan" flow and gets it rejected with
 * "card_token_id is required". That is a different ban from the trial one, but
 * it is the same body and the same four call paths, and duplicating 200 lines
 * of scaffolding to say it elsewhere would buy nothing.
 *
 * Both helpers are left REAL here on purpose. Mocking
 * `createOwnPreapprovalSubscription` (as the sibling flag-on suite does, for
 * routing questions) would make this suite blind to a `freeTrialDays` added
 * back one layer below the checkout service — which is precisely the layer that
 * actually talks to MercadoPago.
 *
 * ## Why the ban exists
 *
 * MercadoPago grants a preapproval's free trial ONCE per
 * `(payer, preapproval_plan)`, and reports a trial it has already spent
 * byte-identically to a live one. In production it charged a customer ARS
 * 18.000 one hundred and eighteen seconds after promising fourteen free days
 * (HOS-522). A trial we never ask for is a trial MercadoPago cannot lie about;
 * Hospeda's trial is now its own local `status='trialing'` row, opened at the
 * owner's first publish with no card and no provider object behind it.
 *
 * The static counterpart is `scripts/check-no-trial-to-mercadopago.sh`
 * (guard G-1), which fails CI on the SOURCE. This suite fails on the BEHAVIOR.
 * Neither subsumes the other: the guard catches a field added to a path this
 * suite does not exercise, and this suite catches a trial that arrives through
 * a spelling the guard's regexes do not know.
 *
 * @module test/services/subscription-checkout-no-trial-to-mercadopago
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mutable env stub. The service reads
 * `env.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` at CALL time (inside each
 * initiator), so flipping this object between tests is enough to exercise both
 * the Path C and the own-preapproval branch from one file — no `vi.doMock` +
 * `resetModules` gymnastics.
 *
 * `HOSPEDA_TRIAL_DAYS_OVERRIDE` is deliberately set to a large NON-zero value.
 * Under the old design it was the ops kill-switch and 0 meant "no trial"; a
 * suite that left it at 0 would pass even if the checkout still resolved trial
 * days. 90 makes the absence of a trial an assertion about the code, not about
 * a convenient default.
 */
const envMock = vi.hoisted(() => ({
    HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: false,
    HOSPEDA_SHOW_TEST_BILLING_PLAN: false,
    HOSPEDA_TRIAL_DAYS_OVERRIDE: 90,
    HOSPEDA_BILLING_POLLING_ENABLED: false,
    HOSPEDA_QZPAY_TEST_CONTROL_ENABLED: false
}));
vi.mock('../../src/utils/env', () => ({ env: envMock }));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// The MP `preapproval_plan` provisioning boundary — the FIRST of the two
// MercadoPago-bound payloads. Stubbed so no adapter/DB is needed, but its input
// is captured and asserted.
const resolveCheckoutMpPlanIdMock = vi.fn().mockResolvedValue('mp_plan_test');
vi.mock('../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        resolveCheckoutMpPlanId: (...args: unknown[]) => resolveCheckoutMpPlanIdMock(...args),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

// Path C's local materialization. Not a MercadoPago payload (nothing here is
// sent to the provider), but captured so the suite can also prove the checkout
// stops handing it a trial window to persist.
const createPendingProviderSubscriptionMock = vi.fn();
vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: (...args: unknown[]) =>
        createPendingProviderSubscriptionMock(...args)
}));

// Commerce/partner/accommodation in-flight-checkout reuse reads the DB before
// the branch this suite exercises. Always "no reusable checkout".
vi.mock('../../src/services/billing/checkout-idempotency', () => ({
    resolveReusableCommerceCheckout: vi.fn().mockResolvedValue(null),
    resolveReusableCommerceOwnPreapprovalCheckout: vi.fn().mockResolvedValue(null),
    resolveReusablePartnerCheckout: vi.fn().mockResolvedValue(null),
    resolveReusablePartnerOwnPreapprovalCheckout: vi.fn().mockResolvedValue(null),
    // HOS-1272
    resolveReusableAccommodationCheckout: vi.fn().mockResolvedValue(null),
    resolveReusableAccommodationOwnPreapprovalCheckout: vi.fn().mockResolvedValue(null)
}));

vi.mock('../../src/services/subscription-checkout-promo.service', () => ({
    resolveCheckoutPromoPlan: vi.fn().mockResolvedValue({ kind: 'none' })
}));

const dbUpdateWhereMock = vi.fn().mockResolvedValue(undefined);
const dbTxMock = {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: dbUpdateWhereMock })) })),
    insert: vi.fn(() => ({
        values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }))
    }))
};
const DB_STUB = {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: dbUpdateWhereMock })) })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(dbTxMock)),
    // HOS-1233 T-032: `createPaidSubscription` resolves the plan's own
    // `product_domain` before creating the preapproval, and fails CLOSED when
    // the plan is not found. Every flow this file exercises goes through it, so
    // the stub has to answer that SELECT or none of them reach a payload at all.
    //
    // Accommodation is the right constant here rather than a per-flow value:
    // this suite is about what LEAVES for MercadoPago (guard G-1, no trial in
    // the body), and the domain never travels in that payload — it is stored
    // locally. The commerce and partner flows in this file build their own rows
    // by hand and do not depend on this read.
    select: vi.fn(() => ({
        from: vi.fn(() => ({
            where: vi.fn(() => {
                const limit = vi.fn(() =>
                    Promise.resolve([{ productDomain: 'accommodation', createdAt: new Date() }])
                );
                return { limit, orderBy: vi.fn(() => ({ limit })) };
            })
        }))
    }))
};

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual('@repo/db');
    return {
        ...actual,
        getDb: vi.fn(() => DB_STUB),
        billingSubscriptions: { id: '__billing_subscriptions_id' },
        entitySubscriptions: {
            entityType: '__entity_type',
            entityId: '__entity_id'
        },
        partnerSubscriptions: { partnerId: '__partner_id' }
    };
});

import {
    initiateCommerceMonthlySubscription,
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription,
    initiatePartnerMonthlySubscription
} from '../../src/services/subscription-checkout.service';

// --- Fixtures -------------------------------------------------------------

const CUSTOMER_ID = 'cust-1';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARTNER_ID = '00000000-0000-4000-8000-0000000000bb';

/**
 * A plan that LOUDLY declares a trial. Nothing in this suite would fail if the
 * fixture declared none — a checkout with nothing to resolve trivially sends no
 * trial. The 30 days and `hasTrial: true` are what make every `trialDays: 0`
 * assertion below load-bearing.
 */
const TRIAL_DECLARING_PLAN = {
    id: PLAN_ID,
    name: 'owner-premium',
    metadata: { hasTrial: true, trialDays: 30 },
    prices: [
        {
            id: 'price-m',
            billingInterval: 'month',
            intervalCount: 1,
            active: true,
            unitAmount: 10000,
            currency: 'ARS',
            // HOS-1221 D3: the LOCAL trial length carried by the price row —
            // 30 on every owner-* and tourist-* monthly row in staging
            // (measured 2026-09-07, 5 of 5). It is what qzpay-core inherits
            // when a caller omits `trialDays`, and it is the reason the
            // phantom-trial assertions below are load-bearing rather than
            // trivially true.
            trialDays: 30
        },
        {
            id: 'price-y',
            billingInterval: 'year',
            intervalCount: 1,
            active: true,
            unitAmount: 100000,
            currency: 'ARS'
        }
    ]
};

/** The monthly price the accommodation/commerce/partner checkouts resolve. */
const MONTHLY_PRICE_FIXTURE = TRIAL_DECLARING_PLAN.prices[0] as { readonly trialDays?: number };
/** The annual price `initiatePaidAnnualSubscription` resolves — no trial, like staging. */
const ANNUAL_PRICE_FIXTURE = TRIAL_DECLARING_PLAN.prices[1] as { readonly trialDays?: number };

const MONTHLY_URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

const ANNUAL_URLS = {
    successUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    cancelUrl: 'https://hospeda.test/es/suscriptores/checkout/failure/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

/** Captures every `billing.subscriptions.create` body — the real preapproval create. */
let subscriptionsCreateMock: ReturnType<typeof vi.fn>;

function makeBilling() {
    subscriptionsCreateMock = vi.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        providerInitPoint: 'https://mp.test/subscriptions/checkout?preapproval_id=own-1',
        providerSubscriptionIds: { mercadopago: 'mp_preapproval_abc' }
    });
    return {
        plans: {
            listAll: vi.fn().mockResolvedValue([TRIAL_DECLARING_PLAN]),
            get: vi.fn().mockResolvedValue(TRIAL_DECLARING_PLAN)
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'host@hospeda.test',
                name: 'Maria Rodriguez',
                livemode: false
            })
        },
        subscriptions: {
            create: subscriptionsCreateMock,
            getByCustomerId: vi.fn().mockResolvedValue([]),
            cancel: vi.fn().mockResolvedValue(undefined)
        },
        getStorage: vi.fn(() => ({}))
    };
}

// --- Assertions -----------------------------------------------------------

/**
 * The three keys that must never reach MercadoPago, plus the camelCase spelling
 * qzpay-core would accept for each. `start_date`/`startDate` is banned for the
 * same reason as `free_trial`: HOS-171 measured that deferring the first charge
 * by a start date and by a free trial are the SAME provider mechanism, so
 * banning only the field that caused the incident would leave the door open.
 */
const BANNED_KEYS = ['freeTrialDays', 'free_trial', 'freeTrial', 'start_date', 'startDate'];

/**
 * Recursive: a banned key nested inside `auto_recurring`, `metadata` or any
 * other sub-object is exactly as sent as one at the top level, and a shallow
 * `not.toHaveProperty` would miss it.
 */
function collectBannedKeyPaths(value: unknown, path = '$'): string[] {
    if (value === null || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
        return value.flatMap((entry, i) => collectBannedKeyPaths(entry, `${path}[${i}]`));
    }
    const found: string[] = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (BANNED_KEYS.includes(key)) found.push(`${path}.${key}`);
        found.push(...collectBannedKeyPaths(child, `${path}.${key}`));
    }
    return found;
}

function expectNoTrialAnywhere(payload: unknown): void {
    expect(collectBannedKeyPaths(payload)).toEqual([]);
}

function mpPlanArg(): Record<string, unknown> {
    expect(resolveCheckoutMpPlanIdMock).toHaveBeenCalled();
    return resolveCheckoutMpPlanIdMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

function preapprovalCreateBody(): Record<string, unknown> {
    expect(subscriptionsCreateMock).toHaveBeenCalledTimes(1);
    return subscriptionsCreateMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

/**
 * HOS-1221: the second thing this body must not carry.
 *
 * `providerPriceId` is what qzpay-core forwards to the MercadoPago adapter,
 * which turns it into `preapproval_plan_id` and returns early — no inline
 * `auto_recurring`, no status. That is MercadoPago's "subscription WITH an
 * associated plan" request, and it answers HTTP 400 `"Create subscription -
 * card_token_id is required"` unless a card was already tokenized, which this
 * self-serve checkout never does. Every checkout with
 * `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` on answered 500 for that reason.
 *
 * Asserted as an ABSENCE on the real captured body, not through a
 * `toMatchObject`/`objectContaining` shape — those are blind to a field that
 * should not be there, which is how the previous version of this suite went on
 * passing while asserting `body.providerPriceId === 'mp_plan_test'`.
 */
function expectNoPlanIdAnywhere(payload: Record<string, unknown>): void {
    expect(payload).not.toHaveProperty('providerPriceId');
    expect(payload).not.toHaveProperty('preapproval_plan_id');
}

/**
 * qzpay-core's trial inheritance, replicated (`packages/core/src/billing.ts`):
 *
 *   if (input.trialDays !== undefined) createInput.trialDays = input.trialDays;
 *   else if (price?.trialDays != null)  createInput.trialDays = price.trialDays;
 *
 * Replicated rather than asserted through, because the fallback happens INSIDE
 * qzpay, below the `billing.subscriptions.create` boundary this suite stubs.
 * The model is itself under test ("the trial-window model" describe below), so
 * a model that always answered "no trial" cannot make these assertions vacuous.
 */
function inheritedTrialDays(
    body: Record<string, unknown>,
    price: { readonly trialDays?: number }
): number | undefined {
    if (body.trialDays !== undefined) {
        return body.trialDays as number;
    }
    return price.trialDays ?? undefined;
}

/**
 * The storage adapter's window write (`@qazuor/qzpay-drizzle`,
 * `drizzle-storage.adapter.ts`):
 *
 *   const hasTrial = input.trialDays !== undefined && input.trialDays > 0;
 *   trialStart: hasTrial ? now : null
 *   trialEnd:   hasTrial ? now + trialDays : null
 *
 * A window is what `deriveTrialingStatus` later reads to turn MercadoPago's
 * `authorized` into a local `trialing`.
 */
function trialWindowDays(trialDays: number | undefined): number | null {
    return trialDays !== undefined && trialDays > 0 ? trialDays : null;
}

/**
 * HOS-1221 D3: the row this checkout creates must be born with NO local trial
 * window, on a card MercadoPago charges on day 1.
 *
 * Asserted on the create body plus the price the checkout resolved, because
 * that pair is exactly what decides `trial_start`/`trial_end`. Path C makes the
 * same promise by writing hard NULLs
 * (`pending-provider-subscription-create.ts`); this branch has to make it by
 * stating the zero, since omission inherits the price's 30.
 *
 * TWO assertions, and the first is the load-bearing one. "No window" alone is
 * satisfied by a branch that says nothing about trials whenever the price it
 * resolved happens to carry none — measured: deleting `trialDays: 0` from the
 * ANNUAL branch left this suite green, because annual prices carry no trial
 * today. That is a true statement about today's data and a useless one about
 * the code, since the defect is the INHERITANCE and a `trial_days` loaded onto
 * an annual row tomorrow would switch it on with no diff anywhere. So the
 * checkout must STATE its own trial length; relying on the price's is the bug,
 * whatever the price currently says.
 */
function expectNoPhantomTrialWindow(
    body: Record<string, unknown>,
    price: { readonly trialDays?: number }
): void {
    // 1. The checkout states its own length — it never leaves the answer to
    //    whatever `billing_prices.trial_days` happens to hold.
    expect(body.trialDays).toBe(0);
    // 2. ...and the window that results is empty, on this price and any other.
    expect(trialWindowDays(inheritedTrialDays(body, price))).toBeNull();
}

// --- Suite ----------------------------------------------------------------

describe('HOS-1012 T-021: no checkout sends a trial to MercadoPago', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveCheckoutMpPlanIdMock.mockResolvedValue('mp_plan_test');
        createPendingProviderSubscriptionMock.mockResolvedValue({
            localSubscriptionId: 'pending-sub-1',
            nonce: 'nonce-test',
            expiresAt: '2099-01-01T00:00:00.000Z'
        });
        DB_STUB.execute.mockResolvedValue({ rows: [] });
        envMock.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = false;
    });

    describe('the preapproval_plan provisioned for the hosted checkout (Path C)', () => {
        it('accommodation monthly resolves trialDays=0 and passes no banned field', async () => {
            const billing = makeBilling();

            await initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                userId: 'user-1',
                planSlug: 'owner-premium',
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: MONTHLY_URLS,
                // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
                db: DB_STUB as any
            });

            expect(mpPlanArg().trialDays).toBe(0);
            expectNoTrialAnywhere(mpPlanArg());
            // Path C creates no preapproval server-side; if one ever appears
            // here it is a payload nothing in this suite was pinning.
            expect(subscriptionsCreateMock).not.toHaveBeenCalled();
            // The local pending row is handed no trial window either.
            expectNoTrialAnywhere(createPendingProviderSubscriptionMock.mock.calls[0]?.[0]);
        });

        it('commerce monthly resolves trialDays=0 and passes no banned field', async () => {
            const billing = makeBilling();

            await initiateCommerceMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                entityType: 'gastronomy',
                entityId: '00000000-0000-4000-8000-0000000000cc',
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: MONTHLY_URLS
            });

            expect(mpPlanArg().trialDays).toBe(0);
            expectNoTrialAnywhere(mpPlanArg());
            expectNoTrialAnywhere(createPendingProviderSubscriptionMock.mock.calls[0]?.[0]);
        });

        it('partner monthly resolves trialDays=0 and passes no banned field', async () => {
            const billing = makeBilling();

            await initiatePartnerMonthlySubscription({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                partnerId: PARTNER_ID,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: MONTHLY_URLS
            });

            expect(mpPlanArg().trialDays).toBe(0);
            expectNoTrialAnywhere(mpPlanArg());
            expectNoTrialAnywhere(createPendingProviderSubscriptionMock.mock.calls[0]?.[0]);
        });

        it('accommodation annual resolves trialDays=0 and passes no banned field', async () => {
            const billing = makeBilling();

            await initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                userId: 'user-1',
                planSlug: 'owner-premium',
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: ANNUAL_URLS,
                // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
                db: DB_STUB as any
            });

            expect(mpPlanArg().billingInterval).toBe('annual');
            expect(mpPlanArg().trialDays).toBe(0);
            expectNoTrialAnywhere(mpPlanArg());
            expectNoTrialAnywhere(createPendingProviderSubscriptionMock.mock.calls[0]?.[0]);
        });
    });

    describe('the real POST /preapproval body (own-preapproval flow, HOS-937)', () => {
        beforeEach(() => {
            envMock.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = true;
        });

        it('accommodation monthly builds a preapproval body with no trial field anywhere', async () => {
            const billing = makeBilling();

            await initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                userId: 'user-1',
                planSlug: 'owner-premium',
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: MONTHLY_URLS,
                // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
                db: DB_STUB as any
            });

            const body = preapprovalCreateBody();
            // Sanity: this really is the preapproval create, not an empty stub.
            expect(body.mode).toBe('paid');
            expect(body.priceId).toBe('price-m');
            expectNoTrialAnywhere(body);
            expectNoPlanIdAnywhere(body);
            expectNoPhantomTrialWindow(body, MONTHLY_PRICE_FIXTURE);
        });

        it('commerce monthly builds a preapproval body with no trial field anywhere', async () => {
            const billing = makeBilling();

            await initiateCommerceMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'owner-premium',
                entityType: 'experience',
                entityId: '00000000-0000-4000-8000-0000000000dd',
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: MONTHLY_URLS
            });

            const body = preapprovalCreateBody();
            expect(body.mode).toBe('paid');
            expectNoTrialAnywhere(body);
            expectNoPlanIdAnywhere(body);
            expectNoPhantomTrialWindow(body, MONTHLY_PRICE_FIXTURE);
        });

        it('partner monthly builds a preapproval body with no trial field anywhere', async () => {
            const billing = makeBilling();

            await initiatePartnerMonthlySubscription({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                partnerId: PARTNER_ID,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: MONTHLY_URLS
            });

            const body = preapprovalCreateBody();
            expect(body.mode).toBe('paid');
            expectNoTrialAnywhere(body);
            expectNoPlanIdAnywhere(body);
            expectNoPhantomTrialWindow(body, MONTHLY_PRICE_FIXTURE);
        });

        it('accommodation annual builds a preapproval body with no trial field anywhere', async () => {
            const billing = makeBilling();

            await initiatePaidAnnualSubscription({
                customerId: CUSTOMER_ID,
                userId: 'user-1',
                planSlug: 'owner-premium',
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: ANNUAL_URLS,
                // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
                db: DB_STUB as any
            });

            const body = preapprovalCreateBody();
            expect(body.mode).toBe('paid');
            expect(body.billingInterval).toBe('annual');
            expectNoTrialAnywhere(body);
            expectNoPlanIdAnywhere(body);
            expectNoPhantomTrialWindow(body, ANNUAL_PRICE_FIXTURE);
        });

        /**
         * The four assertions above would all pass with a checkout that simply
         * never mentioned `trialDays` — as long as the price it resolved
         * carried none. This one says the stronger thing for the branch that is
         * actually exposed: the accommodation monthly price DOES carry 30, and
         * the checkout still has to state its own zero.
         */
        it('states trialDays: 0 explicitly on a price that carries 30 (HOS-1221 D3)', async () => {
            const billing = makeBilling();

            await initiatePaidMonthlySubscription({
                customerId: CUSTOMER_ID,
                userId: 'user-1',
                planSlug: 'owner-premium',
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                urls: MONTHLY_URLS,
                // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
                db: DB_STUB as any
            });

            const body = preapprovalCreateBody();
            expect(MONTHLY_PRICE_FIXTURE.trialDays).toBe(30);
            expect(body.trialDays).toBe(0);
        });
    });

    /**
     * The model the phantom-trial assertions run on. Without these, a helper
     * that always answered "no window" would make all four of them vacuous —
     * the same reason "the detector itself" exists for the banned-key scan.
     */
    describe('the trial-window model', () => {
        it('inherits the price trial when the caller omits trialDays — the bug', () => {
            expect(trialWindowDays(inheritedTrialDays({}, { trialDays: 30 }))).toBe(30);
        });

        it('yields no window when the caller states zero, even on a 30-day price', () => {
            expect(
                trialWindowDays(inheritedTrialDays({ trialDays: 0 }, { trialDays: 30 }))
            ).toBeNull();
        });

        it('an explicit non-zero still opens a window — the model is not hardwired to null', () => {
            expect(trialWindowDays(inheritedTrialDays({ trialDays: 14 }, {}))).toBe(14);
        });

        it('yields no window when neither side carries a trial', () => {
            expect(trialWindowDays(inheritedTrialDays({}, {}))).toBeNull();
        });
    });

    describe('the detector itself', () => {
        // A "no banned key found" assertion is only worth something if the
        // detector can find one. Without this, every assertion above would keep
        // passing if `collectBannedKeyPaths` silently returned [] for all input.
        it('finds a banned key nested inside auto_recurring', () => {
            expect(
                collectBannedKeyPaths({
                    mode: 'paid',
                    auto_recurring: { frequency: 1, free_trial: { frequency: 30 } }
                })
            ).toEqual(['$.auto_recurring.free_trial']);
        });

        it('finds a top-level freeTrialDays and a start_date together', () => {
            expect(collectBannedKeyPaths({ freeTrialDays: 30, startDate: '2026-10-01' })).toEqual([
                '$.freeTrialDays',
                '$.startDate'
            ]);
        });

        it('finds a banned key inside an array element', () => {
            expect(collectBannedKeyPaths({ items: [{ ok: 1 }, { free_trial: 30 }] })).toEqual([
                '$.items[1].free_trial'
            ]);
        });
    });
});
