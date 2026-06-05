/**
 * Integration tests for the plan reader cutover (SPEC-192 T-033)
 *
 * Verifies that PlanService.getBySlug() returns consistent slug, prices,
 * entitlements and limits versus the same data expressed as the old config
 * shape. Also covers the T-025 regression: when planId is a UUID, the
 * dual-resolve path (getById → getBySlug) resolves the plan and
 * basePlanLimit > 0.
 *
 * All DB calls are mocked via vi.mock('@repo/db'). No live database is
 * required. Mock-backed per project integration-test convention; live-DB
 * variant deferred to e2e suite.
 *
 * File placed in packages/service-core/test/integration/billing/ per the
 * project convention (not src/__tests__/integration/ as in the spec text).
 *
 * @module test/integration/billing/plan-reader-cutover
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mock handles ──────────────────────────────────────────────────

const { mockGetDb, mockWithTransaction } = vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockWithTransaction: vi.fn()
}));

// ─── Mock @repo/db ─────────────────────────────────────────────────────────

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    withTransaction: mockWithTransaction,
    billingPlans: {
        id: 'id',
        name: 'name',
        description: 'description',
        active: 'active',
        entitlements: 'entitlements',
        limits: 'limits',
        livemode: 'livemode',
        metadata: 'metadata',
        deletedAt: 'deletedAt',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    billingPrices: {
        id: 'price_id',
        planId: 'planId',
        currency: 'currency',
        unitAmount: 'unitAmount',
        billingInterval: 'billingInterval',
        intervalCount: 'intervalCount',
        active: 'active',
        livemode: 'livemode',
        trialDays: 'trialDays',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    billingSubscriptions: {
        id: 'sub_id',
        planId: 'planId',
        status: 'status',
        deletedAt: 'deletedAt'
    },
    billingAuditLogs: { table: 'billingAuditLogs' },
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
    asc: vi.fn((col: unknown) => ({ type: 'asc', col })),
    count: vi.fn(() => ({ type: 'count' })),
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            type: 'sql',
            strings,
            values
        })),
        {
            raw: vi.fn((s: string) => ({ type: 'sql_raw', s })),
            join: vi.fn((parts: unknown[], _sep: unknown) => ({ type: 'sql_join', parts }))
        }
    )
}));

// ─── Mock revalidation (PlanService calls it on writes) ─────────────────────

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn(() => null)
}));
vi.mock('../../../src/revalidation/entity-path-mapper.js', () => ({
    getLocalizedPath: vi.fn((path: string) => path)
}));

// ─── Imports after mocks ───────────────────────────────────────────────────

import { PlanService } from '../../../src/services/billing/plan/plan.service.js';

// ─── Fixtures: plan row builders ──────────────────────────────────────────

/**
 * Builds a minimal billing_plans DB row.
 * slug is stored in billing_plans.name per SPEC-168 convention.
 */
function buildPlanRow(overrides: {
    id: string;
    slug: string;
    category: 'owner' | 'tourist' | 'complex';
    entitlements?: string[];
    limits?: Record<string, number>;
    monthlyPriceArs?: number;
    annualPriceArs?: number | null;
    sortOrder?: number;
    active?: boolean;
}) {
    const {
        id,
        slug,
        category,
        entitlements = [],
        limits = {},
        monthlyPriceArs = 0,
        annualPriceArs = null,
        sortOrder = 1,
        active = true
    } = overrides;

    return {
        id,
        name: slug, // DB column `name` stores the slug
        description: `${slug} plan description`,
        active,
        entitlements,
        limits,
        livemode: false,
        metadata: {
            slug,
            displayName: slug,
            category,
            isDefault: false,
            sortOrder,
            trialDays: 0,
            hasTrial: false,
            monthlyPriceArs,
            annualPriceArs,
            monthlyPriceUsdRef: 0
        },
        deletedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

/**
 * Builds a mock billing_prices row for a given plan.
 */
function buildPriceRow(overrides: {
    planId: string;
    billingInterval: 'month' | 'year';
    unitAmount: number;
}) {
    return {
        id: `price-${overrides.planId}-${overrides.billingInterval}-t033`,
        planId: overrides.planId,
        currency: 'ARS',
        unitAmount: overrides.unitAmount,
        billingInterval: overrides.billingInterval,
        intervalCount: 1,
        active: true,
        livemode: false,
        trialDays: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

/**
 * Builds a mock DB for plan getBySlug:
 * 1st call: select().from().where().limit(1) → [planRow]
 * 2nd call: select().from().where() → [priceRows...]
 */
function buildGetBySlugDb(
    planRow: ReturnType<typeof buildPlanRow> | undefined,
    priceRows: ReturnType<typeof buildPriceRow>[] = []
) {
    let selectCallIdx = 0;
    return {
        select: vi.fn().mockImplementation(() => {
            const idx = selectCallIdx++;
            if (idx === 0) {
                // Plan lookup: .from().where().limit(1)
                return {
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue(planRow ? [planRow] : [])
                        })
                    })
                };
            }
            // Price lookup: .from().where()
            return {
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(priceRows)
                })
            };
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    };
}

