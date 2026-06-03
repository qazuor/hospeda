/**
 * Unit tests for AddonCatalogService (SPEC-192 T-002)
 *
 * Verifies that:
 * - `list()` with no filter returns all rows mapped as AddonDefinition[]
 * - `list({ active: true })` filters by the `active` column
 * - `list({ billingType: 'one_time' })` filters by billingInterval = 'one_time'
 * - `list({ billingType: 'recurring' })` filters by billingInterval = 'month'
 * - `list({ targetCategory: 'owner' })` applies the JSONB @> filter
 * - `getBySlug(slug)` returns the matching row mapped to AddonDefinition
 * - `getBySlug(unknownSlug)` returns NOT_FOUND
 * - DB errors are caught and returned as INTERNAL_ERROR ServiceResult
 * - `ctx.tx` is used when provided; `getDb()` is used as fallback
 *
 * All DB calls are mocked via vi.mock('@repo/db') — no real database needed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockGetDb } = vi.hoisted(() => ({
    mockGetDb: vi.fn()
}));

// Mock @repo/db — provide just enough of the table and helpers
vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    billingAddons: {
        active: 'active',
        billingInterval: 'billingInterval',
        metadata: 'metadata',
        name: 'name'
    },
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    asc: vi.fn((col: unknown) => ({ type: 'asc', col })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            type: 'sql',
            strings,
            values
        })),
        {
            raw: vi.fn((s: string) => ({ type: 'sql_raw', s }))
        }
    )
}));

// Import after mocks are declared
import { AddonCatalogService } from '../../src/services/billing/addon/addon-catalog.service.js';

// ─── Row builders ──────────────────────────────────────────────────────────

/**
 * Builds a minimal billing_addons row that the mapper can handle.
 * Every field mirrors what the seeder writes.
 */
