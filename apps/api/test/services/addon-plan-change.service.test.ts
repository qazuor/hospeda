/**
 * Tests for handlePlanChangeAddonRecalculation — Flow B recalculation and
 * downgrade detection (SPEC-043 AC-3.1 through AC-4.4).
 *
 * AC-3.x: Limit recalculation correctness
 * - AC-3.1: Upgrade — limits.set called with base + addon increment
 * - AC-3.2: Multiple addons with the same limitKey — increments summed
 * - AC-3.3: Entitlement addon (affectsLimitKey: null) — excluded from processing
 * - AC-3.4: No limit addons present — early exit, no limits.set calls
 * - AC-3.5: New plan has unlimited (-1) for a limitKey — key skipped
 * - AC-3.6: limitKey absent from new plan's limits array — basePlanLimit=0,
 *           warning + Sentry.captureMessage
 *
 * AC-4.x: Downgrade detection and notification
 * - AC-4.1: Downgrade combined limit decreases — correct newMaxValue computed
 * - AC-4.2: No notification when currentUsage <= newMaxValue
 * - AC-4.3: Notification dispatch + Sentry.captureMessage when usage > newMaxValue
 * - AC-4.4: billing.limits.check() throws — warn log, skip key, continue
 *
 * Additional coverage:
 * - Direction detection: upgrade / downgrade / lateral
 * - New plan not found in config — error + Sentry + all recalculations failed
 * - Addon definition not found — purchase skipped, others processed normally
 * - Skipped keys (unlimited) excluded from downgrade check
 * - Customer lookup failure → email skipped, Sentry still fires
 * - Notification dispatch failure is non-blocking (fire-and-forget)
 * - Early exit when no active limit addons (downgrade step skipped entirely)
 *
 * @module test/services/addon-plan-change.service.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { NotificationType } from '@repo/notifications';
import { ADDON_RECALC_SOURCE_ID } from '@repo/service-core';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type PlanChangeRecalculationResult,
    handlePlanChangeAddonRecalculation
} from '../../src/services/addon-plan-change.service';
import { createMockBilling, createMockCustomer } from '../helpers/mock-factories';

// ─── Hoisted mock factories ──────────────────────────────────────────────────
//
// Must be hoisted so they are available when vi.mock factory functions run.

const {
    mockDbWhere,
    mockDbFrom: _mockDbFrom,
    mockDbSelect,
    mockBillingAddonPurchasesSchema,
    mockSendNotification,
    mockCaptureSentryMessage
} = vi.hoisted(() => {
    const mockDbWhere = vi.fn().mockResolvedValue([]);
    const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
    const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));

    const mockBillingAddonPurchasesSchema = {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    };

    const mockSendNotification = vi.fn().mockResolvedValue(undefined);
    const mockCaptureSentryMessage = vi.fn().mockReturnValue('');

    return {
        mockDbWhere,
        mockDbFrom,
        mockDbSelect,
        mockBillingAddonPurchasesSchema,
        mockSendNotification,
        mockCaptureSentryMessage
    };
});

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: (...args: unknown[]) => mockSendNotification(...args)
}));

vi.mock('@sentry/node', () => ({
    captureMessage: (...args: unknown[]) => mockCaptureSentryMessage(...args),
    captureException: vi.fn()
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: mockBillingAddonPurchasesSchema
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        getPlanBySlug: vi.fn(),
        getAddonBySlug: vi.fn()
    };
});

// drizzle helpers used by the service (eq, and, isNull) must not throw
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return { ...actual };
});

// ─── Dedup guard bypass ────────────────────────────────────────────────────────
//
// addon-plan-change.service keeps a process-local `recentRecalculations` Map that
// suppresses duplicate calls within a 5-minute window. Because the module is shared
// across all tests in this file, a successful call in one test would block every
// subsequent test that uses the same CUSTOMER_ID. We bypass the guard by advancing
// Date.now() by 10 minutes before each test, making the stored timestamp appear
// stale relative to the current simulated time.

let dateNowOffset = 0;
const DEDUP_BYPASS_OFFSET_MS = 10 * 60 * 1000; // 10 minutes — safely above the 5-minute window

beforeEach(() => {
    dateNowOffset += DEDUP_BYPASS_OFFSET_MS;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + dateNowOffset);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Constants & fixtures ─────────────────────────────────────────────────────

const OLD_PLAN_SLUG = 'owner-pro';
const NEW_PLAN_SLUG = 'owner-basico';
const LIMIT_KEY = 'max_active_accommodations';
const CUSTOMER_ID = 'cus_test_downgrade_001';

const UPGRADE_PLAN_SLUG = 'owner-premium';
const SECOND_LIMIT_KEY = 'max_featured_listings';

/** Old plan: base 10 for LIMIT_KEY, base 2 for SECOND_LIMIT_KEY */
const mockOldPlan = {
    slug: OLD_PLAN_SLUG,
    name: 'Owner Pro',
    description: 'Pro plan',
    monthlyPriceArs: 5000,
    annualPriceArs: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 2,
    features: [],
    limits: [
        { key: LIMIT_KEY, value: 10 },
        { key: SECOND_LIMIT_KEY, value: 2 }
    ],
    entitlements: []
};

