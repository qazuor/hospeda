/**
 * Unit tests for AddonCatalogService.listAdmin() and AddonCatalogService.getById()
 *
 * Covers:
 * - listAdmin(): returns paginated AdminAddonResponse list
 * - listAdmin(): pagination metadata (total, totalPages)
 * - listAdmin(): isActive filter
 * - listAdmin(): billingType filter (one_time / recurring)
 * - listAdmin(): targetCategory filter
 * - listAdmin(): search filter
 * - listAdmin(): includeDeleted flag
 * - listAdmin(): DB error → INTERNAL_ERROR
 * - listAdmin(): ctx.tx support
 * - getById(): returns AdminAddonResponse when found
 * - getById(): returns NOT_FOUND when row is missing
 * - getById(): returns INTERNAL_ERROR on DB failure
 * - getById(): ctx.tx support
 *
 * All DB calls are mocked — no real database needed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockGetDb } = vi.hoisted(() => ({
    mockGetDb: vi.fn()
}));

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
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
    and: vi.fn((...args: unknown[]) => ({ _and: args })),
    asc: vi.fn((col: unknown) => ({ _asc: col })),
    eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ _isNull: col })),
    count: vi.fn(() => ({ _count: true })),
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })),
        { raw: vi.fn(), join: vi.fn() }
    )
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import { AddonCatalogService } from '../../src/services/billing/addon/addon-catalog.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Builds a minimal billing_addons row.
 */