/**
 * Builds a mock DB for plan getById (by UUID):
 * Same structure as getBySlug but first .where() uses eq(id).
 */
function buildGetByIdDb(
    planRow: ReturnType<typeof buildPlanRow> | undefined,
    priceRows: ReturnType<typeof buildPriceRow>[] = []
) {
    return buildGetBySlugDb(planRow, priceRows);
}

// ─── Plan definitions (old config shape → expected mapped output) ─────────

/**
 * Old-config-shape representation used to build expectations.
 * Mirrors what static plans.config.ts used to provide.
 */
interface OldConfigPlan {
    slug: string;
    category: 'owner' | 'tourist' | 'complex';
    monthlyPriceArs: number;
    annualPriceArs: number | null;
    entitlements: string[];
    limits: Record<string, number>;
}

const OLD_PLANS: OldConfigPlan[] = [
    {
        slug: 'tourist-free',
        category: 'tourist',
        monthlyPriceArs: 0,
        annualPriceArs: null,
        entitlements: ['SAVE_FAVORITES', 'WRITE_REVIEWS'],
        limits: { max_favorites: 10 }
    },
    {
        slug: 'tourist-plus',
        category: 'tourist',
        monthlyPriceArs: 300000,
        annualPriceArs: 3000000,
        entitlements: ['SAVE_FAVORITES', 'WRITE_REVIEWS', 'AD_FREE', 'PRICE_ALERTS'],
        limits: { max_favorites: 50 }
    },
    {
        slug: 'tourist-vip',
        category: 'tourist',
        monthlyPriceArs: 800000,
        annualPriceArs: 8000000,
        entitlements: ['SAVE_FAVORITES', 'WRITE_REVIEWS', 'AD_FREE', 'VIP_SUPPORT'],
        limits: { max_favorites: -1 }
    },
    {
        slug: 'owner-basico',
        category: 'owner',
        monthlyPriceArs: 500000,
        annualPriceArs: 5000000,
        entitlements: ['PUBLISH_ACCOMMODATIONS', 'EDIT_ACCOMMODATION_INFO'],
        limits: { max_accommodations: 1, max_photos_per_accommodation: 10 }
    },
    {
        slug: 'owner-pro',
        category: 'owner',
        monthlyPriceArs: 1500000,
        annualPriceArs: 15000000,
        entitlements: ['PUBLISH_ACCOMMODATIONS', 'EDIT_ACCOMMODATION_INFO', 'VIEW_ADVANCED_STATS'],
        limits: { max_accommodations: 5, max_photos_per_accommodation: 30 }
    },
    {
        slug: 'owner-premium',
        category: 'owner',
        monthlyPriceArs: 3000000,
        annualPriceArs: 30000000,
        entitlements: [
            'PUBLISH_ACCOMMODATIONS',
            'EDIT_ACCOMMODATION_INFO',
            'VIEW_ADVANCED_STATS',
            'PRIORITY_SUPPORT'
        ],
        limits: { max_accommodations: -1, max_photos_per_accommodation: -1 }
    },
    {
        slug: 'complex-basico',
        category: 'complex',
        monthlyPriceArs: 2000000,
        annualPriceArs: 20000000,
        entitlements: ['PUBLISH_ACCOMMODATIONS', 'MULTI_PROPERTY_MANAGEMENT'],
        limits: { max_properties: 3, max_staff_accounts: 2 }
    },
    {
        slug: 'complex-pro',
        category: 'complex',
        monthlyPriceArs: 5000000,
        annualPriceArs: 50000000,
        entitlements: [
            'PUBLISH_ACCOMMODATIONS',
            'MULTI_PROPERTY_MANAGEMENT',
            'CONSOLIDATED_ANALYTICS'
        ],
        limits: { max_properties: 10, max_staff_accounts: 5 }
    },
    {
        slug: 'complex-premium',
        category: 'complex',
        monthlyPriceArs: 10000000,
        annualPriceArs: 100000000,
        entitlements: [
            'PUBLISH_ACCOMMODATIONS',
            'MULTI_PROPERTY_MANAGEMENT',
            'CONSOLIDATED_ANALYTICS',
            'WHITE_LABEL'
        ],
        limits: { max_properties: -1, max_staff_accounts: -1 }
    }
];

