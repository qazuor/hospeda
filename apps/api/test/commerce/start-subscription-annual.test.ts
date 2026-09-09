/**
 * HOS-1285 — the annual cadence of the commerce checkout, end to end from the
 * requested interval to the amount MercadoPago is asked to charge.
 *
 * Until this change `commerceVerticalTier` sealed `annualPriceArs: null` inside
 * itself, so all six gastronomy/experience tiers were monthly-only and the
 * checkout entry point was literally named
 * `initiateCommerceMonthlySubscription`. Two `presentacion/` landing pages had
 * been publishing a "Por año" row since 2026-09-05 regardless.
 *
 * ## What these cases are built to catch
 *
 * The failure that is NOT a crash: resolving the wrong `billing_prices` row. A
 * plan carries both cadences in one `plan.prices` array, so an annual request
 * served from the `'month'` row produces a perfectly valid checkout that
 * charges a tenth of the price, on a MercadoPago `preapproval_plan` keyed as
 * annual. Every assertion below therefore names an AMOUNT as well as an
 * interval, and the two verticals are exercised with tiers whose monthly and
 * annual figures cannot be confused for one another.
 *
 * The prices come from the real `@repo/billing` catalogue rather than from
 * literals invented here: this file's job is "the service resolves the tier's
 * OWN annual price", not "the owner picked these numbers" — that is pinned by
 * `packages/billing/test/commerce-vertical-plans.test.ts`. One literal
 * cross-check is kept anyway (see the last case) so a catalogue that silently
 * lost its annual prices cannot make this whole file vacuously green.
 *
 * MercadoPago is stubbed at the `billing` boundary and
 * `createPendingProviderSubscription` at its own; `buildPreapprovalPlanShareLink`
 * stays REAL. Same seams as `start-subscription.service.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mocks (declared BEFORE the import of the service under test).
// ──────────────────────────────────────────────────────────────────────────

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` unset — Path C, production's
// current behaviour. The own-preapproval branch's annual case lives in
// `start-subscription-own-preapproval-flag-on.test.ts`, where the flag is on.
vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_BILLING_POLLING_ENABLED: false }
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    resolveFreeTrialExtensionPromo: vi.fn(() => null),
    applyTestControl: vi.fn(async (_op: string, _args: unknown, realCall: () => Promise<unknown>) =>
        realCall()
    )
}));

vi.mock('../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        resolveCheckoutMpPlanId: vi.fn().mockResolvedValue('mp_plan_test'),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

const onConflictDoUpdate = vi.fn((_config: unknown) => Promise.resolve(undefined));
const insertValues = vi.fn((_values: unknown) => ({ onConflictDoUpdate }));
const updateWhere = vi.fn((_cond: unknown) => Promise.resolve(undefined));
const updateSet = vi.fn((_values: unknown) => ({ where: updateWhere }));

const txStub = {
    insert: vi.fn((_table: unknown) => ({ values: insertValues })),
    update: vi.fn((_table: unknown) => ({ set: updateSet }))
};

const NONCE = 'nonce-test';
const LOCAL_SUB_ID = '22222222-2222-4222-8222-222222222222';
const EXPIRES_AT = '2026-01-01T00:00:00.000Z';

const createPendingProviderSubscription = vi.fn(
    async (input: {
        writeDomainLinkRow?: (params: {
            tx: unknown;
            localSubscriptionId: string;
        }) => Promise<void>;
    }) => {
        await input.writeDomainLinkRow?.({ tx: txStub, localSubscriptionId: LOCAL_SUB_ID });
        return { localSubscriptionId: LOCAL_SUB_ID, nonce: NONCE, expiresAt: EXPIRES_AT };
    }
);

vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: (input: never) => createPendingProviderSubscription(input)
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
        execute: vi.fn().mockResolvedValue({ rows: [] })
    })),
    withTransaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(txStub)),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    and: vi.fn((...parts: unknown[]) => ({ op: 'and', parts })),
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    billingPendingCheckouts: { __table: 'billing_pending_checkouts' },
    entitySubscriptions: { entityType: 'entity_type', entityId: 'entity_id' },
    partnerSubscriptions: { partnerId: 'partner_id' }
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import {
    type CommerceVertical,
    EXPERIENCE_PREMIUM_PLAN,
    GASTRONOMY_PRO_PLAN,
    type PlanDefinition
} from '@repo/billing';
import { resolveCheckoutMpPlanId } from '../../src/services/billing/mp-plan-provisioning.service';
import { initiateCommerceSubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const MONTHLY_PRICE_ID = 'price_month';
const ANNUAL_PRICE_ID = 'price_year';
const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/comercios/checkout/success/',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

/**
 * A `billing.plans` stub for one REAL commerce tier, carrying the two price
 * rows `seedCommercePlan` writes for it.
 *
 * @param plan - The catalogue tier to mirror.
 * @param opts.withAnnual - Drop the `'year'` row, to exercise the refusal path.
 */