/** New plan: base 3 for LIMIT_KEY (downgrade), base 2 for SECOND_LIMIT_KEY */
const mockNewPlan = {
    slug: NEW_PLAN_SLUG,
    name: 'Owner Basico',
    description: 'Basic plan',
    monthlyPriceArs: 2000,
    annualPriceArs: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1,
    features: [],
    limits: [
        { key: LIMIT_KEY, value: 3 },
        { key: SECOND_LIMIT_KEY, value: 2 }
    ],
    entitlements: []
};

/** Upgrade plan: base 50 for LIMIT_KEY (upgrade from old plan's 10) */
const mockUpgradePlan = {
    slug: UPGRADE_PLAN_SLUG,
    name: 'Owner Premium',
    description: 'Premium plan',
    monthlyPriceArs: 9000,
    annualPriceArs: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 3,
    features: [],
    limits: [{ key: LIMIT_KEY, value: 50 }],
    entitlements: []
};

/** Addon definition: adds +5 to LIMIT_KEY */
const mockAddonDef = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations (+5)',
    description: '+5 accommodations',
    billingType: 'recurring' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: LIMIT_KEY,
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

/** Addon definition: adds +15 to LIMIT_KEY (second addon for multi-addon tests) */
const mockAddonDef15 = {
    slug: 'extra-accommodations-15',
    name: 'Extra Accommodations (+15)',
    description: '+15 accommodations',
    billingType: 'recurring' as const,
    priceArs: 1200000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: LIMIT_KEY,
    limitIncrease: 15,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 2
};

/** Entitlement-type addon: affectsLimitKey is null */
const mockEntitlementAddonDef = {
    slug: 'verified-badge',
    name: 'Verified Badge',
    description: 'Grants verified status',
    billingType: 'recurring' as const,
    priceArs: 300000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'verified_owner',
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 3
};

/** One active purchase row with a +5 adjustment for LIMIT_KEY */
const activePurchaseRow = {
    id: 'purch_001',
    customerId: CUSTOMER_ID,
    addonSlug: 'extra-accommodations-5',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [{ limitKey: LIMIT_KEY, increase: 5 }],
    entitlementAdjustments: []
};

/** Second active purchase row with a +15 adjustment for LIMIT_KEY */
const activePurchaseRow15 = {
    id: 'purch_002',
    customerId: CUSTOMER_ID,
    addonSlug: 'extra-accommodations-15',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [{ limitKey: LIMIT_KEY, increase: 15 }],
    entitlementAdjustments: []
};

