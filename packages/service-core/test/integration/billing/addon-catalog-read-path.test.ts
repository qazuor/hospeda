/**
 * Integration tests for the add-on catalog read path (SPEC-192 T-032)
 *
 * Verifies the chain:
 *   billing_addons (mocked rows) → AddonCatalogService → addon.catalog.ts delegation
 *   → consumer-visible AddonDefinition
 *
 * All DB calls are mocked via vi.mock('@repo/db'). No live database is required.
 * Mock-backed per project integration-test convention; live-DB variant deferred
 * to the e2e suite.
 *
 * File location follows the project convention for mocked integration tests:
 *   packages/service-core/test/integration/billing/
 * (not src/__tests__/integration/ which is the spec suggestion but wrong for this repo)
 *
 * @module test/integration/billing/addon-catalog-read-path
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
    billingAddons: {
        id: 'id',
        name: 'name',
        description: 'description',
        active: 'active',
        unitAmount: 'unitAmount',
        currency: 'currency',
        billingInterval: 'billingInterval',
        billingIntervalCount: 'billingIntervalCount',
        entitlements: 'entitlements',
        limits: 'limits',
        livemode: 'livemode',
        metadata: 'metadata',
        deletedAt: 'deletedAt',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    billingAuditLogs: { table: 'billingAuditLogs' },
    billingSubscriptionAddons: {
        table: 'billingSubscriptionAddons',
        addOnId: 'subscriptionAddonAddOnId'
    },
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
        { raw: vi.fn((s: string) => ({ type: 'sql_raw', s })) }
    )
}));

// ─── Imports after mocks ───────────────────────────────────────────────────

import {
    getAddonCatalogEntry,
    listAvailableAddons
} from '../../../src/services/billing/addon/addon.catalog.js';

// ─── Row builders ──────────────────────────────────────────────────────────

/**
 * Builds a realistic billing_addons row mirroring the real seed shapes.
 * Slug is stored in metadata; name is the display name; entitlements text[];
 * limits jsonb.
 */
function buildAddonRow(overrides: {
    id?: string;
    name?: string;
    description?: string;
    active?: boolean;
    unitAmount?: number;
    billingInterval?: string;
    entitlements?: string[];
    limits?: Record<string, number>;
    metadata?: Record<string, unknown>;
    deletedAt?: Date | null;
}) {
    return {
        id: overrides.id ?? 'addon-read-uuid-001',
        name: overrides.name ?? 'Extra Photos Pack (+20 photos)',
        description: overrides.description ?? 'Adds 20 extra photo slots per accommodation.',
        active: overrides.active ?? true,
        unitAmount: overrides.unitAmount ?? 200000,
        currency: 'ARS',
        billingInterval: overrides.billingInterval ?? 'month',
        billingIntervalCount: 1,
        entitlements: overrides.entitlements ?? [],
        limits: overrides.limits ?? { max_photos_per_accommodation: 20 },
        livemode: false,
        metadata: overrides.metadata ?? {
            slug: 'extra-photos-20',
            durationDays: null,
            targetCategories: ['owner', 'complex'],
            sortOrder: 3
        },
        deletedAt: overrides.deletedAt ?? null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

/**
 * Builds a mock Drizzle client for list queries:
 * select().from().where().orderBy() → rows
 */
function buildListDb(rows: ReturnType<typeof buildAddonRow>[]) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockResolvedValue(rows)
                })
            })
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    };
}

/**
 * Builds a mock Drizzle client for slug lookups:
 * select().from().where().limit(1) → [row] or []
 */
function buildSlugDb(row?: ReturnType<typeof buildAddonRow>) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(row ? [row] : [])
                })
            })
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    };
}

// ─── Realistic seed fixtures ───────────────────────────────────────────────

const VISIBILITY_BOOST = buildAddonRow({
    id: 'addon-vis-boost-t032-001',
    name: 'Visibility Boost (7 days)',
    description: 'Boosts your listing visibility for 7 days.',
    unitAmount: 500000,
    billingInterval: 'one_time',
    // The DB stores EntitlementKey enum VALUES (lowercase), not key names.
    // EntitlementKey.FEATURED_LISTING = 'featured_listing' — this is what the
    // seeder writes and what isEntitlementKey() validates against.
    entitlements: ['featured_listing'],
    limits: {},
    metadata: {
        slug: 'visibility-boost-7d',
        durationDays: 7,
        targetCategories: ['owner', 'complex'],
        sortOrder: 1
    }
});

