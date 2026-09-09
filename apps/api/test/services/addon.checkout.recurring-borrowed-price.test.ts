/**
 * HOS-847 regression — a recurring add-on's preapproval must charge the
 * ADD-ON's price, never the borrowed plan's.
 *
 * ## The defect, and the near-miss fix that would have replaced it
 *
 * This checkout used to hand the add-on's own MercadoPago plan to the provider
 * as `providerPriceId`. That is MercadoPago's "subscription WITH an associated
 * plan" request, and MercadoPago rejects it with HTTP 400 `"Create subscription
 * - card_token_id is required"` — a self-serve checkout never tokenizes a card.
 * Every add-on checkout answered 500 with the flag on. It is HOS-1221's defect,
 * on the one path HOS-1221 could not fix by deletion.
 *
 * Deletion is exactly what would have been wrong here. The recurring add-on has
 * no `billing_plans` row of its own, so it BORROWS the customer's plan and price
 * purely to satisfy qzpay's `mode: 'paid'` plan+price requirement
 * (`resolveSubscriptionPlanReference`). While the plan id was being sent, the
 * adapter returned early and never read that borrowed row at all. Drop the plan
 * id alone and the adapter takes its OTHER branch, building the inline
 * `auto_recurring` out of the borrowed row — so an `extra-photos-20` buyer would
 * authorize a recurring charge at the OWNER PLAN's monthly price, every month,
 * forever. On the cheapest owner plan that is ARS 18.000 for a ARS 5.000 add-on;
 * on `owner-premium` it is ARS 65.000.
 *
 * The fix states the amount: `providerUnitAmountOverride = addon.priceArs`.
 * This file exists to make that impossible to remove silently — the failure it
 * guards against is a WRONG CHARGE that no type, no lint rule and no
 * type-checked payload shape can see, because both amounts are perfectly valid
 * numbers in the same field.
 *
 * ## Why the derivation is reproduced rather than driven
 *
 * The real `QZPayMercadoPagoSubscriptionAdapter.create` calls the MercadoPago
 * SDK over HTTP, and `buildCreateBody` is private. So the payment adapter here
 * reproduces that method's two decisions VERBATIM — the same technique, and for
 * the same reason, as `addon.checkout.recurring-borrowed-trial.test.ts`, which
 * reproduces the Drizzle storage adapter's trial arithmetic because the real one
 * needs a live Postgres.
 *
 * What is NOT reproduced is everything above the adapter boundary: qzpay-core's
 * own `providerUnitAmountOverride` / `planDisplayName` / `providerPriceId`
 * resolution runs FOR REAL here, over a real `createQZPayBilling` and the real
 * `createOwnPreapprovalSubscription`. That is where a dropped field would
 * actually go missing, and it is on the near side of the mock.
 *
 * ## What this file does NOT prove
 *
 * That MercadoPago accepts the request. Nothing in this repo can: the stub does
 * not model the 400, which is precisely why the plan-id defect survived with the
 * flag-on suite green. Only the PR 8 staging smoke against the real sandbox
 * proves that half.
 *
 * @module test/services/addon.checkout.recurring-borrowed-price
 */

import {
    createQZPayBilling,
    type QZPayBilling,
    type QZPayPaymentAdapter,
    type QZPayStorageAdapter
} from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RECURRING_ADDON_LOCAL_TRIAL_DAYS } from '../../src/services/addon.checkout.recurring-resolve';
import {
    type CreateOwnPreapprovalSubscriptionInput,
    createOwnPreapprovalSubscription
} from '../../src/services/billing/own-preapproval-subscription-create';
import { mockPlanDomainRead } from '../helpers/plan-domain-read.js';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const CUSTOMER_ID = 'cus_addon_price';
const PLAN_ID = '00000000-0000-4000-8000-0000000price';
const PRICE_ID = 'price_owner_monthly';
const MP_ADDON_PLAN_ID = '2c93808491e2fcbf0191ea1c9f1b0000';

/**
 * `billing_prices.unit_amount` on the borrowed owner monthly price, in centavos
 * — ARS 18.000, the `owner-basico` monthly price from `plans.config.ts`. This is
 * the WRONG number: the one a naive plan-id deletion would have charged.
 */
const BORROWED_PLAN_UNIT_AMOUNT = 1_800_000;

/**
 * `EXTRA_PHOTOS_ADDON.priceArs` from `addons.config.ts`, in centavos — ARS
 * 5.000/month. This is the number that must reach MercadoPago.
 */
const ADDON_UNIT_AMOUNT = 500_000;

