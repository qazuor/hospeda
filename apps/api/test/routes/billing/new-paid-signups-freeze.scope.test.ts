/**
 * Scope of the new-paid-signups freeze — what it gates and what it must not.
 *
 * Owner decision O fixes the scope exactly: the freeze covers the three
 * self-service signup entry points and nothing else. Two halves are pinned:
 *
 * 1. Behaviour: an admin-initiated provisioning (`commerce/admin/start-subscription`)
 *    still opens its subscription with the freeze switched ON.
 * 2. Wiring: the three gated route files call the gate, and the exempt route
 *    files (admin provisioning, plan change, renewals/retries/cancel/pause,
 *    webhooks) never import it. A static check, because the failure it guards
 *    against — someone "helpfully" gating an exempt route, or a refactor
 *    dropping the call from a gated one — compiles and type-checks cleanly.
 *
 * The behavioural freeze refusals of the gated routes live next to each route:
 * `start-paid-freeze.test.ts`, `commerce/protected/start-subscription.test.ts`
 * and `billing/addons-purchase-freeze.test.ts`.
 *
 * @module test/routes/billing/new-paid-signups-freeze.scope
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSettings, mockInitiateCommerceSubscription, mockGetByExternalId } = vi.hoisted(
    () => ({
        mockGetSettings: vi.fn(),
        mockInitiateCommerceSubscription: vi.fn(),
        mockGetByExternalId: vi.fn()
    })
);

vi.mock('../../../src/services/billing-settings.service', () => ({
    getBillingSettingsService: () => ({ getSettings: mockGetSettings })
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn((config: unknown) => config)
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => ({ customers: { getByExternalId: mockGetByExternalId } }))
}));

vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'admin-1', roles: ['ADMIN'], permissions: [] }))
}));

vi.mock('../../../src/services/commerce-plan-resolver', () => ({
    CommercePlanNotConfiguredError: class CommercePlanNotConfiguredError extends Error {},
    resolveCommercePlanSlug: vi.fn(() => 'gastronomy-basico')
}));

vi.mock('../../../src/services/subscription-checkout.service', () => ({
    initiateCommerceSubscription: mockInitiateCommerceSubscription,
    SubscriptionCheckoutError: class SubscriptionCheckoutError extends Error {}
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const getById = vi.fn(async () => ({ data: { ownerId: 'owner-1' } }));
    return {
        ...actual,
        GastronomyService: vi.fn(function GastronomyService() {
            return { getById };
        }),
        ExperienceService: vi.fn(function ExperienceService() {
            return { getById };
        })
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_ADMIN_URL: 'https://admin.hospeda.test'
    }
}));

import { adminStartCommerceSubscriptionRoute } from '../../../src/routes/commerce/admin/start-subscription';

type AdminHandler = (ctx: unknown, params: Record<string, unknown>) => Promise<unknown>;

describe('new paid signups freeze — admin provisioning is exempt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });
        mockGetByExternalId.mockResolvedValue({ id: 'cust_owner' });
        mockInitiateCommerceSubscription.mockResolvedValue({
            checkoutUrl: 'https://mp.test/admin-checkout',
            localSubscriptionId: 'sub-admin-1',
            expiresAt: new Date().toISOString()
        });
    });

    it('admin commerce start-subscription still provisions while signups are frozen', async () => {
        // Arrange
        const handler = (
            adminStartCommerceSubscriptionRoute as unknown as { handler: AdminHandler }
        ).handler;

        // Act
        const result = await handler(
            { get: vi.fn() },
            { entityType: 'gastronomy', entityId: '11111111-1111-4111-8111-111111111111' }
        );

        // Assert
        expect(result).toMatchObject({ localSubscriptionId: 'sub-admin-1' });
        expect(mockInitiateCommerceSubscription).toHaveBeenCalledTimes(1);
    });
});

/** Route files, relative to `apps/api/src/routes/`. */
const GATED_ROUTE_FILES = [
    'billing/start-paid.ts',
    'commerce/protected/start-subscription.ts',
    'billing/addons.ts'
] as const;

const EXEMPT_ROUTE_FILES = [
    'commerce/admin/start-subscription.ts',
    'partners/admin/send-link.ts',
    'partners/admin/manual-payment.ts',
    'billing/plan-change.ts',
    'commerce/protected/change-plan.ts',
    'billing/subscription-cancel.ts',
    'billing/subscription-pause.ts',
    'billing/replace-payment-method.ts',
    'billing/checkout-retry.ts',
    'webhooks/mercadopago/payment-logic.ts'
] as const;

const GATE_IMPORT = 'new-paid-signups-freeze';
const GATE_CALL = /\bawait assertNewPaidSignupsAllowed\(\{\s*entryPoint:/;

function readRoute(relativePath: string): string {
    return readFileSync(resolve(__dirname, '../../../src/routes', relativePath), 'utf8');
}

describe('new paid signups freeze — wiring', () => {
    it.each(GATED_ROUTE_FILES)('%s calls the freeze gate', (file) => {
        // Arrange
        const source = readRoute(file);

        // Act
        const callsGate = GATE_CALL.test(source);

        // Assert
        expect(source).toContain(GATE_IMPORT);
        expect(callsGate).toBe(true);
    });

    it.each(EXEMPT_ROUTE_FILES)('%s never imports the freeze gate', (file) => {
        // Arrange
        const source = readRoute(file);

        // Act
        const importsGate = source.includes(GATE_IMPORT);

        // Assert
        expect(importsGate).toBe(false);
    });
});