/** Active purchase for an entitlement-type addon (no limitAdjustments) */
const entitlementPurchaseRow = {
    id: 'purch_003',
    customerId: CUSTOMER_ID,
    addonSlug: 'verified-badge',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [],
    entitlementAdjustments: [{ entitlementKey: 'verified_owner', granted: true }]
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Configure the DB mock chain to return the given purchases array. */
function setupDbWithPurchases(purchases: unknown[]): {
    select: typeof mockDbSelect;
    execute: ReturnType<typeof vi.fn>;
} {
    mockDbWhere.mockResolvedValue(purchases);
    return {
        select: mockDbSelect,
        execute: vi.fn().mockResolvedValue(undefined)
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handlePlanChangeAddonRecalculation — downgrade detection (AC-4.1 to AC-4.4)', () => {
    let billing: QZPayBilling;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockSendNotification.mockResolvedValue(undefined);
        mockCaptureSentryMessage.mockReturnValue('');
        mockDbWhere.mockResolvedValue([]);

        // Default plan resolution
        const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === OLD_PLAN_SLUG) return mockOldPlan;
            if (slug === NEW_PLAN_SLUG) return mockNewPlan;
            if (slug === UPGRADE_PLAN_SLUG) return mockUpgradePlan;
            return null;
        });
        (getAddonBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === 'extra-accommodations-5') return mockAddonDef;
            if (slug === 'extra-accommodations-15') return mockAddonDef15;
            if (slug === 'verified-badge') return mockEntitlementAddonDef;
            return null;
        });

        billing = createMockBilling();
        (billing.limits.set as unknown as MockInstance).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── AC-4.2: No notification when usage <= newMaxValue ─────────────────────

    describe('AC-4.2: no notification when currentUsage <= newMaxValue', () => {
        it('should not dispatch notification when usage is below the new limit', async () => {
            // Arrange
            // Old plan: 10 base + 5 addon = 15 oldMaxValue
            // New plan: 3 base + 5 addon = 8 newMaxValue → downgrade detected
            // Current usage: 5 (within new limit of 8) → no notification
            const db = setupDbWithPurchases([activePurchaseRow]);
            (billing.limits.check as unknown as MockInstance).mockResolvedValue({
                currentValue: 5
            });
            (billing.customers.get as unknown as MockInstance).mockResolvedValue(
                createMockCustomer({ id: CUSTOMER_ID, email: 'owner@example.com' })
            );

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert
            expect(result.recalculations[0]?.outcome).toBe('success');
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(mockCaptureSentryMessage).not.toHaveBeenCalled();
        });

        it('should not dispatch notification when usage exactly equals the new limit', async () => {
            // Arrange — usage == newMaxValue (8 == 8): boundary condition
            const db = setupDbWithPurchases([activePurchaseRow]);
            (billing.limits.check as unknown as MockInstance).mockResolvedValue({
                currentValue: 8
            });
            (billing.customers.get as unknown as MockInstance).mockResolvedValue(
                createMockCustomer({ id: CUSTOMER_ID })
            );

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(mockCaptureSentryMessage).not.toHaveBeenCalled();
        });
    });

    // ── AC-4.3: notification + Sentry when usage > newMaxValue ───────────────

    describe('AC-4.3: dispatch notification and report to Sentry when currentUsage > newMaxValue', () => {
        it('should dispatch PLAN_DOWNGRADE_LIMIT_WARNING and call Sentry.captureMessage', async () => {
            // Arrange
            // newMaxValue = 3 + 5 = 8, oldMaxValue = 10 + 5 = 15
            // currentUsage = 12 > 8 → violation
            const db = setupDbWithPurchases([activePurchaseRow]);
            const customer = createMockCustomer({
                id: CUSTOMER_ID,
                email: 'owner@example.com',
                metadata: { name: 'Juan Perez', userId: 'user_abc' }
            });
            (billing.limits.check as unknown as MockInstance).mockResolvedValue({
                currentValue: 12
            });
            (billing.customers.get as unknown as MockInstance).mockResolvedValue(customer);

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — Sentry called with captureMessage (not captureException)
            expect(mockCaptureSentryMessage).toHaveBeenCalledOnce();
            expect(mockCaptureSentryMessage).toHaveBeenCalledWith(
                expect.stringContaining(CUSTOMER_ID),
                expect.objectContaining({
                    level: 'warning',
                    tags: expect.objectContaining({
                        subsystem: 'billing-addon-lifecycle',
                        action: 'plan_downgrade_limit_exceeded'
                    }),
                    extra: expect.objectContaining({
                        customerId: CUSTOMER_ID,
                        limitKey: LIMIT_KEY,
                        oldLimit: 15,
                        newLimit: 8,
                        currentUsage: 12
                    })
                })
            );

            // Assert — notification dispatched with correct payload
            expect(mockSendNotification).toHaveBeenCalledOnce();
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING,
                    recipientEmail: 'owner@example.com',
                    recipientName: 'Juan Perez',
                    userId: 'user_abc',
                    customerId: CUSTOMER_ID,
                    limitKey: LIMIT_KEY,
                    oldLimit: 15,
                    newLimit: 8,
                    currentUsage: 12,
                    planName: mockNewPlan.name
                })
            );
        });

        it('should fall back to email as recipientName when customer metadata.name is absent', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);
            (billing.limits.check as unknown as MockInstance).mockResolvedValue({
                currentValue: 10
            });
            (billing.customers.get as unknown as MockInstance).mockResolvedValue(
                createMockCustomer({
                    id: CUSTOMER_ID,
                    email: 'noname@example.com',
                    metadata: {}
                })
            );

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipientName: 'noname@example.com'
                })
            );
        });

        it('should complete successfully even when notification dispatch promise rejects', async () => {
            // Arrange — fire-and-forget: notification throws but the operation must not throw
            mockSendNotification.mockRejectedValueOnce(new Error('Email service unavailable'));

            const db = setupDbWithPurchases([activePurchaseRow]);
            (billing.limits.check as unknown as MockInstance).mockResolvedValue({
                currentValue: 12
            });
            (billing.customers.get as unknown as MockInstance).mockResolvedValue(
                createMockCustomer({ id: CUSTOMER_ID, email: 'owner@example.com' })
            );

            // Act — must not throw
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — the limit was applied and recalculation result is success
            expect(billing.limits.set).toHaveBeenCalledOnce();
            expect(result.recalculations[0]?.outcome).toBe('success');
        });
    });

    // ── AC-4.4: billing.limits.check() failure ────────────────────────────────

    describe('AC-4.4: billing.limits.check() failure handling', () => {
        it('should log warning, skip notification, and NOT report to Sentry when check throws', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);
            (billing.limits.check as unknown as MockInstance).mockRejectedValue(
                new Error('Redis connection timeout')
            );
            (billing.customers.get as unknown as MockInstance).mockResolvedValue(
                createMockCustomer({ id: CUSTOMER_ID })
            );

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — notification AND Sentry must not be called (AC-4.4)
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(mockCaptureSentryMessage).not.toHaveBeenCalled();
            // The recalculation itself still succeeded (limit was set)
            expect(result.recalculations[0]?.outcome).toBe('success');
            expect(billing.limits.set).toHaveBeenCalledOnce();
        });
    });

    // ── Skipped keys (unlimited) are excluded from downgrade check ────────────

    describe('skipped limitKeys (unlimited new plan) are not checked for downgrade', () => {
        it('should not call billing.limits.check when new plan has unlimited for limitKey', async () => {
            // Arrange — new plan unlimited for this key → outcome is 'skipped'
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
                if (slug === OLD_PLAN_SLUG) return mockOldPlan;
                if (slug === NEW_PLAN_SLUG) {
                    return { ...mockNewPlan, limits: [{ key: LIMIT_KEY, value: -1 }] };
                }
                return null;
            });

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — no usage check, no notification, outcome is 'skipped'
            expect(billing.limits.check).not.toHaveBeenCalled();
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(result.recalculations[0]?.outcome).toBe('skipped');
        });
    });

    // ── Customer lookup failure ────────────────────────────────────────────────

    describe('customer lookup failure during downgrade notification', () => {
        it('should skip email notification but still call Sentry when customers.get throws', async () => {
            // Arrange — usage check succeeds but customer fetch throws
            const db = setupDbWithPurchases([activePurchaseRow]);
            (billing.limits.check as unknown as MockInstance).mockResolvedValue({
                currentValue: 12
            });
            (billing.customers.get as unknown as MockInstance).mockRejectedValue(
                new Error('Customer service unavailable')
            );

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — no email (no customer info) but Sentry was already called
            // because the violation was detected before the customer fetch
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(mockCaptureSentryMessage).toHaveBeenCalledOnce();
            expect(result.recalculations[0]?.outcome).toBe('success');
        });

        it('should skip email notification but still call Sentry when customers.get returns null', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);
            (billing.limits.check as unknown as MockInstance).mockResolvedValue({
                currentValue: 12
            });
            (billing.customers.get as unknown as MockInstance).mockResolvedValue(null);

            // Act
            await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — email skipped, Sentry still fires
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(mockCaptureSentryMessage).toHaveBeenCalledOnce();
        });
    });

    // ── Early exit: no active limit addons ────────────────────────────────────

    describe('early exit when no active limit addons', () => {
        it('should not call billing.limits.check when there are no active limit addons', async () => {
            // Arrange — empty purchases array
            const db = setupDbWithPurchases([]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert
            expect(billing.limits.check).not.toHaveBeenCalled();
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(result.recalculations).toHaveLength(0);
        });
    });
});