/** The borrowed plan's `name`, which in this project is the machine slug. */
const BORROWED_PLAN_NAME = 'owner-basico';

/** `EXTRA_PHOTOS_ADDON.name` — what the buyer should read on MercadoPago. */
const ADDON_DISPLAY_NAME = 'Extra Photos Pack (+20 photos)';

/**
 * The MercadoPago preapproval body, as far as this test models it. Field names
 * are MercadoPago's, matching `PreApprovalCreateBody`.
 */
interface CapturedPreapprovalBody {
    reason: string;
    preapproval_plan_id?: string;
    auto_recurring?: {
        frequency: number;
        frequency_type: string;
        transaction_amount: number;
        currency_id: string;
    };
}

/**
 * A payment adapter reproducing `QZPayMercadoPagoSubscriptionAdapter`'s
 * `buildCreateBody`, verbatim on the two decisions this file is about
 * (`@qazuor/qzpay-mercadopago`, `adapters/subscription.adapter.ts`):
 *
 * ```ts
 * const reason = `${providerInput.plan.name} - ${intervalLabel}`;
 * const planId = providerInput.providerPriceId?.trim();
 * if (planId) { body.preapproval_plan_id = planId; return body; }   // early return
 * const unitAmount = providerInput.providerUnitAmountOverride !== undefined
 *     ? providerInput.providerUnitAmountOverride : providerInput.price.amount;
 * const planDisplayName = providerInput.planDisplayName?.trim();
 * if (planDisplayName) body.reason = `${planDisplayName} - ${intervalLabel}`;
 * body.auto_recurring = { ..., transaction_amount: unitAmount / 100, ... };
 * ```
 *
 * The early return is as load-bearing as the amount: it is why a body carrying a
 * plan id has NO `auto_recurring` at all, which is the shape MercadoPago 400s.
 */