const EXTRA_PHOTOS = buildAddonRow({
    id: 'addon-extra-photos-t032-002',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 extra photo slots per accommodation.',
    unitAmount: 200000,
    billingInterval: 'month',
    entitlements: [],
    limits: { max_photos_per_accommodation: 20 },
    metadata: {
        slug: 'extra-photos-20',
        durationDays: null,
        targetCategories: ['owner', 'complex'],
        sortOrder: 3
    }
});

const EXTRA_ACCOMMODATION = buildAddonRow({
    id: 'addon-extra-acc-t032-003',
    name: 'Extra Accommodation (+1)',
    description: 'Adds 1 extra accommodation slot.',
    unitAmount: 300000,
    billingInterval: 'month',
    entitlements: [],
    limits: { max_accommodations: 1 },
    metadata: {
        slug: 'extra-accommodation-1',
        durationDays: null,
        targetCategories: ['owner'],
        sortOrder: 2
    }
});

// ─── Tests: list() ────────────────────────────────────────────────────────

describe('addon catalog read path — listAvailableAddons (T-032)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when N seeded-shape rows exist', () => {
        it('should return all addons mapped field-for-field to AddonDefinition', async () => {
            // Arrange
            const rows = [VISIBILITY_BOOST, EXTRA_PHOTOS, EXTRA_ACCOMMODATION];
            mockGetDb.mockReturnValue(buildListDb(rows));

            // Act
            const result = await listAvailableAddons();

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;

            expect(result.data).toHaveLength(3);

            // Field-for-field mapping assertions for VISIBILITY_BOOST
            const visDef = result.data.find((d) => d.slug === 'visibility-boost-7d');
            expect(visDef).toBeDefined();
            expect(visDef?.name).toBe(VISIBILITY_BOOST.name);
            expect(visDef?.description).toBe(VISIBILITY_BOOST.description);
            expect(visDef?.billingType).toBe('one_time'); // billingInterval 'one_time' → 'one_time'
            expect(visDef?.priceArs).toBe(500000);
            expect(visDef?.durationDays).toBe(7);
            // EntitlementKey.FEATURED_LISTING = 'featured_listing' (lowercase enum value)
            expect(visDef?.grantsEntitlement).toBe('featured_listing');
            expect(visDef?.affectsLimitKey).toBeNull();
            expect(visDef?.limitIncrease).toBeNull();
            expect(visDef?.targetCategories).toEqual(['owner', 'complex']);
            expect(visDef?.isActive).toBe(true);
            expect(visDef?.sortOrder).toBe(1);

            // Field-for-field mapping for EXTRA_PHOTOS
            const photoDef = result.data.find((d) => d.slug === 'extra-photos-20');
            expect(photoDef).toBeDefined();
            expect(photoDef?.billingType).toBe('recurring'); // 'month' → 'recurring'
            expect(photoDef?.priceArs).toBe(200000);
            expect(photoDef?.durationDays).toBeNull();
            expect(photoDef?.grantsEntitlement).toBeNull();
            expect(photoDef?.affectsLimitKey).toBe('max_photos_per_accommodation');
            expect(photoDef?.limitIncrease).toBe(20);

            // Field-for-field mapping for EXTRA_ACCOMMODATION (owner-only)
            const accDef = result.data.find((d) => d.slug === 'extra-accommodation-1');
            expect(accDef).toBeDefined();
            expect(accDef?.targetCategories).toEqual(['owner']);
            expect(accDef?.affectsLimitKey).toBe('max_accommodations');
            expect(accDef?.limitIncrease).toBe(1);
        });
    });

    describe('when filtering by billingType', () => {
        it('should return only one_time addons when billingType=one_time', async () => {
            // Arrange — mock returns only the one_time row (filter is applied in DB layer)
            mockGetDb.mockReturnValue(buildListDb([VISIBILITY_BOOST]));

            // Act
            const result = await listAvailableAddons({ billingType: 'one_time' });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.billingType).toBe('one_time');
            expect(result.data[0]?.slug).toBe('visibility-boost-7d');
        });

        it('should return only recurring addons when billingType=recurring', async () => {
            // Arrange
            mockGetDb.mockReturnValue(buildListDb([EXTRA_PHOTOS, EXTRA_ACCOMMODATION]));

            // Act
            const result = await listAvailableAddons({ billingType: 'recurring' });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data).toHaveLength(2);
            expect(result.data.every((d) => d.billingType === 'recurring')).toBe(true);
        });
    });

    describe('when DB throws', () => {
        it('should return INTERNAL_ERROR', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockRejectedValue(new Error('DB unreachable'))
                        })
                    })
                })
            });

            // Act
            const result = await listAvailableAddons();

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // Regression: guard must reject enum KEY NAMES and only accept enum VALUES.
    // Prior to SPEC-145 T-003 the mapper used `as EntitlementKey` which silently
    // passed any string; the guard change exposed this latent bug.
    // Canonical format: lowercase enum values ('featured_listing'), NOT uppercase
    // key names ('FEATURED_LISTING'). The DB seeder always writes the VALUE.
    describe('entitlement key format — regression (SPEC-145 T-003)', () => {
        it('should return null grantsEntitlement when DB row carries uppercase key name instead of value', async () => {
            // Arrange — row with the wrong format (enum KEY name, not VALUE)
            const rowWithWrongFormat = buildAddonRow({
                id: 'addon-wrong-format',
                name: 'Wrong Format Addon',
                entitlements: ['FEATURED_LISTING'], // wrong: key name not value
                limits: {},
                metadata: {
                    slug: 'wrong-format-addon',
                    durationDays: null,
                    targetCategories: ['owner'],
                    sortOrder: 99
                }
            });
            mockGetDb.mockReturnValue(buildListDb([rowWithWrongFormat]));

            // Act
            const result = await listAvailableAddons();

            // Assert — guard correctly filters out the non-canonical uppercase string
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data[0]?.grantsEntitlement).toBeNull();
        });

        it('should return correct grantsEntitlement when DB row carries lowercase enum value', async () => {
            // Arrange — row with the correct format (enum VALUE, not KEY name)
            const rowWithCorrectFormat = buildAddonRow({
                id: 'addon-correct-format',
                name: 'Correct Format Addon',
                entitlements: ['featured_listing'], // correct: lowercase enum VALUE
                limits: {},
                metadata: {
                    slug: 'correct-format-addon',
                    durationDays: null,
                    targetCategories: ['owner'],
                    sortOrder: 99
                }
            });
            mockGetDb.mockReturnValue(buildListDb([rowWithCorrectFormat]));

            // Act
            const result = await listAvailableAddons();

            // Assert — guard accepts the canonical lowercase value
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data[0]?.grantsEntitlement).toBe('featured_listing');
        });
    });
});