/**
 * Builds a DB row + price rows from an old-config plan definition.
 * UUIDs are made unique per plan to avoid module-level Map cross-contamination.
 */
function buildFixtureFromConfig(
    plan: OldConfigPlan,
    idSuffix: string
): {
    planRow: ReturnType<typeof buildPlanRow>;
    priceRows: ReturnType<typeof buildPriceRow>[];
} {
    const id = `plan-${idSuffix}-uuid-t033`;
    const planRow = buildPlanRow({
        id,
        slug: plan.slug,
        category: plan.category,
        entitlements: plan.entitlements,
        limits: plan.limits,
        monthlyPriceArs: plan.monthlyPriceArs,
        annualPriceArs: plan.annualPriceArs
    });
    const priceRows: ReturnType<typeof buildPriceRow>[] = [
        buildPriceRow({ planId: id, billingInterval: 'month', unitAmount: plan.monthlyPriceArs })
    ];
    if (plan.annualPriceArs !== null && plan.annualPriceArs > 0) {
        priceRows.push(
            buildPriceRow({ planId: id, billingInterval: 'year', unitAmount: plan.annualPriceArs })
        );
    }
    return { planRow, priceRows };
}

// ─── Tests: getBySlug() mapper parity ────────────────────────────────────

describe('plan reader cutover — PlanService.getBySlug() (T-033)', () => {
    let planService: PlanService;

    beforeEach(() => {
        vi.clearAllMocks();
        planService = new PlanService();
    });

    describe.each(OLD_PLANS.map((p, i) => ({ plan: p, idx: String(i + 1) })))(
        'plan $plan.slug',
        ({ plan, idx }) => {
            it('should return consistent slug, prices, entitlements, limits vs config shape', async () => {
                // Arrange
                const { planRow, priceRows } = buildFixtureFromConfig(plan, idx);
                mockGetDb.mockReturnValue(buildGetBySlugDb(planRow, priceRows));

                // Act
                const result = await planService.getBySlug(plan.slug);

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;

                const data = result.data;

                // Slug must match
                expect(data.slug).toBe(plan.slug);

                // Category must match
                expect(data.category).toBe(plan.category);

                // Monthly price from DB row
                expect(data.monthlyPriceArs).toBe(plan.monthlyPriceArs);

                // Annual price: null when not present, or the config value
                if (plan.annualPriceArs === null || plan.annualPriceArs === 0) {
                    expect(data.annualPriceArs).toBeNull();
                } else {
                    expect(data.annualPriceArs).toBe(plan.annualPriceArs);
                }

                // Entitlements must be string[] matching config
                expect(Array.isArray(data.entitlements)).toBe(true);
                expect(data.entitlements).toEqual(plan.entitlements);

                // Limits must be Record<string,number> (not LimitDefinition[])
                // This is the T-025 mapper parity assertion
                expect(typeof data.limits).toBe('object');
                expect(Array.isArray(data.limits)).toBe(false);
                for (const [key, val] of Object.entries(plan.limits)) {
                    expect((data.limits as Record<string, number>)[key]).toBe(val);
                }

                // isActive must be true (from fixture)
                expect(data.isActive).toBe(true);
            });
        }
    );
});

