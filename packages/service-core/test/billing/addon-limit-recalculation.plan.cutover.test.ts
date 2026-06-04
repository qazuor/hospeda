/**
 * Parity tests for addon-limit-recalculation.service.ts plan-read cutover (SPEC-192 T-027)
 *
 * Verifies that `recalculateAddonLimitsForCustomer` now resolves the base plan
 * limit via `PlanService` (DB-backed, dual-resolve: getById → getBySlug fallback)
 * instead of the static `getPlanBySlug` from `@repo/billing`.
 *
 * Key assertions:
 * - `PlanService.getById` is called with the subscription's `planId`
 * - When getById returns NOT_FOUND, `PlanService.getBySlug` is called as fallback
 * - The DB `limits` field (`Record<string,number>`) is used for base limit lookup
 * - A UUID planId resolves via getById (no getBySlug needed)
 * - A slug planId resolves via getBySlug fallback (legacy compat)
 * - Plan NOT found (both fail) → `outcome: 'failed'`
 *
 * No real database. All DB and QZPay calls are mocked.
 *
 * @module test/billing/addon-limit-recalculation.plan.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockCatalogGetBySlug, mockWithTransaction, mockPlanGetById, mockPlanGetBySlug } =
    vi.hoisted(() => ({
        mockCatalogGetBySlug: vi.fn(),
        mockWithTransaction: vi.fn(),
        mockPlanGetById: vi.fn(),
        mockPlanGetBySlug: vi.fn()
    }));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/services/billing/addon/addon-catalog.service.js', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockCatalogGetBySlug,
        list: vi.fn()
    }))
}));

vi.mock('../../src/services/billing/plan/plan.service.js', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        getById: mockPlanGetById,
        getBySlug: mockPlanGetBySlug
    }))
}));

vi.mock('@repo/db', () => ({
    withTransaction: mockWithTransaction,
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            type: 'sql',
            strings,
            values
        })),
        { raw: vi.fn() }
    )
}));

// @repo/billing getPlanBySlug is no longer called after T-027 cutover
vi.mock('@repo/billing', () => ({
    getPlanBySlug: vi.fn()
}));

vi.mock('../../src/services/billing/addon/addon-lifecycle.constants.js', () => ({
    ADDON_RECALC_SOURCE_ID: 'addon-recalc-source'
}));

// Import after mocks
import { recalculateAddonLimitsForCustomer } from '../../src/services/billing/addon/addon-limit-recalculation.service.js';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const UUID_PLAN_ID = 'b1c2d3e4-0000-4000-8000-000000000001';
const SLUG_PLAN_ID = 'owner-basico';

const STUB_LIMIT_ADDON = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations Pack (+5)',
    description: 'Adds 5 additional accommodations.',
    billingType: 'recurring' as const,
    priceArs: 1000000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: 'max_accommodations',
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 4
};

/** DB-backed plan response with limits as Record<string,number> */
const STUB_DB_PLAN = {
    id: UUID_PLAN_ID,
    slug: SLUG_PLAN_ID,
    name: 'Owner Basico',
    description: 'Basic plan',
    category: 'owner',
    monthlyPriceArs: 500,
    annualPriceArs: null,
    monthlyPriceUsdRef: 3,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    isActive: true,
    entitlements: [],
    limits: { max_accommodations: 5 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wireCatalogAddon() {
    mockCatalogGetBySlug.mockResolvedValue({
        success: true,
        data: STUB_LIMIT_ADDON
    });
}

function buildBilling(planId: string) {
    return {
        subscriptions: {
            getByCustomerId: vi
                .fn()
                .mockResolvedValue([{ id: 'sub-uuid', status: 'active', planId }])
        },
        limits: {
            set: vi.fn().mockResolvedValue(undefined),
            removeBySource: vi.fn().mockResolvedValue(undefined)
        }
    };
}

function wireTxWithRows(rows: unknown[]) {
    mockWithTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = { execute: vi.fn().mockResolvedValue({ rows }) };
        return callback(fakeTx);
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-limit-recalculation plan-read cutover (SPEC-192 T-027)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('UUID planId — resolved via PlanService.getById', () => {
        it('should call getById with the UUID planId and use the DB plan limits', async () => {
            // Arrange
            wireCatalogAddon();
            wireTxWithRows([
                {
                    addonSlug: 'extra-accommodations-5',
                    id: 'p1',
                    status: 'active',
                    limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
                }
            ]);
            const billing = buildBilling(UUID_PLAN_ID);

            // getById succeeds for UUID planId
            mockPlanGetById.mockResolvedValue({ success: true, data: STUB_DB_PLAN });
            mockPlanGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: 'cust-uuid',
                limitKey: 'max_accommodations',
                billing: billing as never,
                db: {} as never
            });

            // Assert
            expect(result.outcome).toBe('success');
            // getById was called with the UUID planId
            expect(mockPlanGetById).toHaveBeenCalledWith(UUID_PLAN_ID);
            // newMaxValue = basePlanLimit(5) + increment(5) = 10
            expect(result.newMaxValue).toBe(10);
            expect(result.oldMaxValue).toBe(5);
        });
    });

    describe('Slug planId — resolved via PlanService.getBySlug fallback', () => {
        it('should call getBySlug when getById returns NOT_FOUND (legacy slug planId)', async () => {
            // Arrange
            wireCatalogAddon();
            wireTxWithRows([
                {
                    addonSlug: 'extra-accommodations-5',
                    id: 'p1',
                    status: 'active',
                    limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
                }
            ]);
            const billing = buildBilling(SLUG_PLAN_ID);

            // getById fails → getBySlug fallback succeeds
            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });
            mockPlanGetBySlug.mockResolvedValue({ success: true, data: STUB_DB_PLAN });

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: 'cust-uuid',
                limitKey: 'max_accommodations',
                billing: billing as never,
                db: {} as never
            });

            // Assert
            expect(result.outcome).toBe('success');
            // getBySlug was used as fallback
            expect(mockPlanGetBySlug).toHaveBeenCalledWith(SLUG_PLAN_ID);
            expect(result.newMaxValue).toBe(10); // 5 + 5
        });
    });

    describe('Plan not found — both getById and getBySlug fail', () => {
        it('should return outcome: failed when plan cannot be resolved', async () => {
            // Arrange
            wireCatalogAddon();
            wireTxWithRows([
                {
                    addonSlug: 'extra-accommodations-5',
                    id: 'p1',
                    status: 'active',
                    limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
                }
            ]);
            const billing = buildBilling('nonexistent-plan-uuid');

            // Both lookups fail
            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });
            mockPlanGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: 'cust-uuid',
                limitKey: 'max_accommodations',
                billing: billing as never,
                db: {} as never
            });

            // Assert — fails gracefully (does NOT silently use 0 and succeed)
            expect(result.outcome).toBe('failed');
            expect(result.reason).toContain('not found in DB');
            expect(billing.limits.set).not.toHaveBeenCalled();
        });
    });

    describe('DB limits shape (Record<string,number>)', () => {
        it('should extract base limit from limits Record correctly', async () => {
            // Arrange — plan has limits as Record<string,number> (DB shape)
            const dbPlanWithRecord = {
                ...STUB_DB_PLAN,
                limits: { max_accommodations: 7, max_photos_per_accommodation: 10 }
            };

            wireCatalogAddon();
            wireTxWithRows([
                {
                    addonSlug: 'extra-accommodations-5',
                    id: 'p1',
                    status: 'active',
                    limitAdjustments: [{ limitKey: 'max_accommodations', increase: 3 }]
                }
            ]);
            const billing = buildBilling(SLUG_PLAN_ID);

            mockPlanGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'not found' }
            });
            mockPlanGetBySlug.mockResolvedValue({ success: true, data: dbPlanWithRecord });

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: 'cust-uuid',
                limitKey: 'max_accommodations',
                billing: billing as never,
                db: {} as never
            });

            // Assert — base limit 7 + increment 3 = 10
            expect(result.outcome).toBe('success');
            expect(result.newMaxValue).toBe(10);
            expect(result.oldMaxValue).toBe(7);
        });
    });
});