function createBillingMock(plan: PlanDefinition, opts: { withAnnual?: boolean } = {}) {
    const prices: Array<Record<string, unknown>> = [
        {
            id: MONTHLY_PRICE_ID,
            billingInterval: 'month',
            intervalCount: 1,
            active: true,
            unitAmount: plan.monthlyPriceArs,
            currency: 'ARS'
        }
    ];
    if (opts.withAnnual !== false) {
        prices.push({
            id: ANNUAL_PRICE_ID,
            billingInterval: 'year',
            intervalCount: 1,
            active: true,
            unitAmount: plan.annualPriceArs,
            currency: 'ARS'
        });
    }

    const billing = {
        plans: {
            listAll: vi.fn().mockResolvedValue([
                {
                    id: PLAN_ID,
                    name: plan.slug,
                    metadata: { displayName: plan.name },
                    prices
                }
            ])
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'owner@hospeda.test',
                name: 'Owner',
                livemode: false
            })
        },
        subscriptions: {
            create: vi.fn(),
            getByCustomerId: vi.fn().mockResolvedValue([])
        },
        getStorage: vi.fn(() => ({ subscriptionPollingJobs: undefined }))
    };
    // TYPE-WORKAROUND: the stub implements only the subset of QZPayBilling the
    // service touches.
    return billing as unknown as QZPayBilling;
}

/** The two tiers under test, one per vertical. */
const CASES: ReadonlyArray<{ vertical: CommerceVertical; plan: PlanDefinition }> = [
    { vertical: 'gastronomy', plan: GASTRONOMY_PRO_PLAN },
    { vertical: 'experience', plan: EXPERIENCE_PREMIUM_PLAN }
];