// ─── AC-3.x: Recalculation correctness ───────────────────────────────────────

describe('handlePlanChangeAddonRecalculation — recalculation correctness (AC-3.1 to AC-3.6)', () => {
    let billing: QZPayBilling;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDbWhere.mockResolvedValue([]);
        mockSendNotification.mockResolvedValue(undefined);
        mockCaptureSentryMessage.mockReturnValue('');

        const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === OLD_PLAN_SLUG) return mockOldPlan;
            if (slug === NEW_PLAN_SLUG) return mockNewPlan;
            if (slug === UPGRADE_PLAN_SLUG) return mockUpgradePlan;
            return null;
        });
        (getAddonBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === 'extra-accommodations-5') return mockAddonDef;
            if (slug === 'extra-accommodations-15') return mockAddonDef15;
            if (slug === 'verified-badge') return mockEntitlementAddonDef;
            return null;
        });

        billing = createMockBilling();
        (billing.limits.set as unknown as MockInstance).mockResolvedValue(undefined);
        (billing.limits.check as unknown as MockInstance).mockResolvedValue({ currentValue: 0 });
        (billing.customers.get as unknown as MockInstance).mockResolvedValue(
            createMockCustomer({ id: CUSTOMER_ID })
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── AC-3.1: Upgrade — base increases, combined value correct ──────────────

    describe('AC-3.1: upgrade — limits.set called with base + addon increment', () => {
        it('should call limits.set with newMaxValue = newBase(50) + addonIncrement(20) = 70', async () => {
            // Arrange
            // Old plan base: 10, New plan (upgrade) base: 50
            // Addon purchase: +20 increment for LIMIT_KEY
            const purchaseWith20 = {
                id: 'purch_upgrade_01',
                customerId: CUSTOMER_ID,
                addonSlug: 'extra-accommodations-15',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: LIMIT_KEY, increase: 20 }],
                entitlementAdjustments: []
            };
            const db = setupDbWithPurchases([purchaseWith20]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: UPGRADE_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — newMaxValue = 50 (base) + 20 (addon) = 70
            expect(billing.limits.set).toHaveBeenCalledOnce();
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    limitKey: LIMIT_KEY,
                    maxValue: 70,
                    source: 'addon',
                    sourceId: ADDON_RECALC_SOURCE_ID
                })
            );
            const recalc = result.recalculations[0];
            expect(recalc?.outcome).toBe('success');
            expect(recalc?.newMaxValue).toBe(70);
        });

        it('should return direction=upgrade when new plan base exceeds old plan base', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG, // base 10
                newPlanId: UPGRADE_PLAN_SLUG, // base 50
                billing,
                db: db as never
            });

            // Assert
            expect(result.direction).toBe('upgrade');
        });
    });

    // ── AC-3.2: Multiple addons with the same limitKey ─────────────────────────

    describe('AC-3.2: multiple addons with same limitKey — increments summed', () => {
        it('should sum increments from all active purchases for the same limitKey', async () => {
            // Arrange
            // Two purchases: +5 and +15, new plan base = 3 → total = 3 + 5 + 15 = 23
            const db = setupDbWithPurchases([activePurchaseRow, activePurchaseRow15]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — newMaxValue = 3 (base) + 5 + 15 (addons) = 23
            expect(billing.limits.set).toHaveBeenCalledOnce();
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    limitKey: LIMIT_KEY,
                    maxValue: 23
                })
            );
            const recalc = result.recalculations.find((r) => r.limitKey === LIMIT_KEY);
            expect(recalc?.outcome).toBe('success');
            expect(recalc?.newMaxValue).toBe(23);
            expect(recalc?.addonCount).toBe(2);
        });

        it('should process each limitKey group independently', async () => {
            // Arrange — one purchase for LIMIT_KEY (+5), new plan has both keys
            // SECOND_LIMIT_KEY has no addon purchases → only one limits.set call
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — only LIMIT_KEY processed (SECOND_LIMIT_KEY has no active addon purchases)
            expect(result.recalculations).toHaveLength(1);
            expect(result.recalculations[0]?.limitKey).toBe(LIMIT_KEY);
        });
    });

    // ── AC-3.3: Entitlement addon not processed in recalculation ──────────────

    describe('AC-3.3: entitlement addon excluded from limit recalculation', () => {
        it('should not include entitlement-type addon in limits.set computation', async () => {
            // Arrange — only an entitlement addon, no limit addons
            const db = setupDbWithPurchases([entitlementPurchaseRow]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — no limit recalculations, limits.set never called
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(result.recalculations).toHaveLength(0);
        });

        it('should process limit addons and ignore entitlement addons in mixed purchases', async () => {
            // Arrange — one limit addon (+5) and one entitlement addon
            const db = setupDbWithPurchases([activePurchaseRow, entitlementPurchaseRow]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — only the limit addon contributes; entitlement addon is ignored
            expect(billing.limits.set).toHaveBeenCalledOnce();
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 8 }) // 3 + 5
            );
            expect(result.recalculations).toHaveLength(1);
        });
    });

    // ── AC-3.4: No limit addons — early exit ──────────────────────────────────

    describe('AC-3.4: no active limit addons — early exit, no limits.set calls', () => {
        it('should return empty recalculations and not call limits.set when no purchases exist', async () => {
            // Arrange
            const db = setupDbWithPurchases([]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(result.recalculations).toHaveLength(0);
            expect(result.customerId).toBe(CUSTOMER_ID);
            expect(result.oldPlanId).toBe(OLD_PLAN_SLUG);
            expect(result.newPlanId).toBe(NEW_PLAN_SLUG);
        });

        it('should not call limits.set when only entitlement addons are active', async () => {
            // Arrange — only entitlement addon, no limit addon
            const db = setupDbWithPurchases([entitlementPurchaseRow]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — AC-3.4: debug log path, no limits.set
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(result.recalculations).toHaveLength(0);
        });
    });

    // ── AC-3.5: New plan has unlimited (-1) for limitKey ──────────────────────

    describe('AC-3.5: new plan unlimited (-1) for limitKey — key skipped', () => {
        it('should skip limits.set and return outcome=skipped when new plan is unlimited', async () => {
            // Arrange — new plan returns -1 for LIMIT_KEY
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
                if (slug === OLD_PLAN_SLUG) return mockOldPlan;
                if (slug === NEW_PLAN_SLUG) {
                    return { ...mockNewPlan, limits: [{ key: LIMIT_KEY, value: -1 }] };
                }
                return null;
            });

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — limits.set not called, outcome is 'skipped', newMaxValue is -1
            expect(billing.limits.set).not.toHaveBeenCalled();
            const recalc = result.recalculations[0];
            expect(recalc?.outcome).toBe('skipped');
            expect(recalc?.newMaxValue).toBe(-1);
            expect(recalc?.limitKey).toBe(LIMIT_KEY);
        });

        it('should skip the unlimited key but still process other finite limitKeys', async () => {
            // Arrange — LIMIT_KEY is unlimited in new plan, but second addon for
            // a different key should still be processed. We simulate this by having
            // two separate purchases: one for each key, with the new plan having
            // -1 for LIMIT_KEY and 5 for SECOND_LIMIT_KEY.
            const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
                if (slug === OLD_PLAN_SLUG) return mockOldPlan;
                if (slug === NEW_PLAN_SLUG) {
                    return {
                        ...mockNewPlan,
                        limits: [
                            { key: LIMIT_KEY, value: -1 },
                            { key: SECOND_LIMIT_KEY, value: 5 }
                        ]
                    };
                }
                return null;
            });

            const secondKeyAddonDef = {
                ...mockAddonDef,
                slug: 'extra-featured-2',
                affectsLimitKey: SECOND_LIMIT_KEY,
                limitIncrease: 2
            };
            (getAddonBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
                if (slug === 'extra-accommodations-5') return mockAddonDef;
                if (slug === 'extra-featured-2') return secondKeyAddonDef;
                return null;
            });

            const secondKeyPurchase = {
                id: 'purch_featured_01',
                customerId: CUSTOMER_ID,
                addonSlug: 'extra-featured-2',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: SECOND_LIMIT_KEY, increase: 2 }],
                entitlementAdjustments: []
            };

            const db = setupDbWithPurchases([activePurchaseRow, secondKeyPurchase]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — LIMIT_KEY skipped, SECOND_LIMIT_KEY processed (5 + 2 = 7)
            expect(result.recalculations).toHaveLength(2);
            const limitKeyResult = result.recalculations.find((r) => r.limitKey === LIMIT_KEY);
            const secondKeyResult = result.recalculations.find(
                (r) => r.limitKey === SECOND_LIMIT_KEY
            );
            expect(limitKeyResult?.outcome).toBe('skipped');
            expect(secondKeyResult?.outcome).toBe('success');
            expect(secondKeyResult?.newMaxValue).toBe(7);
            expect(billing.limits.set).toHaveBeenCalledOnce();
        });
    });

    // ── AC-3.6: limitKey missing from new plan's limits array ─────────────────

    describe('AC-3.6: limitKey absent from new plan — basePlanLimit=0, warning + Sentry', () => {
        it('should treat missing limitKey as basePlanLimit=0 and call Sentry.captureMessage', async () => {
            // Arrange — new plan has NO entry for LIMIT_KEY
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
                if (slug === OLD_PLAN_SLUG) return mockOldPlan;
                if (slug === NEW_PLAN_SLUG) {
                    // limits array does not contain LIMIT_KEY
                    return { ...mockNewPlan, limits: [] };
                }
                return null;
            });

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: NEW_PLAN_SLUG,
                billing,
                db: db as never
            });

            // Assert — Sentry warning called for missing limitKey
            expect(mockCaptureSentryMessage).toHaveBeenCalledOnce();
            expect(mockCaptureSentryMessage).toHaveBeenCalledWith(
                expect.stringContaining(LIMIT_KEY),
                expect.objectContaining({
                    level: 'warning',
                    extra: expect.objectContaining({
                        customerId: CUSTOMER_ID,
                        limitKey: LIMIT_KEY,
                        newPlanId: NEW_PLAN_SLUG
                    })
                })
            );

            // Assert — limits.set called with base=0 + addon=5 = 5
            expect(billing.limits.set).toHaveBeenCalledOnce();
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 5 }) // 0 + 5
            );
            expect(result.recalculations[0]?.outcome).toBe('success');
            expect(result.recalculations[0]?.newMaxValue).toBe(5);
        });
    });
});

