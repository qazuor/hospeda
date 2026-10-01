/**
 * Start-paid × new-paid-signups freeze.
 *
 * `POST /protected/billing/subscriptions/start-paid` is a self-service signup
 * entry point, so while an admin has `billing_settings.newPaidSignupsFrozen`
 * on it must refuse with `NEW_PAID_SIGNUPS_FROZEN` BEFORE any write or
 * MercadoPago call — including the billing-customer self-heal, which writes a
 * row and may create a MercadoPago customer.
 *
 * The settings read is mocked at the settings-service layer, not at the freeze
 * module, so the real gate runs and removing its call from the handler turns
 * these tests red.
 *
 * @module test/routes/start-paid-freeze
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSettings, mockEnsureCustomerExists, mockInitiateMonthly, mockInitiateAnnual } =
    vi.hoisted(() => ({
        mockGetSettings: vi.fn(),
        mockEnsureCustomerExists: vi.fn(),
        mockInitiateMonthly: vi.fn(),
        mockInitiateAnnual: vi.fn()
    }));

vi.mock('../../src/services/billing-settings.service', () => ({
    getBillingSettingsService: () => ({ getSettings: mockGetSettings })
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'user-1', email: 'host@hospeda.test', roles: [] }))
}));

vi.mock('../../src/middlewares/idempotency-key', () => ({
    idempotencyKeyMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/lib/sentry', () => ({ captureBillingError: vi.fn() }));

vi.mock('../../src/lib/posthog', () => ({
    captureServerAnalyticsEvent: vi.fn(),
    getPostHogClient: vi.fn(() => null)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ use: vi.fn(), route: vi.fn() }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test'
    }
}));

vi.mock('../../src/services/billing-customer-sync', () => ({
    BillingCustomerSyncService: vi.fn(function BillingCustomerSyncService() {
        return { ensureCustomerExists: mockEnsureCustomerExists };
    })
}));

vi.mock('../../src/services/subscription-checkout.service', () => ({
    initiatePaidMonthlySubscription: mockInitiateMonthly,
    initiatePaidAnnualSubscription: mockInitiateAnnual,
    SubscriptionCheckoutError: class SubscriptionCheckoutError extends Error {}
}));

import { getQZPayBilling } from '../../src/middlewares/billing';
import { handleStartPaidSubscription } from '../../src/routes/billing/start-paid';

const CUSTOMER_ID = 'cust_owner';

/** Hono-like context double carrying only what the handler reads. */
function createContext({ billingCustomerId }: { billingCustomerId: string | null }) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', billingCustomerId],
        ['user', null]
    ]);
    return {
        get: vi.fn((key: string) => store.get(key)),
        req: { header: vi.fn(() => undefined) }
    };
}

/** qzpay double whose every method is a spy, so "nothing was touched" is checkable. */
function createBilling() {
    return {
        plans: {
            listAll: vi.fn().mockResolvedValue([
                {
                    id: 'plan-1',
                    name: 'owner-basico',
                    active: true,
                    prices: [{ billingInterval: 'month', unitAmount: 1_000_000, currency: 'ARS' }]
                }
            ])
        },
        subscriptions: { getByCustomerId: vi.fn().mockResolvedValue([]) },
        customers: { get: vi.fn() }
    };
}

describe('handleStartPaidSubscription — new paid signups freeze', () => {
    let billing: ReturnType<typeof createBilling>;

    beforeEach(() => {
        vi.clearAllMocks();
        billing = createBilling();
        vi.mocked(getQZPayBilling).mockReturnValue(billing as never);
        mockEnsureCustomerExists.mockResolvedValue(CUSTOMER_ID);
        mockInitiateMonthly.mockResolvedValue({
            checkoutUrl: 'https://mp.test/checkout',
            localSubscriptionId: 'sub-1',
            expiresAt: new Date().toISOString()
        });
    });

    it('refuses with NEW_PAID_SIGNUPS_FROZEN and touches neither the DB nor MercadoPago', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });
        const ctx = createContext({ billingCustomerId: CUSTOMER_ID });

        // Act
        const result = handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-basico',
            billingInterval: 'monthly'
        });

        // Assert
        await expect(result).rejects.toMatchObject({
            code: ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN
        });
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(billing.plans.listAll).not.toHaveBeenCalled();
        expect(mockInitiateMonthly).not.toHaveBeenCalled();
        expect(mockInitiateAnnual).not.toHaveBeenCalled();
    });

    it('refuses before the billing-customer self-heal writes anything', async () => {
        // Arrange — no customer on session: the handler would normally create one
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });
        const ctx = createContext({ billingCustomerId: null });

        // Act
        const result = handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-basico',
            billingInterval: 'monthly'
        });

        // Assert
        await expect(result).rejects.toMatchObject({
            code: ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN
        });
        expect(mockEnsureCustomerExists).not.toHaveBeenCalled();
    });

    it('refuses an annual checkout carrying a trial-extension promo the same way', async () => {
        // Arrange — new trials ride on start-paid too (promo `trial_extension`)
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });
        const ctx = createContext({ billingCustomerId: CUSTOMER_ID });

        // Act
        const result = handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-basico',
            billingInterval: 'annual',
            promoCode: 'EXTRATRIAL'
        });

        // Assert
        await expect(result).rejects.toMatchObject({
            code: ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN
        });
        expect(mockInitiateAnnual).not.toHaveBeenCalled();
    });

    it('proceeds to the checkout when signups are not frozen', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: false });
        const ctx = createContext({ billingCustomerId: CUSTOMER_ID });

        // Act
        const result = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'owner-basico',
            billingInterval: 'monthly'
        });

        // Assert
        expect(result).toMatchObject({ localSubscriptionId: 'sub-1' });
        expect(mockInitiateMonthly).toHaveBeenCalledTimes(1);
    });
});
