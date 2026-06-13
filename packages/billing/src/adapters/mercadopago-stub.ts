/**
 * Deterministic in-memory MercadoPago payment-adapter stub (SPEC-217).
 *
 * Provides a network-free replacement for the real
 * {@link createMercadoPagoAdapter} factory, used ONLY when the test-control
 * gate (`HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true`) is active.
 *
 * ## Why this exists
 *
 * SPEC-217 enabled the test-control gate in CI and fixed a Zod bug so the
 * accommodation-publish flow now genuinely runs `startTrial`. That flow drives
 * `billing.customers.create`, which qzpay-core resolves by calling
 * `paymentAdapter.customers.create(...)` — a real MercadoPago network call.
 * In CI the access token is a dummy (`APP_USR-0000...`), so the real adapter
 * either rejects at construction (token format) or 503s on the network call
 * ("Create customer - invalid access token"). The happy-path E2E spec
 * (host-01) then fails.
 *
 * This stub makes the happy path deterministic and offline: `customers.create`
 * returns a stable synthetic provider id with no network, so qzpay-core can
 * persist the provider customer id and the storage adapter writes a real
 * `trialing` `billing_subscriptions` row.
 *
 * ## What qzpay-core actually invokes on the trial/publish path
 *
 * Verified against `@qazuor/qzpay-core@1.12.0` (`dist/index.js`):
 *
 * - `billing.customers.create(...)` → ALWAYS calls
 *   `paymentAdapter.customers.create(providerInput)` and stores the returned
 *   string as `customer.providerCustomerIds[provider]`. The returned value
 *   MUST be a non-empty string (and with `providerSyncErrorStrategy: 'throw'`
 *   the call must succeed). This is the load-bearing method for host-01.
 * - `billing.subscriptions.create({ trialDays })` for a TRIAL does NOT touch
 *   the payment adapter — the provider-subscription branch is gated behind
 *   `input.mode === 'paid'`. The `trialing` status is computed by the storage
 *   adapter from `trialDays`. So `subscriptions.create` here is never hit by
 *   the trial flow, but it is still implemented deterministically to satisfy
 *   the {@link QZPayPaymentAdapter} interface and any non-trial code path.
 *
 * ## Relationship to fault injection
 *
 * {@link applyTestControl} (qzpay-test-control.ts) injects failures at the
 * call site (e.g. inside `startTrial`) BEFORE the adapter is reached, so the
 * fault-injection specs (host-07c, res-01) are unaffected by which adapter is
 * wired underneath. This stub only changes the success path.
 *
 * In-memory state is per-process and is intentionally NOT reset between calls;
 * each E2E run is a fresh process, so cross-test leakage is not a concern here.
 *
 * @module billing/adapters/mercadopago-stub
 */

import type {
    QZPayPaymentAdapter,
    QZPayProviderCheckout,
    QZPayProviderCreateCheckoutInput,
    QZPayProviderCreateCustomerInput,
    QZPayProviderCreateSubscriptionInput,
    QZPayProviderCustomer,
    QZPayProviderPayment,
    QZPayProviderPrice,
    QZPayProviderRefund,
    QZPayProviderSubscription,
    QZPayRefundInput,
    QZPayWebhookEvent
} from '@qazuor/qzpay-core';

/**
 * Monotonic counter feeding deterministic-per-process synthetic ids. Combined
 * with a timestamp so ids are unique even across re-imports within a run.
 */
let stubSequence = 0;

/**
 * Build a stable, collision-resistant synthetic provider id with the given
 * prefix (e.g. `stub_cus`, `stub_sub`). Deterministic enough for assertions
 * (predictable prefix) while unique per call (counter + timestamp).
 */
function nextStubId(prefix: string): string {
    stubSequence += 1;
    return `${prefix}_${Date.now().toString(36)}_${stubSequence}`;
}