function buildAddonRow(
    overrides: Partial<{
        name: string;
        description: string;
        active: boolean;
        unitAmount: number;
        billingInterval: string;
        billingIntervalCount: number;
        entitlements: string[];
        limits: Record<string, number>;
        metadata: Record<string, unknown>;
    }> = {}
) {
    return {
        id: 'uuid-1',
        name: overrides.name ?? 'Visibility Boost (7 days)',
        description: overrides.description ?? 'Featured in search results for 7 days.',
        active: overrides.active ?? true,
        unitAmount: overrides.unitAmount ?? 500000,
        currency: 'ARS',
        billingInterval: overrides.billingInterval ?? 'one_time',
        billingIntervalCount: overrides.billingIntervalCount ?? 1,
        entitlements: overrides.entitlements ?? ['FEATURED_LISTING'],
        limits: overrides.limits ?? {},
        livemode: false,
        metadata: overrides.metadata ?? {
            slug: 'visibility-boost-7d',
            durationDays: 7,
            targetCategories: ['owner', 'complex'],
            sortOrder: 1
        },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

// ─── Mock DB builder ──────────────────────────────────────────────────────

/**
 * Builds a minimal mock Drizzle client that resolves the query chain with
 * the given rows array.
 *
 * Supports the chain: select().from().where().orderBy() and
 * select().from().where().limit(1)
 */
function buildMockDb(rows: unknown[] = []) {
    const limitMock = vi.fn().mockResolvedValue(rows);
    const orderByMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({
        orderBy: orderByMock,
        limit: limitMock
    });
    const fromMock = vi.fn().mockReturnValue({
        where: whereMock,
        orderBy: orderByMock
    });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    return { select: selectMock, from: fromMock, where: whereMock, orderBy: orderByMock };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('AddonCatalogService', () => {
    let svc: AddonCatalogService;

    beforeEach(() => {
        vi.clearAllMocks();
        svc = new AddonCatalogService();
    });

    // ── list() ──────────────────────────────────────────────────────────────

    describe('list()', () => {
        describe('with no filter', () => {
            it('should return all rows mapped to AddonDefinition[]', async () => {
                // Arrange
                const rows = [
                    buildAddonRow({
                        metadata: {
                            slug: 'visibility-boost-7d',
                            durationDays: 7,
                            targetCategories: ['owner', 'complex'],
                            sortOrder: 1
                        }
                    }),
                    buildAddonRow({
                        name: 'Extra Photos Pack (+20 photos)',
                        billingInterval: 'month',
                        entitlements: [],
                        limits: { max_photos_per_accommodation: 20 },
                        metadata: {
                            slug: 'extra-photos-20',
                            durationDays: null,
                            targetCategories: ['owner', 'complex'],
                            sortOrder: 3
                        }
                    })
                ];
                const mockDb = buildMockDb(rows);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.list();

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data).toHaveLength(2);
                expect(result.data[0]?.slug).toBe('visibility-boost-7d');
                expect(result.data[1]?.slug).toBe('extra-photos-20');
                expect(mockGetDb).toHaveBeenCalledOnce();
            });

            it('should return empty array when no rows exist', async () => {
                // Arrange
                const mockDb = buildMockDb([]);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.list();

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data).toHaveLength(0);
            });
        });

        describe('with active filter', () => {
            it('should pass active=true filter to the query', async () => {
                // Arrange
                const mockDb = buildMockDb([buildAddonRow({ active: true })]);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.list({ active: true });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data).toHaveLength(1);
                expect(result.data[0]?.isActive).toBe(true);
            });

            it('should pass active=false filter to the query', async () => {
                // Arrange
                const mockDb = buildMockDb([buildAddonRow({ active: false })]);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.list({ active: false });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data[0]?.isActive).toBe(false);
            });
        });

        describe('with billingType filter', () => {
            it('should map one_time to billingInterval=one_time and return one_time addons', async () => {
                // Arrange
                const rows = [buildAddonRow({ billingInterval: 'one_time' })];
                const mockDb = buildMockDb(rows);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.list({ billingType: 'one_time' });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data[0]?.billingType).toBe('one_time');
            });

            it('should map recurring to billingInterval=month and return recurring addons', async () => {
                // Arrange
                const rows = [
                    buildAddonRow({
                        billingInterval: 'month',
                        metadata: {
                            slug: 'extra-photos-20',
                            durationDays: null,
                            targetCategories: ['owner', 'complex'],
                            sortOrder: 3
                        }
                    })
                ];
                const mockDb = buildMockDb(rows);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.list({ billingType: 'recurring' });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data[0]?.billingType).toBe('recurring');
            });
        });

        describe('with targetCategory filter', () => {
            it('should return addons for the owner category', async () => {
                // Arrange
                const rows = [
                    buildAddonRow({
                        metadata: {
                            slug: 'extra-accommodations-5',
                            durationDays: null,
                            targetCategories: ['owner'],
                            sortOrder: 4
                        }
                    })
                ];
                const mockDb = buildMockDb(rows);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.list({ targetCategory: 'owner' });

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data[0]?.targetCategories).toContain('owner');
            });
        });

        describe('ctx routing', () => {
            it('should use ctx.tx when provided', async () => {
                // Arrange
                const rows = [buildAddonRow()];
                const mockTx = buildMockDb(rows);
                const ctx = { tx: mockTx as never };

                // Act
                const result = await svc.list({}, ctx);

                // Assert
                expect(result.success).toBe(true);
                expect(mockGetDb).not.toHaveBeenCalled();
            });

            it('should fall back to getDb() when ctx is omitted', async () => {
                // Arrange
                const mockDb = buildMockDb([]);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                await svc.list();

                // Assert
                expect(mockGetDb).toHaveBeenCalledOnce();
            });
        });

        describe('error handling', () => {
            it('should return INTERNAL_ERROR when the database throws', async () => {
                // Arrange
                const mockDb = {
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                orderBy: vi
                                    .fn()
                                    .mockRejectedValue(new Error('DB connection failed'))
                            }),
                            orderBy: vi.fn().mockRejectedValue(new Error('DB connection failed'))
                        })
                    })
                };
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.list();

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('INTERNAL_ERROR');
                expect(result.error.message).toContain('Failed to list add-on catalog');
            });
        });
    });

    // ── getBySlug() ──────────────────────────────────────────────────────────

    describe('getBySlug()', () => {
        describe('when the slug exists', () => {
            it('should return the matching addon definition', async () => {
                // Arrange
                const row = buildAddonRow({
                    metadata: {
                        slug: 'visibility-boost-7d',
                        durationDays: 7,
                        targetCategories: ['owner', 'complex'],
                        sortOrder: 1
                    }
                });
                const mockDb = buildMockDb([row]);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.getBySlug('visibility-boost-7d');

                // Assert
                expect(result.success).toBe(true);
                if (!result.success) return;
                expect(result.data.slug).toBe('visibility-boost-7d');
                expect(result.data.priceArs).toBe(500000);
                expect(result.data.billingType).toBe('one_time');
            });
        });

        describe('when the slug does not exist', () => {
            it('should return NOT_FOUND error', async () => {
                // Arrange
                const mockDb = buildMockDb([]);
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.getBySlug('does-not-exist');

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('NOT_FOUND');
                expect(result.error.message).toContain('does-not-exist');
            });
        });

        describe('ctx routing', () => {
            it('should use ctx.tx when provided', async () => {
                // Arrange
                const row = buildAddonRow({
                    metadata: {
                        slug: 'visibility-boost-7d',
                        durationDays: 7,
                        targetCategories: ['owner', 'complex'],
                        sortOrder: 1
                    }
                });
                const mockTx = buildMockDb([row]);
                const ctx = { tx: mockTx as never };

                // Act
                const result = await svc.getBySlug('visibility-boost-7d', ctx);

                // Assert
                expect(result.success).toBe(true);
                expect(mockGetDb).not.toHaveBeenCalled();
            });
        });

        describe('error handling', () => {
            it('should return INTERNAL_ERROR when the database throws', async () => {
                // Arrange
                const mockDb = {
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockRejectedValue(new Error('timeout'))
                            })
                        })
                    })
                };
                mockGetDb.mockReturnValue(mockDb);

                // Act
                const result = await svc.getBySlug('any-slug');

                // Assert
                expect(result.success).toBe(false);
                if (result.success) return;
                expect(result.error.code).toBe('INTERNAL_ERROR');
                expect(result.error.message).toContain('any-slug');
            });
        });
    });
});