// ─── AC-4.1: Downgrade combined limit correctness ────────────────────────────

describe('handlePlanChangeAddonRecalculation — AC-4.1 downgrade combined limit computation', () => {
    let billing: QZPayBilling;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDbWhere.mockResolvedValue([]);
        mockSendNotification.mockResolvedValue(undefined);
        mockCaptureSentryMessage.mockReturnValue('');

        const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === OLD_PLAN_SLUG) return mockOldPlan;
            if (slug === NEW_PLAN_SLUG) return mockNewPlan;
            return null;
        });
        (getAddonBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === 'extra-accommodations-5') return mockAddonDef;
            if (slug === 'extra-accommodations-15') return mockAddonDef15;
            return null;
        });

        billing = createMockBilling();
        (billing.limits.set as unknown as MockInstance).mockResolvedValue(undefined);
        (billing.limits.check as unknown as MockInstance).mockResolvedValue({ currentValue: 0 });
        (billing.customers.get as unknown as MockInstance).mockResolvedValue(
            createMockCustomer({ id: CUSTOMER_ID })
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should compute correct oldMaxValue and newMaxValue on downgrade', async () => {
        // Arrange
        // Old plan: base=10, addon=+5 → oldMaxValue=15
        // New plan: base=3,  addon=+5 → newMaxValue=8
        const db = setupDbWithPurchases([activePurchaseRow]);

        // Act
        const result = await handlePlanChangeAddonRecalculation({
            customerId: CUSTOMER_ID,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: NEW_PLAN_SLUG,
            billing,
            db: db as never
        });

        // Assert
        const recalc = result.recalculations[0];
        expect(recalc?.oldMaxValue).toBe(15);
        expect(recalc?.newMaxValue).toBe(8);
        expect(recalc?.outcome).toBe('success');
        expect(result.direction).toBe('downgrade');
    });

    it('should compute correct combined values when multiple addons exist on downgrade', async () => {
        // Arrange
        // Old plan: base=10, addons=+5+15=+20 → oldMaxValue=30
        // New plan: base=3,  addons=+5+15=+20 → newMaxValue=23
        const db = setupDbWithPurchases([activePurchaseRow, activePurchaseRow15]);

        // Act
        const result = await handlePlanChangeAddonRecalculation({
            customerId: CUSTOMER_ID,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: NEW_PLAN_SLUG,
            billing,
            db: db as never
        });

        // Assert
        const recalc = result.recalculations[0];
        expect(recalc?.oldMaxValue).toBe(30); // 10 + 5 + 15
        expect(recalc?.newMaxValue).toBe(23); // 3 + 5 + 15
        expect(recalc?.addonCount).toBe(2);
    });
});

