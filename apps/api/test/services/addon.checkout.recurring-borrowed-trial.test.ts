/**
 * HOS-847 regression — a recurring add-on's subscription row must be born with
 * NO trial.
 *
 * ## The defect, and why no existing test could see it
 *
 * The recurring add-on checkout borrows the customer's plan and price to
 * satisfy qzpay's `mode: 'paid'` plan+price requirement. The price it picks is
 * `active && billingInterval === 'month' && intervalCount === 1` — the exact
 * row data-migration `packages/seed/src/data-migrations/0055-owner-trial-30-days.ts`
 * set `billing_prices.trial_days = 30` on, by the same filter.
 *
 * qzpay-core then does this, in `packages/core/src/billing.ts`:
 *
 * ```ts
 * if (input.trialDays !== undefined) createInput.trialDays = input.trialDays;
 * else if (price?.trialDays != null) createInput.trialDays = price.trialDays;
 * ```
 *
 * and `@qazuor/qzpay-drizzle`'s subscription storage turns a non-zero
 * `trialDays` into `trial_start = now` / `trial_end = now + N days` on OUR row.
 * MercadoPago is told nothing: the preapproval is plan-based
 * (`preapproval_plan_id`, no `auto_recurring`), and the add-on's MP plan is
 * provisioned with `trialDays: 0`. So the lie is entirely local — HOS-522 in
 * reverse — and guard G-1 cannot catch it, because G-1 watches what we SEND
 * MercadoPago and this leak is inbound.
 *
 * Every OTHER test of this path mocks `createOwnPreapprovalSubscription` at its
 * module boundary, which puts qzpay-core's `else if` and the storage adapter's
 * trial arithmetic on the far side of the mock — they cannot observe the defect
 * even in principle. So this file drives the REAL
 * `createOwnPreapprovalSubscription` over a REAL `createQZPayBilling` and reads
 * what the storage adapter is asked to write. Both directions are executed: the
 * control (no `trialDays` passed) proves the fixture DOES reproduce the 30-day
 * inheritance, so the subject's green is not green for the wrong reason.
 *
 * @module test/services/addon.checkout.recurring-borrowed-trial
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

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const CUSTOMER_ID = 'cus_addon_trial';
const PLAN_ID = '00000000-0000-4000-8000-00000000plan';
const PRICE_ID = 'price_owner_monthly';
const MP_ADDON_PLAN_ID = '2c93808491e2fcbf0191ea1c9f1b0000';

/**
 * `billing_prices.trial_days` on the owner monthly price, as data-migration
 * 0055 left it in every seeded environment. This is the value the add-on row
 * would inherit.
 */
const OWNER_PRICE_TRIAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The row the storage adapter was asked to persist, as it would land in the DB. */
interface PersistedSubscriptionRow {
    readonly trialDays: number | undefined;
    readonly trialStart: Date | null;
    readonly trialEnd: Date | null;
    readonly status: string;
}

/**
 * In-memory subscription storage that reproduces the ONE derivation this test
 * is about, verbatim from `@qazuor/qzpay-drizzle`'s
 * `drizzle-storage.adapter.ts` (`createSubscriptionStorage().create`):
 *
 * ```ts
 * const hasTrial = input.trialDays !== undefined && input.trialDays > 0;
 * const trialEnd = hasTrial && input.trialDays
 *     ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000) : null;
 * const initialStatus = input.mode === 'paid' ? 'incomplete' : hasTrial ? 'trialing' : 'active';
 * ... trialStart: hasTrial ? now : null, trialEnd
 * ```
 *
 * Reproduced rather than imported because the real adapter needs a live
 * Postgres repo. What is NOT reproduced is qzpay-core's `else if` fallback —
 * that runs for real, in this test, and it is the line the defect lives on.
 */