function createPaymentAdapter(): {
    adapter: QZPayPaymentAdapter;
    captured: CapturedPreapprovalBody[];
} {
    const captured: CapturedPreapprovalBody[] = [];

    const adapter = {
        provider: 'mercadopago',
        subscriptions: {
            create: vi.fn(async (providerInput: Record<string, unknown>) => {
                const price = providerInput.price as {
                    amount: number;
                    currency: string;
                    interval: string;
                    intervalCount: number;
                };
                const plan = providerInput.plan as { name: string };
                const billingInterval =
                    (providerInput.input as { billingInterval?: string }).billingInterval ??
                    'monthly';
                const intervalLabel = billingInterval === 'annual' ? 'Anual' : 'Mensual';

                const body: CapturedPreapprovalBody = {
                    reason: `${plan.name} - ${intervalLabel}`
                };

                const planId = (providerInput.providerPriceId as string | undefined)?.trim();
                if (planId) {
                    // The plan-based branch: MercadoPago is handed a plan id and
                    // NO inline amount. This is the request that 400s.
                    body.preapproval_plan_id = planId;
                    captured.push(body);
                    return {
                        id: 'preapproval_addon_price_001',
                        initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?x=1'
                    };
                }

                const override = providerInput.providerUnitAmountOverride as number | undefined;
                // `!== undefined`, never truthiness — `0` is a valid override,
                // and a truthy test here would silently reintroduce the exact
                // class of bug this field exists to close.
                const unitAmount = override === undefined ? price.amount : override;

                const planDisplayName = (
                    providerInput.planDisplayName as string | undefined
                )?.trim();
                if (planDisplayName) {
                    body.reason = `${planDisplayName} - ${intervalLabel}`;
                }

                body.auto_recurring = {
                    frequency: price.interval === 'year' ? price.intervalCount * 12 : 1,
                    frequency_type: 'months',
                    // MercadoPago expects major units; qzpay carries centavos.
                    transaction_amount: unitAmount / 100,
                    currency_id: price.currency
                };

                captured.push(body);
                return {
                    id: 'preapproval_addon_price_001',
                    initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?x=1'
                };
            }),
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    } as unknown as QZPayPaymentAdapter;

    return { adapter, captured };
}

/** Minimal storage holding the BORROWED owner plan and its monthly price. */
function createStorage(): QZPayStorageAdapter {
    const rows = new Map<string, Record<string, unknown>>();

    return {
        plans: {
            findById: async (id: string) =>
                id === PLAN_ID
                    ? { id: PLAN_ID, name: BORROWED_PLAN_NAME, active: true, prices: [] }
                    : null
        },
        prices: {
            findByPlanId: async (planId: string) =>
                planId === PLAN_ID
                    ? [
                          {
                              id: PRICE_ID,
                              planId: PLAN_ID,
                              // The number that must NOT be charged.
                              unitAmount: BORROWED_PLAN_UNIT_AMOUNT,
                              currency: 'ARS',
                              billingInterval: 'month',
                              intervalCount: 1,
                              active: true,
                              trialDays: 30,
                              providerPriceIds: {}
                          }
                      ]
                    : []
        },
        customers: {
            findById: async (id: string) =>
                id === CUSTOMER_ID
                    ? {
                          id: CUSTOMER_ID,
                          email: 'host@hospeda.test',
                          name: 'Maria Rodriguez',
                          providerCustomerIds: {}
                      }
                    : null
        },
        subscriptions: {
            create: async (input: Record<string, unknown>) => {
                const now = new Date();
                const row = {
                    id: String(input.id),
                    customerId: String(input.customerId),
                    planId: String(input.planId),
                    status: 'incomplete',
                    trialStart: null,
                    trialEnd: null,
                    currentPeriodStart: now,
                    currentPeriodEnd: now,
                    providerSubscriptionIds: {},
                    metadata: (input.metadata as Record<string, unknown>) ?? {},
                    cancelAtPeriodEnd: false,
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null
                };
                rows.set(row.id, row);
                return row;
            },
            update: async (id: string, input: Record<string, unknown>) => {
                const next = { ...(rows.get(id) ?? {}), ...input };
                rows.set(id, next);
                return next;
            },
            delete: async (id: string) => {
                rows.delete(id);
            }
        }
    } as unknown as QZPayStorageAdapter;
}

/** Captures the `set()` payload of the status-normalize UPDATE. */
function createDbStub() {
    const updates: Array<Record<string, unknown>> = [];
    const client = {
        update: vi.fn(() => ({
            set: vi.fn((values: Record<string, unknown>) => {
                updates.push(values);
                return { where: vi.fn(async () => undefined) };
            })
        }))
    };
    return { client: client as never, updates };
}

function buildBilling(): {
    billing: QZPayBilling;
    captured: CapturedPreapprovalBody[];
} {
    const { adapter, captured } = createPaymentAdapter();
    const billing = createQZPayBilling({
        storage: createStorage(),
        paymentAdapter: adapter,
        defaultCurrency: 'ARS',
        livemode: false,
        providerSyncErrorStrategy: 'throw',
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }) as QZPayBilling;

    return { billing, captured };
}

/**
 * Everything the recurring add-on checkout passes EXCEPT the three fields the
 * variants below differ on, so each test states its own subject explicitly
 * rather than inheriting it.
 */
function baseInput(billing: QZPayBilling, db: never) {
    return {
        billing,
        customerId: CUSTOMER_ID,
        planId: PLAN_ID,
        priceId: PRICE_ID,
        billingInterval: 'monthly' as const,
        paymentMethodReturnUrl: 'https://hospeda.test/es/mi-cuenta/addons/',
        notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago',
        payerEmail: 'host@hospeda.test',
        trialDays: RECURRING_ADDON_LOCAL_TRIAL_DAYS,
        productDomain: 'addon',
        metadata: { type: 'addon_purchase', addonSlug: 'extra-photos-20' },
        db
    };
}

describe("HOS-847 — the recurring add-on preapproval charges the add-on's price", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // HOS-1233 T-032: the shared paid-create helper resolves the BORROWED
        // plan's product_domain before minting the preapproval, and fails
        // closed when it finds no plan. Armed after clearAllMocks.
        mockPlanDomainRead();
    });

    it('SUBJECT: charges the add-on price, not the borrowed plan price', async () => {
        // Arrange
        const { billing, captured } = buildBilling();
        const { client } = createDbStub();

        // Act — the shipped call shape.
        await createOwnPreapprovalSubscription({
            ...baseInput(billing, client),
            providerUnitAmountOverride: ADDON_UNIT_AMOUNT,
            planDisplayName: ADDON_DISPLAY_NAME,
            mpPreapprovalPlanId: MP_ADDON_PLAN_ID
        });

        // Assert — every field named explicitly. `expect.objectContaining` is
        // blind to a MISSING field, and a missing `auto_recurring` (or a missing
        // `transaction_amount` inside it) is one of the two failure modes this
        // file exists to catch.
        expect(captured).toHaveLength(1);
        const body = captured[0];

        // 1. No plan id reached the provider — so the adapter took the inline
        //    branch at all, rather than building the request MercadoPago 400s.
        expect(body?.preapproval_plan_id).toBeUndefined();

        // 2. The amount is the ADD-ON's, in major units (ARS 5.000)...
        expect(body?.auto_recurring?.transaction_amount).toBe(5_000);
        // ...and explicitly NOT the borrowed plan's ARS 18.000. Stated as its
        // own assertion because that is the charge a regression would produce,
        // and a reader should not have to convert centavos to see it.
        expect(body?.auto_recurring?.transaction_amount).not.toBe(BORROWED_PLAN_UNIT_AMOUNT / 100);

        // 3. Monthly, in ARS — both read verbatim from the borrowed price row,
        //    neither of which has an override available.
        expect(body?.auto_recurring?.frequency).toBe(1);
        expect(body?.auto_recurring?.frequency_type).toBe('months');
        expect(body?.auto_recurring?.currency_id).toBe('ARS');
    });

    it('SUBJECT: the buyer reads the add-on name, not the borrowed plan slug', async () => {
        // Arrange
        const { billing, captured } = buildBilling();
        const { client } = createDbStub();

        // Act
        await createOwnPreapprovalSubscription({
            ...baseInput(billing, client),
            providerUnitAmountOverride: ADDON_UNIT_AMOUNT,
            planDisplayName: ADDON_DISPLAY_NAME,
            mpPreapprovalPlanId: MP_ADDON_PLAN_ID
        });

        // Assert
        expect(captured[0]?.reason).toBe(`${ADDON_DISPLAY_NAME} - Mensual`);
        expect(captured[0]?.reason).not.toContain(BORROWED_PLAN_NAME);
    });

    it('CONTROL: without the override the BORROWED plan price is what gets charged', async () => {
        // This is the control that matters. It is the shape a "just delete the
        // `providerPriceId` line" fix would produce: no plan id, no override.
        // It must stay RED-worthy — if this ever stops charging 18.000, the
        // subject above is green for a reason unrelated to the override.

        // Arrange
        const { billing, captured } = buildBilling();
        const { client } = createDbStub();

        // Act
        await createOwnPreapprovalSubscription({
            ...baseInput(billing, client),
            mpPreapprovalPlanId: MP_ADDON_PLAN_ID
        });

        // Assert — the defect, reproduced: ARS 18.000/month for a ARS 5.000
        // add-on, on a request MercadoPago accepts perfectly happily.
        expect(captured[0]?.preapproval_plan_id).toBeUndefined();
        expect(captured[0]?.auto_recurring?.transaction_amount).toBe(
            BORROWED_PLAN_UNIT_AMOUNT / 100
        );
        // And the buyer would be asked to authorize the borrowed plan by name.
        expect(captured[0]?.reason).toBe(`${BORROWED_PLAN_NAME} - Mensual`);
    });

    it('CONTROL: sending the plan id builds the body MercadoPago rejects', async () => {
        // The pre-fix shape. `providerPriceId` is banned from this path by guard
        // G-2 (`scripts/check-no-plan-id-to-own-preapproval.sh`), which is a
        // static scan of production source and cannot see a test file — so the
        // behavioural half of that ban lives here.

        // Arrange
        const { billing, captured } = buildBilling();
        const { client } = createDbStub();

        // Act
        await createOwnPreapprovalSubscription({
            ...baseInput(billing, client),
            providerPriceId: MP_ADDON_PLAN_ID
        } as unknown as CreateOwnPreapprovalSubscriptionInput);

        // Assert — a plan id and NO inline amount. MercadoPago answers this with
        // HTTP 400 "Create subscription - card_token_id is required"; the stub
        // does not model that, which is exactly why the flag-on suite stayed
        // green while all five checkouts returned 500 in reality.
        expect(captured[0]?.preapproval_plan_id).toBe(MP_ADDON_PLAN_ID);
        expect(captured[0]?.auto_recurring).toBeUndefined();
    });

    it('the plan id is still RECORDED on the row, just never sent', async () => {
        // Dropping the plan from the request must not drop it from the metadata:
        // `decideRecurringAddonReuse` compares it against the current attempt's
        // to refuse a checkout whose catalog price has since drifted. Losing it
        // would silently disable that price-drift check rather than break it.

        // Arrange
        const { billing } = buildBilling();
        const { client, updates } = createDbStub();

        // Act
        await createOwnPreapprovalSubscription({
            ...baseInput(billing, client),
            providerUnitAmountOverride: ADDON_UNIT_AMOUNT,
            planDisplayName: ADDON_DISPLAY_NAME,
            mpPreapprovalPlanId: MP_ADDON_PLAN_ID
        });

        // Assert
        expect(updates).toHaveLength(1);
        const metadata = updates[0]?.metadata as Record<string, unknown> | undefined;
        expect(metadata?.mpPreapprovalPlanId).toBe(MP_ADDON_PLAN_ID);
    });
});