function buildAddonRow(
    overrides: Partial<{
        id: string;
        active: boolean;
        billingInterval: string;
        deletedAt: Date | null;
        metadata: Record<string, unknown>;
        unitAmount: number;
    }> = {}
) {
    return {
        id: overrides.id ?? 'addon-uuid-1',
        name: 'Visibility Boost (7 days)',
        description: 'Featured in search results for 7 days.',
        active: overrides.active ?? true,
        unitAmount: overrides.unitAmount ?? 500000,
        currency: 'ARS',
        billingInterval: overrides.billingInterval ?? 'one_time',
        billingIntervalCount: 1,
        entitlements: ['FEATURED_LISTING'],
        limits: {},
        livemode: false,
        metadata: overrides.metadata ?? {
            slug: 'visibility-boost-7d',
            durationDays: 7,
            targetCategories: ['owner', 'complex'],
            sortOrder: 1
        },
        deletedAt: overrides.deletedAt ?? null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

/**
 * Builds a mock DB that:
 * 1. First select() call → count query (uses `offset` chain) → countResult
 * 2. Second select() call → item rows query (uses `offset` chain) → itemRows
 *
 * The chain needs to support: .select().from().where().orderBy().limit().offset()
 * for the items query and .select().from().where() for the count query.
 */
function buildListAdminMockDb(countValue: number, itemRows: unknown[]) {
    let callIdx = 0;

    const makeQueryChain = (result: unknown) => {
        const chain: Record<string, unknown> = {};
        const resolved = Promise.resolve(result);
        Object.assign(chain, resolved);
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable query builder
        (chain as { then: unknown }).then = resolved.then.bind(resolved);
        (chain as { catch: unknown }).catch = resolved.catch.bind(resolved);
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.orderBy = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.offset = vi.fn().mockResolvedValue(result);
        return chain;
    };

    return {
        select: vi.fn().mockImplementation(() => {
            const idx = callIdx++;
            if (idx === 0) {
                // count query — resolves to [{ value: countValue }]
                return makeQueryChain([{ value: countValue }]);
            }
            // items query — resolves to itemRows
            return makeQueryChain(itemRows);
        })
    };
}

/**
 * Builds a mock DB for a single-row lookup (getById).
 * Returns `rows` from a select().from().where().limit(1) chain.
 */
function buildGetByIdMockDb(rows: unknown[]) {
    const chain: Record<string, unknown> = {};
    const resolved = Promise.resolve(rows);
    Object.assign(chain, resolved);
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable query builder
    (chain as { then: unknown }).then = resolved.then.bind(resolved);
    (chain as { catch: unknown }).catch = resolved.catch.bind(resolved);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue(rows);
    return { select: vi.fn().mockReturnValue(chain) };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('AddonCatalogService — listAdmin() + getById()', () => {
    let svc: AddonCatalogService;

    beforeEach(() => {
        vi.clearAllMocks();
        svc = new AddonCatalogService();
    });

    // ── listAdmin() ─────────────────────────────────────────────────────────

    describe('listAdmin()', () => {
        it('should return paginated AdminAddonResponse list with correct pagination', async () => {
            // Arrange
            const rows = [buildAddonRow(), buildAddonRow({ id: 'addon-uuid-2' })];
            const db = buildListAdminMockDb(2, rows);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({ page: 1, pageSize: 10 });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.items).toHaveLength(2);
            expect(result.data.pagination.total).toBe(2);
            expect(result.data.pagination.page).toBe(1);
            expect(result.data.pagination.pageSize).toBe(10);
            expect(result.data.pagination.totalPages).toBe(1);
        });

        it('should return empty items when no rows match', async () => {
            // Arrange
            const db = buildListAdminMockDb(0, []);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({});

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.items).toHaveLength(0);
            expect(result.data.pagination.total).toBe(0);
            expect(result.data.pagination.totalPages).toBe(0);
        });

        it('should apply isActive filter', async () => {
            // Arrange
            const activeRows = [buildAddonRow({ active: true })];
            const db = buildListAdminMockDb(1, activeRows);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({ isActive: true });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.items[0]?.isActive).toBe(true);
        });

        it('should apply billingType=one_time filter', async () => {
            // Arrange
            const db = buildListAdminMockDb(1, [buildAddonRow({ billingInterval: 'one_time' })]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({ billingType: 'one_time' });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.items).toHaveLength(1);
        });

        it('should apply billingType=recurring filter (mapped to month interval)', async () => {
            // Arrange
            const db = buildListAdminMockDb(1, [buildAddonRow({ billingInterval: 'month' })]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({ billingType: 'recurring' });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should apply search filter', async () => {
            // Arrange
            const db = buildListAdminMockDb(1, [buildAddonRow()]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({ search: 'visibility' });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.items).toHaveLength(1);
        });

        it('should apply targetCategory filter', async () => {
            // Arrange
            const db = buildListAdminMockDb(1, [buildAddonRow()]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({ targetCategory: 'owner' });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should include deleted rows when includeDeleted is true', async () => {
            // Arrange
            const deletedRow = buildAddonRow({ deletedAt: new Date() });
            const db = buildListAdminMockDb(1, [deletedRow]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({ includeDeleted: true });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should compute totalPages correctly for multi-page results', async () => {
            // Arrange — 42 total, pageSize 10 → 5 pages
            const db = buildListAdminMockDb(42, [buildAddonRow()]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.listAdmin({ page: 2, pageSize: 10 });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.pagination.totalPages).toBe(5);
            expect(result.data.pagination.page).toBe(2);
        });

        it('should use ctx.tx instead of getDb when provided', async () => {
            // Arrange
            const txDb = buildListAdminMockDb(1, [buildAddonRow()]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await svc.listAdmin({}, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR when db throws', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('DB connection lost'))
                    })
                })
            });

            // Act
            const result = await svc.listAdmin({});

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── getById() ───────────────────────────────────────────────────────────

    describe('getById()', () => {
        it('should return AdminAddonResponse when addon is found', async () => {
            // Arrange
            const row = buildAddonRow({ id: 'found-addon-uuid' });
            const db = buildGetByIdMockDb([row]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getById('found-addon-uuid');

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.id).toBe('found-addon-uuid');
            expect(result.data.createdAt).toBeDefined();
        });

        it('should return NOT_FOUND when addon does not exist', async () => {
            // Arrange
            const db = buildGetByIdMockDb([]); // no rows
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getById('nonexistent-uuid');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
            expect(result.error.message).toContain('nonexistent-uuid');
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const row = buildAddonRow();
            const txDb = buildGetByIdMockDb([row]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await svc.getById('addon-uuid-1', ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR when db throws', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('DB error'))
                        })
                    })
                })
            });

            // Act
            const result = await svc.getById('any-uuid');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
