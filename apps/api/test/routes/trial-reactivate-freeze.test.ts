/**
 * Trial reactivation routes × new-paid-signups freeze (owner decision R).
 *
 * `POST /protected/billing/trial/reactivate` and
 * `POST /protected/billing/trial/reactivate-subscription` both open a NEW
 * MercadoPago checkout, so while `billing_settings.newPaidSignupsFrozen` is on
 * they refuse with `NEW_PAID_SIGNUPS_FROZEN` — after auth and input shape,
 * before `TrialService` (which reads the plan and calls MercadoPago) is reached.
 *
 * The settings read is mocked at the settings-service layer so the real gate runs.
 *
 * @module test/routes/trial-reactivate-freeze
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSettings, mockReactivateFromTrial, mockReactivateSubscription, handlerStore } =
    vi.hoisted(() => ({
        mockGetSettings: vi.fn(),
        mockReactivateFromTrial: vi.fn(),
        mockReactivateSubscription: vi.fn(),
        handlerStore: {
            handlers: [] as Array<{ path: string; handler: (c: unknown) => Promise<unknown> }>
        }
    }));

vi.mock('../../src/services/billing-settings.service', () => ({
    getBillingSettingsService: () => ({ getSettings: mockGetSettings })
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => ({ subscriptions: {} })),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ use: vi.fn(), route: vi.fn() }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn(
        (config: { path: string; handler: (c: unknown) => Promise<unknown> }) => {
            handlerStore.handlers.push({ path: config.path, handler: config.handler });
            return config.handler;
        }
    ),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn().mockImplementation(function TrialService() {
        return {
            reactivateFromTrial: mockReactivateFromTrial,
            reactivateSubscription: mockReactivateSubscription
        };
    })
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_API_DEBUG_ERRORS: false,
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test'
    }
}));

import '../../src/routes/billing/trial';

function handlerFor(path: string): (c: unknown) => Promise<unknown> {
    const entry = handlerStore.handlers.find((h) => h.path === path);
    if (!entry) {
        throw new Error(`handler for ${path} was not captured`);
    }
    return entry.handler;
}

function createContext() {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', 'cust_123']
    ]);
    return {
        get: vi.fn((key: string) => store.get(key)),
        req: { json: vi.fn().mockResolvedValue({ planId: 'plan_basic' }), header: vi.fn() }
    };
}

const CHECKOUT_RESULT = {
    success: true,
    subscriptionId: 'sub-new',
    previousPlanId: 'plan_old',
    checkoutUrl: 'https://mp.test/checkout',
    status: 'incomplete',
    message: 'ok'
};

describe('trial reactivation routes — new paid signups freeze', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockReactivateFromTrial.mockResolvedValue(CHECKOUT_RESULT);
        mockReactivateSubscription.mockResolvedValue(CHECKOUT_RESULT);
    });

    it('/reactivate refuses with NEW_PAID_SIGNUPS_FROZEN and never reaches TrialService', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });

        // Act
        const result = handlerFor('/reactivate')(createContext());

        // Assert
        await expect(result).rejects.toMatchObject({
            code: ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN
        });
        expect(mockReactivateFromTrial).not.toHaveBeenCalled();
    });

    it('/reactivate-subscription refuses with NEW_PAID_SIGNUPS_FROZEN and never reaches TrialService', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });

        // Act
        const result = handlerFor('/reactivate-subscription')(createContext());

        // Assert
        await expect(result).rejects.toMatchObject({
            code: ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN
        });
        expect(mockReactivateSubscription).not.toHaveBeenCalled();
    });

    it.each([
        ['/reactivate', mockReactivateFromTrial],
        ['/reactivate-subscription', mockReactivateSubscription]
    ])('%s proceeds normally when signups are not frozen', async (path, serviceMethod) => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: false });

        // Act
        const result = await handlerFor(path)(createContext());

        // Assert
        expect(result).toMatchObject({ checkoutUrl: 'https://mp.test/checkout' });
        expect(serviceMethod).toHaveBeenCalledTimes(1);
    });
});
