/**
 * QZPay provider response fixtures for E2E tests (SPEC-143 T-143-06 revised).
 *
 * Shapes mirror the QZPay-core adapter contract `QZPayProvider*` types from
 * `/home/qazuor/projects/PACKAGES/qzpay/packages/core/src/adapters/payment.adapter.ts`,
 * NOT MercadoPago raw API responses. Reason: the MP adapter receives raw MP
 * payloads internally and transforms them into QZPayProvider* shapes before
 * returning to qzpay-core. The stub adapter (see `./mp-stub`) sits ABOVE that
 * transformation — its return values are what qzpay-core sees, which are the
 * QZPayProvider* shapes.
 *
 * Use these fixtures to program the stub:
 *
 * ```ts
 * mpStub.config.setSuccess(
 *     'checkout.create',
 *     providerResponseFixtures.checkout({ id: 'chk_test_123' })
 * );
 * ```
 *
 * @module test/e2e/helpers/mp-responses
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Provider-shape types (mirror qzpay-core QZPayProvider* — DO NOT use raw MP shapes)
// ---------------------------------------------------------------------------

/**
 * Provider-side checkout session response (returned by `checkout.create/retrieve`).
 * Mirrors `QZPayProviderCheckout`.
 */
export interface ProviderCheckoutResponse {
    readonly id: string;
    readonly url: string;
    readonly status: string;
    readonly paymentIntentId: string | null;
    readonly subscriptionId: string | null;
    readonly customerId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Provider-side customer response (returned by `customers.retrieve`).
 * Mirrors `QZPayProviderCustomer`. Note: `customers.create` returns a string
 * (the provider id), not this object.
 */
export interface ProviderCustomerResponse {
    readonly id: string;
    readonly email: string;
    readonly name: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Provider-side payment response (returned by `payments.create/retrieve/capture`).
 * Mirrors `QZPayProviderPayment`.
 */
export interface ProviderPaymentResponse {
    readonly id: string;
    readonly status: string;
    readonly amount: number;
    readonly currency: string;
    readonly metadata: Readonly<Record<string, string>>;
    readonly clientSecret?: string;
    readonly nextAction?: {
        readonly type: string;
        readonly redirectUrl?: string;
    };
}

/**
 * Provider-side refund response (returned by `payments.refund`).
 * Mirrors `QZPayProviderRefund`.
 */
export interface ProviderRefundResponse {
    readonly id: string;
    readonly status: string;
    readonly amount: number;
}

/**
 * Provider-side subscription response (returned by
 * `subscriptions.create/retrieve/update`). Mirrors `QZPayProviderSubscription`.
 */
export interface ProviderSubscriptionResponse {
    readonly id: string;
    readonly status: string;
    readonly currentPeriodStart: Date;
    readonly currentPeriodEnd: Date;
    readonly cancelAtPeriodEnd: boolean;
    readonly canceledAt: Date | null;
    readonly trialStart: Date | null;
    readonly trialEnd: Date | null;
    readonly metadata: Readonly<Record<string, string>>;
    readonly initPoint?: string;
    readonly sandboxInitPoint?: string;
}

/**
 * Provider-side price response (returned by `prices.retrieve`).
 * Mirrors `QZPayProviderPrice`.
 */
export interface ProviderPriceResponse {
    readonly id: string;
    readonly active: boolean;
    readonly unitAmount: number;
    readonly currency: string;
    readonly recurring: {
        readonly interval: string;
        readonly intervalCount: number;
    } | null;
}

/**
 * Parsed webhook event (returned by `webhooks.constructEvent`).
 * Mirrors `QZPayWebhookEvent`.
 */
export interface ProviderWebhookEventResponse {
    readonly id: string;
    readonly type: string;
    readonly data: unknown;
    readonly created: Date;
}

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

interface CheckoutFixtureInput {
    readonly id?: string;
    readonly url?: string;
    readonly status?: string;
    readonly paymentIntentId?: string | null;
    readonly subscriptionId?: string | null;
    readonly customerId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}

interface CustomerFixtureInput {
    readonly id?: string;
    readonly email?: string;
    readonly name?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}

interface PaymentFixtureInput {
    readonly id?: string;
    readonly status?: string;
    readonly amount?: number;
    readonly currency?: string;
    readonly metadata?: Readonly<Record<string, string>>;
    readonly clientSecret?: string;
    readonly nextAction?: {
        readonly type: string;
        readonly redirectUrl?: string;
    };
}

interface RefundFixtureInput {
    readonly id?: string;
    readonly status?: string;
    readonly amount?: number;
}

interface SubscriptionFixtureInput {
    readonly id?: string;
    readonly status?: string;
    readonly currentPeriodStart?: Date;
    readonly currentPeriodEnd?: Date;
    readonly cancelAtPeriodEnd?: boolean;
    readonly canceledAt?: Date | null;
    readonly trialStart?: Date | null;
    readonly trialEnd?: Date | null;
    readonly metadata?: Readonly<Record<string, string>>;
    readonly initPoint?: string;
    readonly sandboxInitPoint?: string;
}

interface PriceFixtureInput {
    readonly id?: string;
    readonly active?: boolean;
    readonly unitAmount?: number;
    readonly currency?: string;
    readonly recurring?: {
        readonly interval: string;
        readonly intervalCount: number;
    } | null;
}

interface WebhookEventFixtureInput {
    readonly id?: string;
    readonly type?: string;
    readonly data?: unknown;
    readonly created?: Date;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Builders for stubbed QZPay provider responses. Each returns a typed object
 * suitable for `mpStub.config.setSuccess('<operation>', fixture)`.
 *
 * IMPORTANT: these are NOT raw MercadoPago API responses. They are the
 * post-transformation QZPayProvider* shapes that the real MP adapter
 * produces internally. Use them to stub the QZPay adapter contract, not
 * the MP HTTP API.
 */
export const providerResponseFixtures = {
    checkout(input: CheckoutFixtureInput = {}): ProviderCheckoutResponse {
        const id = input.id ?? `chk_test_${randomUUID()}`;
        return {
            id,
            url: input.url ?? `https://stub.example/checkout/${id}`,
            status: input.status ?? 'pending',
            paymentIntentId: input.paymentIntentId ?? null,
            subscriptionId: input.subscriptionId ?? null,
            customerId: input.customerId ?? null,
            metadata: input.metadata ?? {}
        };
    },
    customer(input: CustomerFixtureInput = {}): ProviderCustomerResponse {
        return {
            id: input.id ?? `cust_test_${randomUUID()}`,
            email: input.email ?? 'test-customer@example.com',
            name: input.name ?? 'Test Customer',
            metadata: input.metadata ?? {}
        };
    },
    payment(input: PaymentFixtureInput = {}): ProviderPaymentResponse {
        return {
            id: input.id ?? `pay_test_${randomUUID()}`,
            status: input.status ?? 'approved',
            amount: input.amount ?? 1000,
            currency: input.currency ?? 'ARS',
            metadata: input.metadata ?? {},
            ...(input.clientSecret !== undefined ? { clientSecret: input.clientSecret } : {}),
            ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {})
        };
    },
    refund(input: RefundFixtureInput = {}): ProviderRefundResponse {
        return {
            id: input.id ?? `ref_test_${randomUUID()}`,
            status: input.status ?? 'approved',
            amount: input.amount ?? 1000
        };
    },
    subscription(input: SubscriptionFixtureInput = {}): ProviderSubscriptionResponse {
        const now = new Date();
        const oneMonthLater = new Date(now);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        const id = input.id ?? `sub_test_${randomUUID()}`;
        return {
            id,
            status: input.status ?? 'authorized',
            currentPeriodStart: input.currentPeriodStart ?? now,
            currentPeriodEnd: input.currentPeriodEnd ?? oneMonthLater,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
            canceledAt: input.canceledAt ?? null,
            trialStart: input.trialStart ?? null,
            trialEnd: input.trialEnd ?? null,
            metadata: input.metadata ?? {},
            ...(input.initPoint !== undefined
                ? { initPoint: input.initPoint }
                : { initPoint: `https://stub.example/preapproval/${id}` }),
            ...(input.sandboxInitPoint !== undefined
                ? { sandboxInitPoint: input.sandboxInitPoint }
                : {})
        };
    },
    price(input: PriceFixtureInput = {}): ProviderPriceResponse {
        return {
            id: input.id ?? `price_test_${randomUUID()}`,
            active: input.active ?? true,
            unitAmount: input.unitAmount ?? 100_000,
            currency: input.currency ?? 'ARS',
            recurring:
                input.recurring !== undefined
                    ? input.recurring
                    : { interval: 'month', intervalCount: 1 }
        };
    },
    webhookEvent(input: WebhookEventFixtureInput = {}): ProviderWebhookEventResponse {
        return {
            id: input.id ?? `evt_test_${randomUUID()}`,
            type: input.type ?? 'payment.updated',
            data: input.data ?? {},
            created: input.created ?? new Date()
        };
    }
} as const;