describe('initiateCommerceSubscription — the annual cadence (HOS-1285)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        onConflictDoUpdate.mockResolvedValue(undefined);
        insertValues.mockReturnValue({ onConflictDoUpdate });
        updateWhere.mockResolvedValue(undefined);
        updateSet.mockReturnValue({ where: updateWhere });
        txStub.insert.mockReturnValue({ values: insertValues });
        txStub.update.mockReturnValue({ set: updateSet });
        vi.mocked(resolveCheckoutMpPlanId).mockResolvedValue('mp_plan_test');
        createPendingProviderSubscription.mockImplementation(
            async (input: {
                writeDomainLinkRow?: (params: {
                    tx: unknown;
                    localSubscriptionId: string;
                }) => Promise<void>;
            }) => {
                await input.writeDomainLinkRow?.({ tx: txStub, localSubscriptionId: LOCAL_SUB_ID });
                return { localSubscriptionId: LOCAL_SUB_ID, nonce: NONCE, expiresAt: EXPIRES_AT };
            }
        );
    });

    for (const { vertical, plan } of CASES) {
        describe(`${vertical} (${plan.slug})`, () => {
            it('asks MercadoPago for the ANNUAL amount on an ANNUAL preapproval_plan', async () => {
                const billing = createBillingMock(plan);

                await initiateCommerceSubscription({
                    customerId: CUSTOMER_ID,
                    planSlug: plan.slug,
                    entityType: vertical,
                    entityId: ENTITY_ID,
                    billingInterval: 'annual',
                    billing,
                    urls: URLS
                });

                // The amount AND the cadence together. `billing_mp_plans` keys a
                // provider plan on both, so asserting only the interval would
                // stay green while the tier's monthly figure was charged once a
                // year, and asserting only the amount would stay green while a
                // year's price was charged every month.
                expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
                    expect.objectContaining({
                        amountCentavos: plan.annualPriceArs,
                        billingInterval: 'annual',
                        currency: 'ARS'
                    })
                );
            });

            it('records the ANNUAL price row and cadence on the pending subscription', async () => {
                const billing = createBillingMock(plan);

                await initiateCommerceSubscription({
                    customerId: CUSTOMER_ID,
                    planSlug: plan.slug,
                    entityType: vertical,
                    entityId: ENTITY_ID,
                    billingInterval: 'annual',
                    billing,
                    urls: URLS
                });

                // `priceId` is what the adapter later derives MercadoPago's real
                // frequency from (`billing_prices.billing_interval` via
                // `toMercadoPagoInterval`), so the local row pointing at the
                // MONTHLY row is a charge cadence, not just a label.
                expect(createPendingProviderSubscription).toHaveBeenCalledWith(
                    expect.objectContaining({
                        priceId: ANNUAL_PRICE_ID,
                        billingInterval: 'annual'
                    })
                );
            });

            it('still defaults to MONTHLY when no interval is requested', async () => {
                const billing = createBillingMock(plan);

                await initiateCommerceSubscription({
                    customerId: CUSTOMER_ID,
                    planSlug: plan.slug,
                    entityType: vertical,
                    entityId: ENTITY_ID,
                    billing,
                    urls: URLS
                });

                // Every caller that predates HOS-1285 sends no interval — the
                // web client's bodyless POST, the admin route, the existing
                // tests. A default that leaked to `'annual'` would charge each
                // of them ten months up front without changing one call site.
                expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
                    expect.objectContaining({
                        amountCentavos: plan.monthlyPriceArs,
                        billingInterval: 'monthly'
                    })
                );
                expect(createPendingProviderSubscription).toHaveBeenCalledWith(
                    expect.objectContaining({
                        priceId: MONTHLY_PRICE_ID,
                        billingInterval: 'monthly'
                    })
                );
            });

            it('refuses an annual request on a tier with no year price row', async () => {
                // The state every already-seeded environment is in until the
                // `0104` data-migration runs. It must be a named refusal (mapped
                // to a 4xx by `mapSubscriptionCheckoutErrorToHttp`), never a
                // fallback to the monthly row.
                const billing = createBillingMock(plan, { withAnnual: false });

                await expect(
                    initiateCommerceSubscription({
                        customerId: CUSTOMER_ID,
                        planSlug: plan.slug,
                        entityType: vertical,
                        entityId: ENTITY_ID,
                        billingInterval: 'annual',
                        billing,
                        urls: URLS
                    })
                ).rejects.toMatchObject({ code: 'NO_ANNUAL_PRICE' });

                expect(resolveCheckoutMpPlanId).not.toHaveBeenCalled();
                expect(createPendingProviderSubscription).not.toHaveBeenCalled();
            });
        });
    }

    it('charges the figures the landing pages publish, not a rederived multiple', async () => {
        // The one case with literals on both sides. Everything above compares
        // what the service resolved against the catalogue, which stays green if
        // the catalogue itself loses its annual prices — this is what does not.
        // $650.000/yr for gastronomy-pro and $500.000/yr for experience-premium
        // are the rows the two `presentacion/` pages have shown since
        // 2026-09-05.
        expect(GASTRONOMY_PRO_PLAN.annualPriceArs).toBe(65_000_000);
        expect(EXPERIENCE_PREMIUM_PLAN.annualPriceArs).toBe(50_000_000);

        const billing = createBillingMock(GASTRONOMY_PRO_PLAN);
        await initiateCommerceSubscription({
            customerId: CUSTOMER_ID,
            planSlug: GASTRONOMY_PRO_PLAN.slug,
            entityType: 'gastronomy',
            entityId: ENTITY_ID,
            billingInterval: 'annual',
            billing,
            urls: URLS
        });

        expect(resolveCheckoutMpPlanId).toHaveBeenCalledWith(
            expect.objectContaining({ amountCentavos: 65_000_000 })
        );
    });
});