// ─── Direction detection ──────────────────────────────────────────────────────

describe('handlePlanChangeAddonRecalculation — direction detection', () => {
    let billing: QZPayBilling;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDbWhere.mockResolvedValue([]);

        const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === OLD_PLAN_SLUG) return mockOldPlan; // LIMIT_KEY base=10
            if (slug === NEW_PLAN_SLUG) return mockNewPlan; // LIMIT_KEY base=3
            if (slug === UPGRADE_PLAN_SLUG) return mockUpgradePlan; // LIMIT_KEY base=50
            return null;
        });
        (getAddonBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            if (slug === 'extra-accommodations-5') return mockAddonDef;
            return null;
        });

        billing = createMockBilling();
        (billing.limits.set as unknown as MockInstance).mockResolvedValue(undefined);
        (billing.limits.check as unknown as MockInstance).mockResolvedValue({ currentValue: 0 });
        (billing.customers.get as unknown as MockInstance).mockResolvedValue(
            createMockCustomer({ id: CUSTOMER_ID })
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return direction=upgrade when new plan base is higher than old plan base', async () => {
        // Arrange
        const db = setupDbWithPurchases([activePurchaseRow]);

        // Act
        const result = await handlePlanChangeAddonRecalculation({
            customerId: CUSTOMER_ID,
            oldPlanId: OLD_PLAN_SLUG, // base=10
            newPlanId: UPGRADE_PLAN_SLUG, // base=50
            billing,
            db: db as never
        });

        // Assert
        expect(result.direction).toBe('upgrade');
    });

    it('should return direction=downgrade when new plan base is lower than old plan base', async () => {
        // Arrange
        const db = setupDbWithPurchases([activePurchaseRow]);

        // Act
        const result = await handlePlanChangeAddonRecalculation({
            customerId: CUSTOMER_ID,
            oldPlanId: OLD_PLAN_SLUG, // base=10
            newPlanId: NEW_PLAN_SLUG, // base=3
            billing,
            db: db as never
        });

        // Assert
        expect(result.direction).toBe('downgrade');
    });

    it('should return direction=lateral when both plans have identical base for the limitKey', async () => {
        // Arrange — configure plans to have the same base value for LIMIT_KEY
        const { getPlanBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            const sameLimitPlan = { ...mockOldPlan, slug, limits: [{ key: LIMIT_KEY, value: 10 }] };
            return sameLimitPlan;
        });

        const db = setupDbWithPurchases([activePurchaseRow]);

        // Act
        const result = await handlePlanChangeAddonRecalculation({
            customerId: CUSTOMER_ID,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: NEW_PLAN_SLUG,
            billing,
            db: db as never
        });

        // Assert
        expect(result.direction).toBe('lateral');
    });

    it('should return direction=lateral when no limit addons exist (empty affectedLimitKeys)', async () => {
        // Arrange — no purchases, computeDirection called with empty array
        const db = setupDbWithPurchases([]);

        // Act
        const result = await handlePlanChangeAddonRecalculation({
            customerId: CUSTOMER_ID,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: NEW_PLAN_SLUG,
            billing,
            db: db as never
        });

        // Assert — empty keys → lateral (0 == 0)
        expect(result.direction).toBe('lateral');
    });
});