/**
 * Compute a current-period window for a synthetic subscription: `start` now,
 * `end` 30 days later. Only used by the (non-trial) `subscriptions.*` stubs;
 * the trial flow never reads these because it does not call the adapter.
 */
function defaultPeriod(): { start: Date; end: Date } {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    return { start, end };
}

/**
 * Create a deterministic, in-memory MercadoPago payment adapter for use under
 * the test-control gate.
 *
 * The returned object satisfies the full {@link QZPayPaymentAdapter} interface
 * expected by `createQZPayBilling({ paymentAdapter })`. The trial-critical
 * `customers.create` returns a synthetic provider id with no network; the
 * remaining methods return safe deterministic values (or throw a clearly
 * labelled error for operations the trial/publish flow never reaches but which
 * cannot be meaningfully faked, e.g. refunds).
 *
 * @returns A {@link QZPayPaymentAdapter} backed entirely by in-memory state.
 *
 * @example
 * ```typescript
 * import { createStubMercadoPagoAdapter, isTestControlEnabled } from '@repo/billing';
 *
 * const paymentAdapter = isTestControlEnabled()
 *     ? createStubMercadoPagoAdapter()
 *     : createMercadoPagoAdapter({ logger });
 * ```
 */
export function createStubMercadoPagoAdapter(): QZPayPaymentAdapter {
    return {
        provider: 'mercadopago',

        customers: {
            /**
             * Returns a synthetic provider customer id (non-empty string), as
             * qzpay-core requires. This is the load-bearing method for the
             * trial/publish happy path.
             */
            create: async (_input: QZPayProviderCreateCustomerInput): Promise<string> =>
                nextStubId('stub_cus'),
            update: async (
                _providerCustomerId: string,
                _input: Partial<QZPayProviderCreateCustomerInput>
            ): Promise<void> => {
                // No-op: provider-side customer mutations are irrelevant to the
                // in-memory stub. The local storage row is the source of truth.
            },
            delete: async (_providerCustomerId: string): Promise<void> => {
                // No-op: nothing to delete provider-side.
            },
            retrieve: async (providerCustomerId: string): Promise<QZPayProviderCustomer> => ({
                id: providerCustomerId,
                email: 'stub@test.local',
                name: null,
                metadata: {}
            })
        },

        subscriptions: {
            /**
             * Synthesize a provider subscription. NOTE: the trial flow never
             * reaches this (qzpay-core gates the adapter call behind
             * `mode === 'paid'`); it exists for paid/non-trial paths and to
             * satisfy the interface. Returns a deterministic `initPoint` so any
             * paid path under the gate gets a usable redirect url.
             */
            create: async (
                _input: QZPayProviderCreateSubscriptionInput
            ): Promise<QZPayProviderSubscription> => {
                const id = nextStubId('stub_sub');
                const { start, end } = defaultPeriod();
                return {
                    id,
                    status: 'pending',
                    currentPeriodStart: start,
                    currentPeriodEnd: end,
                    cancelAtPeriodEnd: false,
                    canceledAt: null,
                    trialStart: null,
                    trialEnd: null,
                    metadata: {},
                    initPoint: `https://stub.test.local/preapproval/${id}`,
                    sandboxInitPoint: `https://stub.test.local/sandbox/preapproval/${id}`
                };
            },
            update: async (
                providerSubscriptionId: string,
                _input
            ): Promise<QZPayProviderSubscription> => {
                const { start, end } = defaultPeriod();
                return {
                    id: providerSubscriptionId,
                    status: 'active',
                    currentPeriodStart: start,
                    currentPeriodEnd: end,
                    cancelAtPeriodEnd: false,
                    canceledAt: null,
                    trialStart: null,
                    trialEnd: null,
                    metadata: {}
                };
            },
            cancel: async (
                _providerSubscriptionId: string,
                _cancelAtPeriodEnd: boolean
            ): Promise<void> => {
                // No-op: there is no provider-side preapproval to cancel for the
                // trial compensation path (trials never created one).
            },
            pause: async (_providerSubscriptionId: string): Promise<void> => {
                // No-op.
            },
            resume: async (_providerSubscriptionId: string): Promise<void> => {
                // No-op.
            },
            retrieve: async (
                providerSubscriptionId: string
            ): Promise<QZPayProviderSubscription> => {
                const { start, end } = defaultPeriod();
                return {
                    id: providerSubscriptionId,
                    status: 'active',
                    currentPeriodStart: start,
                    currentPeriodEnd: end,
                    cancelAtPeriodEnd: false,
                    canceledAt: null,
                    trialStart: null,
                    trialEnd: null,
                    metadata: {}
                };
            }
        },

        payments: {
            create: async (_providerCustomerId: string, input): Promise<QZPayProviderPayment> => ({
                id: nextStubId('stub_pay'),
                status: 'succeeded',
                amount: input.amount,
                currency: input.currency,
                metadata: {}
            }),
            capture: async (providerPaymentId: string): Promise<QZPayProviderPayment> => ({
                id: providerPaymentId,
                status: 'succeeded',
                amount: 0,
                currency: 'ARS',
                metadata: {}
            }),
            cancel: async (_providerPaymentId: string): Promise<void> => {
                // No-op.
            },
            refund: async (
                input: QZPayRefundInput,
                _providerPaymentId: string
            ): Promise<QZPayProviderRefund> => ({
                id: nextStubId('stub_ref'),
                status: 'succeeded',
                amount: input.amount ?? 0
            }),
            retrieve: async (providerPaymentId: string): Promise<QZPayProviderPayment> => ({
                id: providerPaymentId,
                status: 'succeeded',
                amount: 0,
                currency: 'ARS',
                metadata: {}
            }),
            search: async (): Promise<QZPayProviderPayment[]> => []
        },

        checkout: {
            create: async (
                _input: QZPayProviderCreateCheckoutInput
            ): Promise<QZPayProviderCheckout> => {
                const id = nextStubId('stub_chk');
                return {
                    id,
                    url: `https://stub.test.local/checkout/${id}`,
                    status: 'pending',
                    paymentIntentId: null,
                    subscriptionId: null,
                    customerId: null,
                    metadata: {}
                };
            },
            retrieve: async (providerSessionId: string): Promise<QZPayProviderCheckout> => ({
                id: providerSessionId,
                url: `https://stub.test.local/checkout/${providerSessionId}`,
                status: 'pending',
                paymentIntentId: null,
                subscriptionId: null,
                customerId: null,
                metadata: {}
            }),
            expire: async (_providerSessionId: string): Promise<void> => {
                // No-op.
            }
        },

        prices: {
            create: async (_input, _providerProductId: string): Promise<string> =>
                nextStubId('stub_price'),
            archive: async (_providerPriceId: string): Promise<void> => {
                // No-op.
            },
            retrieve: async (providerPriceId: string): Promise<QZPayProviderPrice> => ({
                id: providerPriceId,
                active: true,
                unitAmount: 0,
                currency: 'ARS',
                recurring: null
            }),
            createProduct: async (_name: string, _description?: string): Promise<string> =>
                nextStubId('stub_prod')
        },

        webhooks: {
            /**
             * The stub never produces real signed events; constructing one is a
             * programming error in the offline path, so fail loud rather than
             * fabricate a misleading event.
             */
            constructEvent: (
                _payload: string | Buffer,
                _signature: string,
                _requestId?: string,
                _dataId?: string
            ): QZPayWebhookEvent => {
                throw new Error(
                    'mercadopago-stub: webhooks.constructEvent is not supported under the test-control stub'
                );
            },
            /**
             * No real signature to verify offline. Return `false` (reject)
             * rather than blindly accepting, matching a fail-closed posture.
             */
            verifySignature: (
                _payload: string | Buffer,
                _signature: string,
                _requestId?: string,
                _dataId?: string
            ): boolean => false
        }
    };
}