// ─── Tests: getBySlug() / getAddonCatalogEntry() ──────────────────────────

describe('addon catalog read path — getAddonCatalogEntry (T-032)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when slug matches an existing row', () => {
        it('should return the correct AddonDefinition for visibility-boost-7d', async () => {
            // Arrange
            mockGetDb.mockReturnValue(buildSlugDb(VISIBILITY_BOOST));

            // Act
            const result = await getAddonCatalogEntry('visibility-boost-7d');

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.slug).toBe('visibility-boost-7d');
            expect(result.data.billingType).toBe('one_time');
            expect(result.data.priceArs).toBe(500000);
            expect(result.data.durationDays).toBe(7);
            // EntitlementKey.FEATURED_LISTING = 'featured_listing' (lowercase enum value)
            expect(result.data.grantsEntitlement).toBe('featured_listing');
        });

        it('should return the correct AddonDefinition for extra-photos-20', async () => {
            // Arrange
            mockGetDb.mockReturnValue(buildSlugDb(EXTRA_PHOTOS));

            // Act
            const result = await getAddonCatalogEntry('extra-photos-20');

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.slug).toBe('extra-photos-20');
            expect(result.data.billingType).toBe('recurring');
            expect(result.data.affectsLimitKey).toBe('max_photos_per_accommodation');
            expect(result.data.limitIncrease).toBe(20);
            expect(result.data.grantsEntitlement).toBeNull();
        });

        it('should return the correct AddonDefinition for extra-accommodation-1', async () => {
            // Arrange
            mockGetDb.mockReturnValue(buildSlugDb(EXTRA_ACCOMMODATION));

            // Act
            const result = await getAddonCatalogEntry('extra-accommodation-1');

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.slug).toBe('extra-accommodation-1');
            expect(result.data.targetCategories).toEqual(['owner']);
            expect(result.data.affectsLimitKey).toBe('max_accommodations');
        });
    });

    describe('when slug does not match any row', () => {
        it('should return NOT_FOUND for an unknown slug', async () => {
            // Arrange — DB returns no row (empty array)
            mockGetDb.mockReturnValue(buildSlugDb(undefined));

            // Act
            const result = await getAddonCatalogEntry('no-such-addon-slug');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            // AddonCatalogService.getBySlug documents NOT_FOUND for missing rows
            expect(result.error.code).toBe('NOT_FOUND');
            expect(result.error.message).toContain('no-such-addon-slug');
        });
    });

    describe('when DB throws', () => {
        it('should return INTERNAL_ERROR', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('connection reset'))
                        })
                    })
                })
            });

            // Act
            const result = await getAddonCatalogEntry('any-slug');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
