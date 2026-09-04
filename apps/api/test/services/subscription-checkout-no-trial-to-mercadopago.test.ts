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

// Commerce/partner in-flight-checkout reuse reads the DB before the branch this
// suite exercises. Always "no reusable checkout".
vi.mock('../../src/services/billing/checkout-idempotency', () => ({
    resolveReusableCommerceCheckout: vi.fn().mockResolvedValue(null),
    resolveReusableCommerceOwnPreapprovalCheckout: vi.fn().mockResolvedValue(null),
    resolveReusablePartnerCheckout: vi.fn().mockResolvedValue(null),
    resolveReusablePartnerOwnPreapprovalCheckout: vi.fn().mockResolvedValue(null)
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
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(dbTxMock))
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
            currency: 'ARS'
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
            expect(body.providerPriceId).toBe('mp_plan_test');
            expectNoTrialAnywhere(body);
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