// ─── Plan not found ───────────────────────────────────────────────────────────

describe('handlePlanChangeAddonRecalculation — new plan not found in config', () => {
    let billing: QZPayBilling;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDbWhere.mockResolvedValue([]);
        mockCaptureSentryMessage.mockReturnValue('');

        const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockImplementation((slug: string) => {
            // Old plan found, new plan NOT found
            if (slug === OLD_PLAN_SLUG) return mockOldPlan;
            return null;
        });
        (getAddonBySlug as unknown as MockInstance).mockReturnValue(mockAddonDef);

        billing = createMockBilling();
        (billing.limits.set as unknown as MockInstance).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return all recalculations as failed and call Sentry when new plan is unknown', async () => {
        // Arrange
        const db = setupDbWithPurchases([activePurchaseRow]);

        // Act
        const result: PlanChangeRecalculationResult = await handlePlanChangeAddonRecalculation({
            customerId: CUSTOMER_ID,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: 'plan-does-not-exist',
            billing,
            db: db as never
        });

        // Assert — no limits were set
        expect(billing.limits.set).not.toHaveBeenCalled();

        // Assert — Sentry called with error level
        expect(mockCaptureSentryMessage).toHaveBeenCalledOnce();
        expect(mockCaptureSentryMessage).toHaveBeenCalledWith(
            expect.stringContaining('plan-does-not-exist'),
            expect.objectContaining({
                level: 'error',
                extra: expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    newPlanId: 'plan-does-not-exist'
                })
            })
        );

        // Assert — all recalculations marked as failed
        expect(result.recalculations).toHaveLength(1);
        expect(result.recalculations[0]?.outcome).toBe('failed');
        expect(result.recalculations[0]?.limitKey).toBe(LIMIT_KEY);
        expect(result.recalculations[0]?.reason).toContain('plan-does-not-exist');

        // Assert — direction defaults to lateral when plan is unknown
        expect(result.direction).toBe('lateral');
    });

    it('should not throw when limits.set would have been called', async () => {
        // Arrange — even though set would fail because plan not found, no exception propagates
        const db = setupDbWithPurchases([activePurchaseRow]);

        // Act / Assert — must not throw
        await expect(
            handlePlanChangeAddonRecalculation({
                customerId: CUSTOMER_ID,
                oldPlanId: OLD_PLAN_SLUG,
                newPlanId: 'unknown-plan',
                billing,
                db: db as never
            })
        ).resolves.not.toThrow();
    });

    it('should return correct customerId, oldPlanId, newPlanId in result even on failure', async () => {
        // Arrange
        const db = setupDbWithPurchases([activePurchaseRow]);
        const unknownPlan = 'ghost-plan';

        // Act
        const result = await handlePlanChangeAddonRecalculation({
            customerId: CUSTOMER_ID,
            oldPlanId: OLD_PLAN_SLUG,
            newPlanId: unknownPlan,
            billing,
            db: db as never
        });

        // Assert — result shape is always complete
        expect(result.customerId).toBe(CUSTOMER_ID);
        expect(result.oldPlanId).toBe(OLD_PLAN_SLUG);
        expect(result.newPlanId).toBe(unknownPlan);
    });
});