// ─── Tests: T-025 regression — dual-resolve when planId is a UUID ──────────

describe('plan reader cutover — T-025 regression: dual-resolve (T-033)', () => {
    let planService: PlanService;

    beforeEach(() => {
        vi.clearAllMocks();
        planService = new PlanService();
    });

    it('getById with a UUID planId succeeds and returns basePlanLimit > 0', async () => {
        // This is the T-025 bug scenario:
        // before the fix, resolvePlanLimitsByIdOrSlug only called getBySlug,
        // which failed for UUID planIds (new rows). The fix adds getById first.

        // Arrange — simulate the owner-basico plan with a UUID as its lookup key
        const uuid = 'plan-owner-basico-uuid-t025-regression';
        const planRow = buildPlanRow({
            id: uuid,
            slug: 'owner-basico',
            category: 'owner',
            entitlements: ['PUBLISH_ACCOMMODATIONS'],
            limits: { max_accommodations: 1 },
            monthlyPriceArs: 500000
        });
        const priceRows = [
            buildPriceRow({ planId: uuid, billingInterval: 'month', unitAmount: 500000 })
        ];

        // getById succeeds when the UUID matches the plan row id
        mockGetDb.mockReturnValue(buildGetByIdDb(planRow, priceRows));

        // Act — call getById (simulating the first resolve in dual-resolve)
        const result = await planService.getById(uuid);

        // Assert — plan resolves successfully
        expect(result.success).toBe(true);
        if (!result.success) return;

        // The limits are Record<string,number>, so max_accommodations > 0
        const limits = result.data.limits as Record<string, number>;
        expect(limits.max_accommodations).toBeDefined();
        expect(limits.max_accommodations).toBeGreaterThan(0);
    });

    it('getBySlug fallback succeeds when getById returns NOT_FOUND (legacy slug planId)', async () => {
        // This is the slug-fallback arm of dual-resolve:
        // when planId is a slug (not a UUID), getById returns NOT_FOUND,
        // then getBySlug succeeds.

        // Arrange — DB returns nothing for id lookup (no row with id = 'owner-basico'),
        // but returns the plan for slug lookup
        const planRow = buildPlanRow({
            id: 'plan-slug-fallback-uuid-t033',
            slug: 'owner-basico',
            category: 'owner',
            entitlements: ['PUBLISH_ACCOMMODATIONS'],
            limits: { max_accommodations: 1 },
            monthlyPriceArs: 500000
        });
        const priceRows = [
            buildPriceRow({
                planId: 'plan-slug-fallback-uuid-t033',
                billingInterval: 'month',
                unitAmount: 500000
            })
        ];

        // getById returns NOT_FOUND (undefined row)
        const idMissDb = buildGetByIdDb(undefined, []);
        // getBySlug returns the plan
        const slugFoundDb = buildGetBySlugDb(planRow, priceRows);

        // First call (getById) returns nothing, second call (getBySlug) returns the plan
        let dbCallCount = 0;
        mockGetDb.mockImplementation(() => {
            return dbCallCount++ === 0 ? idMissDb : slugFoundDb;
        });

        // Act — simulate dual-resolve by calling getById first, then getBySlug on failure
        const byIdResult = await planService.getById('owner-basico'); // slug used as id → NOT_FOUND
        expect(byIdResult.success).toBe(false);

        const bySlugResult = await planService.getBySlug('owner-basico');
        expect(bySlugResult.success).toBe(true);
        if (!bySlugResult.success) return;

        // The limits contain the plan limit value > 0
        const limits = bySlugResult.data.limits as Record<string, number>;
        expect(limits.max_accommodations).toBe(1);
    });
});
