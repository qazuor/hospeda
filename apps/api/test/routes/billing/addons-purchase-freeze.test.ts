/**
 * Add-on purchase × new-paid-signups freeze.
 *
 * `POST /protected/billing/addons/:slug/purchase` opens a new charge, so it is
 * one of the three self-service entry points an admin can pause through
 * `billing_settings.newPaidSignupsFrozen`. While frozen it must refuse with
 * `NEW_PAID_SIGNUPS_FROZEN` before `AddonService.purchase` — which writes the
 * purchase row and talks to MercadoPago — is ever reached.
 *
 * The route factory is replaced by an identity so the real handler is invoked
 * directly; the settings read is mocked at the settings-service layer so the
 * real gate runs.
 *
 * @module test/routes/billing/addons-purchase-freeze
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSettings, mockPurchase } = vi.hoisted(() => ({
    mockGetSettings: vi.fn(),
    mockPurchase: vi.fn()
}));

vi.mock('../../../src/services/billing-settings.service', () => ({
    getBillingSettingsService: () => ({ getSettings: mockGetSettings })
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn((config: unknown) => config)
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ use: vi.fn(), route: vi.fn() }))
}));

vi.mock('../../../src/middlewares/idempotency-key', () => ({
    idempotencyKeyMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => ({}))
}));

vi.mock('../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'user-1', email: 'host@hospeda.test' }))
}));

vi.mock('../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../../src/services/addon.service', () => ({
    AddonService: vi.fn(function AddonService() {
        return { purchase: mockPurchase };
    })
}));

vi.mock('../../../src/services/addon-recurring-charging', () => ({
    annotateRecurringCharging: vi.fn(),
    annotateRecurringChargingAll: vi.fn()
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    AuditEventType: { BILLING_MUTATION: 'BILLING_MUTATION' },
    auditLog: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/env', () => ({
    env: { HOSPEDA_SITE_URL: 'https://hospeda.test', HOSPEDA_API_URL: 'https://api.hospeda.test' }
}));

import { purchaseAddonRoute } from '../../../src/routes/billing/addons';

type PurchaseHandler = (
    c: unknown,
    params: Record<string, unknown>,
    body: Record<string, unknown>
) => Promise<unknown>;

const handler = (purchaseAddonRoute as unknown as { handler: PurchaseHandler }).handler;

/** Context double carrying only what the purchase handler reads. */
function createContext() {
    const store = new Map<string, unknown>([
        ['billingCustomerId', 'cust_1'],
        ['user', null]
    ]);
    return {
        get: vi.fn((key: string) => store.get(key)),
        req: { header: vi.fn(() => undefined) }
    };
}

describe('purchaseAddonRoute — new paid signups freeze', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPurchase.mockResolvedValue({
            success: true,
            data: { checkoutUrl: 'https://mp.test/addon', orderId: 'order-1' }
        });
    });

    it('refuses with NEW_PAID_SIGNUPS_FROZEN and never reaches AddonService.purchase', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });

        // Act
        const result = handler(createContext(), { slug: 'extra-photos' }, {});

        // Assert
        await expect(result).rejects.toMatchObject({
            code: ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN
        });
        expect(mockPurchase).not.toHaveBeenCalled();
    });

    it('purchases normally when signups are not frozen', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: false });

        // Act
        const result = await handler(createContext(), { slug: 'extra-photos' }, {});

        // Assert
        expect(mockPurchase).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ checkoutUrl: 'https://mp.test/addon' });
    });
});
