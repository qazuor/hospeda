/**
 * @fileoverview Typed mock factories for QZPay billing objects
 *
 * ==============================================================================
 * WARNING: TEST-ONLY FILE - DO NOT USE IN PRODUCTION CODE
 * ==============================================================================
 *
 * Provides factory functions that create properly-typed mock objects for
 * QZPay billing types used across API test files. Eliminates partial mock
 * type errors and centralizes test data creation.
 *
 * @module test/helpers/mock-factories
 */

import type {
    QZPayBilling,
    QZPayCustomer,
    QZPayPaginatedResult,
    QZPayPlan,
    QZPayPrice,
    QZPayPromoCode,
    QZPaySubscription,
    QZPaySubscriptionWithHelpers
} from '@qazuor/qzpay-core';
import { vi } from 'vitest';

// ============================================================================
// Plan Factories
// ============================================================================

/**
 * Creates a fully-typed mock QZPayPlan
 */
export function createMockPlan(overrides?: Partial<QZPayPlan>): QZPayPlan {
    return {
        id: 'plan_test',
        name: 'Test Plan',
        description: 'A test plan for unit tests',
        active: true,
        prices: [],
        features: [],
        entitlements: [],
        limits: {},
        metadata: {},
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
        ...overrides
    };
}

/**
 * Creates a mock QZPayPrice
 */
export function createMockPrice(overrides?: Partial<QZPayPrice>): QZPayPrice {
    return {
        id: 'price_test',
        planId: 'plan_test',
        nickname: null,
        currency: 'ARS',
        unitAmount: 15000,
        billingInterval: 'month',
        intervalCount: 1,
        trialDays: null,
        active: true,
        providerPriceIds: {},
        metadata: {},
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        ...overrides
    };
}

// ============================================================================
// Subscription Factories
// ============================================================================

/**
 * Creates a base QZPaySubscription (without helper methods)
 */
export function createMockSubscription(overrides?: Partial<QZPaySubscription>): QZPaySubscription {
    const now = new Date('2025-01-01');
    const periodEnd = new Date('2025-02-01');

    return {
        id: 'sub_test',
        customerId: 'cust_test',
        planId: 'plan_test',
        status: 'active',
        interval: 'month',
        intervalCount: 1,
        quantity: 1,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: null,
        trialEnd: null,
        cancelAt: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
        providerSubscriptionIds: {},
        promoCodeId: null,
        metadata: {},
        livemode: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...overrides
    };
}

/**
 * Creates a QZPaySubscriptionWithHelpers with all 20+ helper methods
 */
export function createMockSubscriptionWithHelpers(
    overrides?: Partial<QZPaySubscription>
): QZPaySubscriptionWithHelpers {
    const sub = createMockSubscription(overrides);
    const status = sub.status;

    return {
        ...sub,
        hasAccess: () => status === 'active' || status === 'trialing',
        isActive: () => status === 'active',
        isTrial: () => status === 'trialing',
        isPastDue: () => status === 'past_due',
        isCanceled: () => status === 'canceled',
        isPaused: () => status === 'paused',
        isInGracePeriod: () => false,
        willCancel: () => sub.cancelAtPeriodEnd,
        daysUntilRenewal: () => 30,
        daysUntilTrialEnd: () => null,
        daysRemaining: () => 30,
        daysRemainingInGrace: () => null,
        hasPaymentMethod: () => false,
        getEntitlements: () => [],
        getLimits: () => [],
        setEntitlements: () => {},
        setLimits: () => {},
        toPlainObject: () => sub
    } as QZPaySubscriptionWithHelpers;
}

// ============================================================================
// Customer Factories
// ============================================================================

/**
 * Creates a fully-typed mock QZPayCustomer
 */
export function createMockCustomer(overrides?: Partial<QZPayCustomer>): QZPayCustomer {
    return {
        id: 'cust_test',
        externalId: 'ext_test',
        email: 'test@example.com',
        name: 'Test Customer',
        phone: null,
        providerCustomerIds: {},
        metadata: {},
        livemode: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
        ...overrides
    };
}

// ============================================================================
// Promo Code Factories
// ============================================================================

/**
 * Creates a fully-typed mock QZPayPromoCode
 */
export function createMockPromoCode(overrides?: Partial<QZPayPromoCode>): QZPayPromoCode {
    return {
        id: 'promo_test',
        code: 'TEST20',
        discountType: 'percentage',
        discountValue: 20,
        currency: null,
        stackingMode: 'none',
        conditions: [],
        maxRedemptions: null,
        currentRedemptions: 0,
        maxRedemptionsPerCustomer: null,
        validFrom: null,
        validUntil: null,
        applicablePlanIds: [],
        applicableProductIds: [],
        active: true,
        metadata: {},
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
        ...overrides
    };
}

// ============================================================================
// Paginated Result Factory
// ============================================================================

/**
 * Creates a typed QZPayPaginatedResult wrapping data items
 */
export function createMockPaginatedResult<T>(
    data: T[],
    overrides?: Partial<Omit<QZPayPaginatedResult<T>, 'data'>>
): QZPayPaginatedResult<T> {
    return {
        data,
        total: data.length,
        limit: 100,
        offset: 0,
        hasMore: false,
        ...overrides
    };
}

// ============================================================================
// Billing Service Mock Factory
// ============================================================================

/**
 * Creates a mock QZPayBilling object with all service stubs.
 * All methods are vi.fn() stubs that can be configured per test.
 */
export function createMockBilling(): QZPayBilling {
    return {
        customers: {
            get: vi.fn(),
            getByExternalId: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            list: vi.fn()
        },
        subscriptions: {
            get: vi.fn(),
            getByCustomerId: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn(),
            list: vi.fn()
        },
        payments: {
            get: vi.fn(),
            getBySubscriptionId: vi.fn(),
            create: vi.fn(),
            list: vi.fn()
        },
        invoices: {
            get: vi.fn(),
            getBySubscriptionId: vi.fn(),
            create: vi.fn(),
            list: vi.fn()
        },
        plans: {
            get: vi.fn(),
            getActive: vi.fn(),
            getPrices: vi.fn(),
            list: vi.fn()
        },
        promoCodes: {
            get: vi.fn(),
            getByCode: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            list: vi.fn(),
            validate: vi.fn(),
            redeem: vi.fn()
        },
        entitlements: {
            getByCustomerId: vi.fn(),
            grant: vi.fn(),
            revoke: vi.fn(),
            check: vi.fn()
        },
        limits: {
            getByCustomerId: vi.fn(),
            set: vi.fn(),
            increment: vi.fn(),
            check: vi.fn()
        },
        metrics: {
            getMRR: vi.fn(),
            getChurnRate: vi.fn(),
            getActiveSubscriptions: vi.fn()
        },
        addons: {
            get: vi.fn(),
            list: vi.fn(),
            purchase: vi.fn()
        },
        paymentMethods: {
            get: vi.fn(),
            list: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        },
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        getPlans: vi.fn(),
        getPlan: vi.fn(),
        isLivemode: vi.fn().mockReturnValue(false),
        getStorage: vi.fn(),
        getPaymentAdapter: vi.fn(),
        getLogger: vi.fn()
    } as unknown as QZPayBilling;
}