function createStorage() {
    const persisted: PersistedSubscriptionRow[] = [];
    const rows = new Map<string, Record<string, unknown>>();

    const storage = {
        plans: {
            findById: async (id: string) =>
                id === PLAN_ID
                    ? { id: PLAN_ID, name: 'owner-premium', active: true, prices: [] }
                    : null
        },
        prices: {
            findByPlanId: async (planId: string) =>
                planId === PLAN_ID
                    ? [
                          {
                              id: PRICE_ID,
                              planId: PLAN_ID,
                              unitAmount: 1_800_000,
                              currency: 'ARS',
                              billingInterval: 'month',
                              intervalCount: 1,
                              active: true,
                              // The whole point: this is what a borrowed price
                              // silently contributes.
                              trialDays: OWNER_PRICE_TRIAL_DAYS,
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
                const trialDays = input.trialDays as number | undefined;
                const hasTrial = trialDays !== undefined && trialDays > 0;
                const trialEnd =
                    hasTrial && trialDays ? new Date(now.getTime() + trialDays * DAY_MS) : null;
                const status =
                    input.mode === 'paid' ? 'incomplete' : hasTrial ? 'trialing' : 'active';

                persisted.push({
                    trialDays,
                    trialStart: hasTrial ? now : null,
                    trialEnd,
                    status
                });

                const row = {
                    id: String(input.id),
                    customerId: String(input.customerId),
                    planId: String(input.planId),
                    status,
                    trialStart: hasTrial ? now : null,
                    trialEnd,
                    currentPeriodStart: now,
                    currentPeriodEnd: new Date(now.getTime() + 30 * DAY_MS),
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
    };

    return { persisted, storage: storage as unknown as QZPayStorageAdapter };
}

/** A payment adapter that returns a preapproval, like MercadoPago does. */
function createPaymentAdapter(): QZPayPaymentAdapter {
    return {
        provider: 'mercadopago',
        subscriptions: {
            create: vi.fn().mockResolvedValue({
                id: 'preapproval_addon_001',
                initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=x'
            }),
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    } as unknown as QZPayPaymentAdapter;
}

/** A Drizzle-shaped client that swallows the status-normalize UPDATE. */
function createDbStub() {
    return {
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) }))
    } as never;
}

function buildBilling(): { billing: QZPayBilling; persisted: PersistedSubscriptionRow[] } {
    const { persisted, storage } = createStorage();
    const billing = createQZPayBilling({
        storage,
        paymentAdapter: createPaymentAdapter(),
        defaultCurrency: 'ARS',
        livemode: false,
        providerSyncErrorStrategy: 'throw',
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }) as QZPayBilling;

    return { billing, persisted };
}

/** The exact call the recurring add-on checkout makes, minus `trialDays`. */
function addonPreapprovalInput(billing: QZPayBilling) {
    return {
        billing,
        customerId: CUSTOMER_ID,
        planId: PLAN_ID,
        priceId: PRICE_ID,
        billingInterval: 'monthly' as const,
        paymentMethodReturnUrl: 'https://hospeda.test/es/mi-cuenta/addons/',
        notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago',
        providerPriceId: MP_ADDON_PLAN_ID,
        productDomain: 'addon',
        metadata: { type: 'addon_purchase', addonSlug: 'extra-photos-20' },
        db: createDbStub()
    };
}

describe("HOS-847 — the add-on row does not inherit the borrowed price's trial", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('CONTROL: omitting trialDays writes a 30-day trial nobody asked MercadoPago for', async () => {
        // Arrange
        const { billing, persisted } = buildBilling();

        // Act — the pre-fix call shape.
        //
        // HOS-1221 D3 made `trialDays` REQUIRED on this input precisely so that
        // shape can no longer be written by accident: the four plan checkouts
        // and the retry recovery had all omitted it and were minting the same
        // phantom trial this suite documents for the add-on. The cast is what
        // lets the control still reproduce the pre-fix call — it is the ONLY
        // place in the repo that may do it, and it is a negative control, not a
        // call path.
        await createOwnPreapprovalSubscription(
            addonPreapprovalInput(billing) as unknown as CreateOwnPreapprovalSubscriptionInput
        );

        // Assert — this is the defect, reproduced. Without this control a green
        // subject below could mean the fixture simply never writes a trial.
        expect(persisted).toHaveLength(1);
        expect(persisted[0]?.trialDays).toBe(OWNER_PRICE_TRIAL_DAYS);
        expect(persisted[0]?.trialStart).not.toBeNull();
        expect(persisted[0]?.trialEnd).not.toBeNull();
    });

    it('states trialDays: 0, so the row is born with no trial_start and no trial_end', async () => {
        // Arrange
        const { billing, persisted } = buildBilling();

        // Act — the shipped call shape.
        await createOwnPreapprovalSubscription({
            ...addonPreapprovalInput(billing),
            trialDays: RECURRING_ADDON_LOCAL_TRIAL_DAYS
        });

        // Assert
        expect(persisted).toHaveLength(1);
        expect(persisted[0]?.trialDays).toBe(0);
        expect(persisted[0]?.trialStart).toBeNull();
        expect(persisted[0]?.trialEnd).toBeNull();
        // `mode: 'paid'` still wins the initial status — the benefit is granted
        // by the webhook, never at checkout.
        expect(persisted[0]?.status).toBe('incomplete');
    });

    it('the constant the checkout passes is zero', () => {
        // A trial length is a number the next person can "just bump". Freezing
        // the value here makes that a visible diff in a test, not a silent
        // change to a default three call frames away.
        expect(RECURRING_ADDON_LOCAL_TRIAL_DAYS).toBe(0);
    });
});
