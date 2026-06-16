/**
 * Unit tests for billing plan CRUD functions (plan.crud.ts)
 *
 * Covers:
 * - mapDbToPlan: field mapping logic
 * - listPlans: filters, pagination, ctx.tx threading
 * - getPlanById: found / NOT_FOUND / ctx threading
 * - getPlanBySlug: found / NOT_FOUND / ctx threading
 * - createPlan: happy path / duplicate slug / annual price handling / ctx threading
 * - updatePlan: NOT_FOUND / monthly price update / annual price deactivation / ctx
 * - togglePlanActive: activate / deactivate / NOT_FOUND
 * - softDeletePlan: happy path / NOT_FOUND
 * - restorePlan: happy path / NOT_FOUND / VALIDATION_ERROR (not deleted)
 * - hardDeletePlan: happy path / NOT_FOUND / blocked by subscriptions
 *
 * All DB calls are mocked — no real database needed.
 * The plan.audit module is mocked so we can verify audit calls without
 * needing a running DB.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockGetDb, mockWithTransaction } = vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockWithTransaction: vi.fn()
}));

const { mockInsertPlanAuditLog, mockDiffPlanFields } = vi.hoisted(() => ({
    mockInsertPlanAuditLog: vi.fn().mockResolvedValue(undefined),
    mockDiffPlanFields: vi.fn().mockReturnValue({ added: {}, removed: {}, changed: {} })
}));

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    withTransaction: mockWithTransaction,
    billingPlans: {
        id: 'id',
        name: 'name',
        description: 'description',
        active: 'active',
        deletedAt: 'deletedAt',
        entitlements: 'entitlements',
        limits: 'limits',
        livemode: 'livemode',
        metadata: 'metadata'
    },
    billingPrices: {
        id: 'id',
        planId: 'planId',
        billingInterval: 'billingInterval',
        unitAmount: 'unitAmount',
        active: 'active'
    },
    billingSubscriptions: {
        planId: 'planId',
        status: 'status',
        deletedAt: 'deletedAt'
    },
    billingAuditLogs: { id: 'id' },
    and: vi.fn((...args: unknown[]) => ({ _and: args })),
    asc: vi.fn((col: unknown) => ({ _asc: col })),
    eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ _isNull: col })),
    count: vi.fn(() => ({ _count: true })),
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })),
        {
            join: vi.fn((_parts: unknown[], _sep: unknown) => ({ _sqlJoin: true }))
        }
    )
}));

vi.mock('../../src/services/billing/plan/plan.audit.js', () => ({
    insertPlanAuditLog: mockInsertPlanAuditLog,
    diffPlanFields: mockDiffPlanFields
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import {
    createPlan,
    getPlanById,
    getPlanBySlug,
    hardDeletePlan,
    listPlans,
    mapDbToPlan,
    restorePlan,
    softDeletePlan,
    togglePlanActive,
    updatePlan
} from '../../src/services/billing/plan/plan.crud.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makePlanRow(
    overrides: Partial<{
        id: string;
        name: string;
        description: string;
        active: boolean;
        deletedAt: Date | null;
        livemode: boolean;
        metadata: Record<string, unknown>;
        entitlements: string[];
        limits: Record<string, number>;
    }> = {}
): Record<string, unknown> {
    return {
        id: 'plan-uuid-1',
        name: overrides.name ?? 'owner-basico',
        description: overrides.description ?? 'Plan básico',
        active: overrides.active ?? true,
        deletedAt: overrides.deletedAt ?? null,
        livemode: overrides.livemode ?? false,
        metadata: overrides.metadata ?? {
            displayName: 'Básico',
            category: 'owner',
            isDefault: false,
            sortOrder: 1,
            trialDays: 0,
            hasTrial: false,
            monthlyPriceArs: 500000,
            annualPriceArs: null,
            monthlyPriceUsdRef: 5
        },
        entitlements: overrides.entitlements ?? ['CAN_LIST_ACCOMMODATION'],
        limits: overrides.limits ?? { MAX_ACCOMMODATIONS: 1 },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        ...overrides
    };
}

function makePriceRow(
    overrides: Partial<{
        id: string;
        planId: string;
        billingInterval: string;
        unitAmount: number;
        active: boolean;
    }> = {}
): Record<string, unknown> {
    return {
        id: 'price-uuid-1',
        planId: 'plan-uuid-1',
        billingInterval: overrides.billingInterval ?? 'month',
        unitAmount: overrides.unitAmount ?? 500000,
        currency: 'ARS',
        intervalCount: 1,
        active: overrides.active ?? true,
        livemode: false,
        trialDays: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        ...overrides
    };
}

/**
 * Builds a mock Drizzle chain that resolves with the given result for the
 * *terminal* call. Supports select/from/where/limit/offset/orderBy/groupBy,
 * insert/values/returning, update/set/where/returning, delete/where.
 *
 * `resolvesTo` is what `returning()`, `offset()`, or the terminal await resolves to.
 */
function makeChain(resolvesTo: unknown = []) {
    const chain: Record<string, unknown> = {};

    const resolved = Promise.resolve(resolvesTo);

    // Terminal methods that resolve
    chain.returning = vi.fn().mockResolvedValue(resolvesTo);
    chain.offset = vi.fn().mockResolvedValue(resolvesTo);
    chain.execute = vi.fn().mockResolvedValue(resolvesTo);

    // Intermediate methods return chain
    const methods = [
        'select',
        'from',
        'where',
        'orderBy',
        'limit',
        'groupBy',
        'insert',
        'values',
        'update',
        'set',
        'delete',
        'for'
    ];
    for (const m of methods) {
        chain[m] = vi.fn().mockReturnValue(chain);
    }

    // Make the chain itself awaitable (resolves to resolvesTo)
    Object.assign(chain, resolved);
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable query builder
    (chain as { then: unknown }).then = resolved.then.bind(resolved);
    (chain as { catch: unknown }).catch = resolved.catch.bind(resolved);

    return chain;
}

/**
 * Builds a mock DB client that returns different chain results per call sequence.
 * `selectResults` is an array of values; each successive `.select()` call
 * returns the next one.
 */
function buildMockDb(
    selectResults: unknown[] = [],
    insertResult: unknown[] = [],
    updateResult: unknown[] = [],
    deleteResult: unknown[] = []
) {
    let selectIdx = 0;
    let insertIdx = 0;
    let updateIdx = 0;
    let deleteIdx = 0;

    return {
        select: vi.fn().mockImplementation(() => {
            const result = selectResults[selectIdx] ?? [];
            selectIdx++;
            return makeChain(result);
        }),
        insert: vi.fn().mockImplementation(() => {
            const result = insertResult[insertIdx] ?? [];
            insertIdx++;
            return makeChain(result);
        }),
        update: vi.fn().mockImplementation(() => {
            const result = updateResult[updateIdx] ?? [];
            updateIdx++;
            return makeChain(result);
        }),
        delete: vi.fn().mockImplementation(() => {
            const result = deleteResult[deleteIdx] ?? [];
            deleteIdx++;
            return makeChain(result);
        })
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('plan.crud', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default withTransaction: runs the callback synchronously with a fake db
        mockWithTransaction.mockImplementation(async (fn: (db: unknown) => Promise<unknown>) => {
            const db = buildMockDb([], [], [], []);
            return fn(db);
        });
    });

    // ── mapDbToPlan ─────────────────────────────────────────────────────────

    describe('mapDbToPlan()', () => {
        it('should map metadata fields correctly', () => {
            // Arrange
            const planRow = makePlanRow({
                metadata: {
                    displayName: 'Básico',
                    category: 'owner',
                    isDefault: true,
                    sortOrder: 2,
                    trialDays: 14,
                    hasTrial: true,
                    monthlyPriceArs: 500000,
                    annualPriceArs: 5000000,
                    monthlyPriceUsdRef: 5
                }
            });
            const prices = [
                makePriceRow({ billingInterval: 'month', unitAmount: 500000 }),
                makePriceRow({ billingInterval: 'year', unitAmount: 5000000 })
            ];

            // Act
            const result = mapDbToPlan(
                planRow as unknown as Parameters<typeof mapDbToPlan>[0],
                prices as unknown as Parameters<typeof mapDbToPlan>[1]
            );

            // Assert
            expect(result.slug).toBe('owner-basico');
            expect(result.name).toBe('Básico');
            expect(result.category).toBe('owner');
            expect(result.isDefault).toBe(true);
            expect(result.sortOrder).toBe(2);
            expect(result.trialDays).toBe(14);
            expect(result.hasTrial).toBe(true);
            expect(result.monthlyPriceArs).toBe(500000);
            expect(result.annualPriceArs).toBe(5000000);
            expect(result.monthlyPriceUsdRef).toBe(5);
            expect(result.isActive).toBe(true);
            expect(result.entitlements).toEqual(['CAN_LIST_ACCOMMODATION']);
        });

        it('should fall back to plan name when displayName is missing from metadata', () => {
            // Arrange
            const planRow = makePlanRow({ name: 'owner-basico', metadata: {} });

            // Act
            const result = mapDbToPlan(planRow as unknown as Parameters<typeof mapDbToPlan>[0], []);

            // Assert
            expect(result.name).toBe('owner-basico');
        });

        it('should set monthlyPriceArs to 0 when no active monthly price exists', () => {
            // Arrange
            const planRow = makePlanRow();

            // Act
            const result = mapDbToPlan(
                planRow as unknown as Parameters<typeof mapDbToPlan>[0],
                [] // no prices
            );

            // Assert
            expect(result.monthlyPriceArs).toBe(0);
            expect(result.annualPriceArs).toBeNull();
        });

        it('should only include active prices', () => {
            // Arrange
            const planRow = makePlanRow();
            const prices = [
                makePriceRow({ billingInterval: 'month', unitAmount: 999, active: false }),
                makePriceRow({ billingInterval: 'month', unitAmount: 500000, active: true })
            ];

            // Act
            const result = mapDbToPlan(
                planRow as unknown as Parameters<typeof mapDbToPlan>[0],
                prices as unknown as Parameters<typeof mapDbToPlan>[1]
            );

            // Assert — inactive price is ignored
            expect(result.monthlyPriceArs).toBe(500000);
        });

        it('should use updatedAt as createdAt fallback when updatedAt is null', () => {
            // Arrange
            const createdAt = new Date('2025-03-01T00:00:00.000Z');
            const planRow = { ...makePlanRow(), createdAt, updatedAt: null };

            // Act
            const result = mapDbToPlan(planRow as unknown as Parameters<typeof mapDbToPlan>[0], []);

            // Assert
            expect(result.updatedAt).toBe(createdAt.toISOString());
        });

        it('should default metadata fields when they are absent', () => {
            // Arrange
            const planRow = makePlanRow({ metadata: {} });

            // Act
            const result = mapDbToPlan(planRow as unknown as Parameters<typeof mapDbToPlan>[0], []);

            // Assert
            expect(result.hasTrial).toBe(false);
            expect(result.trialDays).toBe(0);
            expect(result.isDefault).toBe(false);
            expect(result.sortOrder).toBe(0);
            expect(result.monthlyPriceUsdRef).toBe(0);
        });
    });

    // ── listPlans ───────────────────────────────────────────────────────────

    describe('listPlans()', () => {
        it('should return paginated plans using getDb() when no ctx is provided', async () => {
            // Arrange
            const planRow = makePlanRow();
            const priceRow = makePriceRow();
            const db = buildMockDb([
                [{ value: 1 }], // count query
                [planRow], // plan rows
                [priceRow], // price rows
                [{ planId: 'plan-uuid-1', value: 2 }] // subscription count
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await listPlans({});

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
            if (!result.success) return;
            expect(result.data.items).toHaveLength(1);
            expect(result.data.pagination.total).toBe(1);
            expect(result.data.items[0]?.slug).toBe('owner-basico');
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const planRow = makePlanRow();
            const priceRow = makePriceRow();
            const txDb = buildMockDb([[{ value: 1 }], [planRow], [priceRow], []]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await listPlans({}, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should return empty list when no plans match', async () => {
            // Arrange
            const db = buildMockDb([[{ value: 0 }], []]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await listPlans({});

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.items).toHaveLength(0);
            expect(result.data.pagination.total).toBe(0);
        });

        it('should compute totalPages correctly', async () => {
            // Arrange
            const db = buildMockDb([[{ value: 0 }], []]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await listPlans({ page: 1, pageSize: 10 });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.pagination.totalPages).toBe(0);
        });

        it('should include activeSubscriptionCount from grouped query', async () => {
            // Arrange
            const planRow = makePlanRow();
            const priceRow = makePriceRow();
            const db = buildMockDb([
                [{ value: 1 }],
                [planRow],
                [priceRow],
                [{ planId: 'plan-uuid-1', value: 5 }]
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await listPlans({});

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.items[0]?.activeSubscriptionCount).toBe(5);
        });

        it('should return INTERNAL_ERROR when db throws', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('db failure'))
                    })
                })
            });

            // Act
            const result = await listPlans({});

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── getPlanById ─────────────────────────────────────────────────────────

    describe('getPlanById()', () => {
        it('should return plan with prices when found', async () => {
            // Arrange
            const planRow = makePlanRow();
            const priceRow = makePriceRow();
            const db = buildMockDb([[planRow], [priceRow]]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await getPlanById('plan-uuid-1');

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.slug).toBe('owner-basico');
            expect(result.data.monthlyPriceArs).toBe(500000);
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            // Arrange
            const db = buildMockDb([[]]); // no plan row
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await getPlanById('missing-uuid');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const planRow = makePlanRow();
            const txDb = buildMockDb([[planRow], []]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await getPlanById('plan-uuid-1', ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR on db failure', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('fail'))
                        })
                    })
                })
            });

            // Act
            const result = await getPlanById('plan-uuid-1');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── getPlanBySlug ───────────────────────────────────────────────────────

    describe('getPlanBySlug()', () => {
        it('should return plan when found by slug', async () => {
            // Arrange
            const planRow = makePlanRow({ name: 'owner-basico' });
            const db = buildMockDb([[planRow], []]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await getPlanBySlug('owner-basico');

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.slug).toBe('owner-basico');
        });

        it('should return NOT_FOUND when slug does not exist', async () => {
            // Arrange
            const db = buildMockDb([[]]); // no plan row
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await getPlanBySlug('nonexistent-slug');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
            expect(result.error.message).toContain('nonexistent-slug');
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const planRow = makePlanRow();
            const txDb = buildMockDb([[planRow], []]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await getPlanBySlug('owner-basico', ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR on db failure', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('fail'))
                        })
                    })
                })
            });

            // Act
            const result = await getPlanBySlug('owner-basico');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── createPlan ──────────────────────────────────────────────────────────

    describe('createPlan()', () => {
        const baseInput = {
            slug: 'owner-basico',
            name: 'Básico',
            description: 'Plan básico',
            category: 'owner' as const,
            monthlyPriceArs: 500000,
            annualPriceArs: null,
            monthlyPriceUsdRef: 5,
            hasTrial: false,
            trialDays: 0,
            isDefault: false,
            sortOrder: 1,
            entitlements: ['CAN_LIST_ACCOMMODATION'] as string[],
            limits: { MAX_ACCOMMODATIONS: 1 },
            isActive: true
        };

        it('should create plan and return BillingPlanResponse', async () => {
            // Arrange
            const planRow = makePlanRow();
            const priceRow = makePriceRow();
            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb(
                        [
                            [], // no duplicate check (empty)
                            [priceRow]
                        ], // price rows after insert
                        [[planRow]] // insert plan returns
                    );
                    return fn(db);
                }
            );

            // Act
            const result = await createPlan(baseInput);

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.slug).toBe('owner-basico');
            expect(mockInsertPlanAuditLog).toHaveBeenCalledOnce();
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const planRow = makePlanRow();
            const priceRow = makePriceRow();
            const txDb = buildMockDb(
                [
                    [], // no duplicate
                    [priceRow]
                ], // prices
                [[planRow]] // inserted plan
            );
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await createPlan(baseInput, {}, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should return ALREADY_EXISTS when slug is duplicate', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[{ id: 'existing-uuid' }]]); // duplicate found
                    return fn(db);
                }
            );

            // Act
            const result = await createPlan(baseInput);

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('ALREADY_EXISTS');
            expect(result.error.message).toContain(baseInput.slug);
        });

        it('should also insert annual price when annualPriceArs > 0', async () => {
            // Arrange
            const planRow = makePlanRow();
            const monthlyPrice = makePriceRow({ billingInterval: 'month' });
            const annualPrice = makePriceRow({ billingInterval: 'year', unitAmount: 5000000 });

            // Use withTransaction so we control the full flow via a single tx mock.
            // Sequence of DB calls inside createPlan (with annual):
            //   select (duplicate) → []
            //   insert billingPlans → [planRow]
            //   insert billingPrices (monthly) → (no returning used)
            //   insert billingPrices (annual)  → (no returning used)
            //   insert billingAuditLogs        → (no returning used)
            //   select billingPrices (final)   → [monthlyPrice, annualPrice]
            let selectIdx = 0;
            let insertIdx = 0;
            const mockTx = {
                select: vi.fn().mockImplementation(() => {
                    const idx = selectIdx++;
                    if (idx === 0) return makeChain([]); // no duplicate
                    return makeChain([monthlyPrice, annualPrice]); // final price fetch
                }),
                insert: vi.fn().mockImplementation(() => {
                    const idx = insertIdx++;
                    if (idx === 0) return makeChain([planRow]); // billingPlans insert
                    return makeChain([]); // billingPrices + audit log
                }),
                update: vi.fn().mockImplementation(() => makeChain([planRow]))
            };

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    return fn(mockTx);
                }
            );

            // Act
            const inputWithAnnual = { ...baseInput, annualPriceArs: 5000000 };
            const result = await createPlan(inputWithAnnual);

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            // annual price should be reflected in the mapped result
            expect(result.data.annualPriceArs).toBe(5000000);
            // insert was called 3 times: plan row + monthly price + annual price
            // (the audit log call goes through the mocked insertPlanAuditLog helper)
            expect(mockTx.insert).toHaveBeenCalledTimes(3);
            expect(mockInsertPlanAuditLog).toHaveBeenCalledOnce();
        });

        it('should include trial days in monthly price when hasTrial=true', async () => {
            // Arrange
            const planRow = makePlanRow();
            let insertValuesCalledWith: unknown[] = [];
            const txDb = {
                select: vi.fn().mockImplementation(() => makeChain([])),
                insert: vi.fn().mockImplementation(() => {
                    const chain = makeChain([planRow]);
                    const originalValues = chain.values as ReturnType<typeof vi.fn>;
                    originalValues.mockImplementation((vals: unknown) => {
                        insertValuesCalledWith = [...insertValuesCalledWith, vals];
                        return chain;
                    });
                    return chain;
                }),
                update: vi.fn().mockImplementation(() => makeChain([planRow]))
            };
            let selectCount = 0;
            (txDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
                selectCount++;
                if (selectCount === 1) return makeChain([]);
                return makeChain([]);
            });
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const inputWithTrial = { ...baseInput, hasTrial: true, trialDays: 14 };
            await createPlan(inputWithTrial, {}, ctx);

            // Assert — second insert (monthly price) should include trialDays
            const monthlyPriceInsert = insertValuesCalledWith[1] as
                | Record<string, unknown>
                | undefined;
            expect(monthlyPriceInsert?.trialDays).toBe(14);
        });

        it('should return INTERNAL_ERROR when withTransaction throws', async () => {
            // Arrange
            mockWithTransaction.mockRejectedValue(new Error('tx failed'));

            // Act
            const result = await createPlan(baseInput);

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── updatePlan ──────────────────────────────────────────────────────────

    describe('updatePlan()', () => {
        it('should return NOT_FOUND when plan does not exist', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[]]); // getPlanByIdInternal returns nothing
                    return fn(db);
                }
            );

            // Act
            const result = await updatePlan('missing-uuid', { isActive: false });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
        });

        it('should update plan and return updated BillingPlanResponse', async () => {
            // Arrange
            const existingPlan = makePlanRow();
            const updatedPlan = makePlanRow({ description: 'Updated description' });
            const priceRow = makePriceRow();

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb(
                        [
                            [existingPlan], // getPlanByIdInternal
                            [priceRow]
                        ], // final price fetch
                        [],
                        [[updatedPlan]] // update returning
                    );
                    return fn(db);
                }
            );

            // Act
            const result = await updatePlan('plan-uuid-1', { description: 'Updated description' });

            // Assert
            expect(result.success).toBe(true);
            expect(mockInsertPlanAuditLog).toHaveBeenCalledOnce();
        });

        it('should update monthly price when monthlyPriceArs is provided', async () => {
            // Arrange
            const existingPlan = makePlanRow();
            const existingMonthlyPrice = makePriceRow({ id: 'price-monthly-1' });
            const updatedPlan = makePlanRow();
            const priceRow = makePriceRow({ unitAmount: 600000 });

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb(
                        [
                            [existingPlan], // getPlanByIdInternal
                            [existingMonthlyPrice], // monthly price lookup
                            [priceRow]
                        ], // final price fetch
                        [],
                        [
                            [updatedPlan], // plan update
                            []
                        ] // price update (no returning needed)
                    );
                    return fn(db);
                }
            );

            // Act
            const result = await updatePlan('plan-uuid-1', { monthlyPriceArs: 600000 });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should deactivate annual price when annualPriceArs is set to null', async () => {
            // Arrange
            const existingPlan = makePlanRow();
            const existingAnnualPrice = makePriceRow({
                id: 'price-annual-1',
                billingInterval: 'year'
            });
            const updatedPlan = makePlanRow();
            const priceRow = makePriceRow();

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb(
                        [
                            [existingPlan], // getPlanByIdInternal
                            [existingAnnualPrice], // annual price lookup
                            [priceRow]
                        ], // final price fetch
                        [],
                        [
                            [updatedPlan], // plan update
                            []
                        ] // price deactivation
                    );
                    return fn(db);
                }
            );

            // Act
            const result = await updatePlan('plan-uuid-1', { annualPriceArs: null });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const existingPlan = makePlanRow();
            const updatedPlan = makePlanRow({ description: 'Updated' });
            const priceRow = makePriceRow();

            const txDb = buildMockDb([[existingPlan], [priceRow]], [], [[updatedPlan]]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await updatePlan('plan-uuid-1', { description: 'Updated' }, {}, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR on withTransaction failure', async () => {
            // Arrange
            mockWithTransaction.mockRejectedValue(new Error('tx failed'));

            // Act
            const result = await updatePlan('plan-uuid-1', { isActive: false });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── togglePlanActive ────────────────────────────────────────────────────

    describe('togglePlanActive()', () => {
        it('should activate a plan', async () => {
            // Arrange
            const existingPlan = makePlanRow({ active: false });
            const updatedPlan = makePlanRow({ active: true });
            const priceRow = makePriceRow();

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[existingPlan], [priceRow]], [], [[updatedPlan]]);
                    return fn(db);
                }
            );

            // Act
            const result = await togglePlanActive('plan-uuid-1', true);

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.isActive).toBe(true);
            expect(mockInsertPlanAuditLog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ action: 'plan_activated' })
            );
        });

        it('should deactivate a plan', async () => {
            // Arrange
            const existingPlan = makePlanRow({ active: true });
            const updatedPlan = makePlanRow({ active: false });
            const priceRow = makePriceRow();

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[existingPlan], [priceRow]], [], [[updatedPlan]]);
                    return fn(db);
                }
            );

            // Act
            const result = await togglePlanActive('plan-uuid-1', false);

            // Assert
            expect(result.success).toBe(true);
            expect(mockInsertPlanAuditLog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ action: 'plan_deactivated' })
            );
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[]]); // no plan
                    return fn(db);
                }
            );

            // Act
            const result = await togglePlanActive('missing-uuid', true);

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const existingPlan = makePlanRow({ active: false });
            const updatedPlan = makePlanRow({ active: true });
            const txDb = buildMockDb([[existingPlan], []], [], [[updatedPlan]]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await togglePlanActive('plan-uuid-1', true, {}, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR on withTransaction failure', async () => {
            // Arrange
            mockWithTransaction.mockRejectedValue(new Error('db fail'));

            // Act
            const result = await togglePlanActive('plan-uuid-1', true);

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── softDeletePlan ──────────────────────────────────────────────────────

    describe('softDeletePlan()', () => {
        it('should soft-delete an existing plan', async () => {
            // Arrange
            const existingPlan = makePlanRow({ active: true, deletedAt: null });

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb(
                        [[existingPlan]],
                        [],
                        [[]] // update (soft-delete)
                    );
                    return fn(db);
                }
            );

            // Act
            const result = await softDeletePlan('plan-uuid-1');

            // Assert
            expect(result.success).toBe(true);
            expect(mockInsertPlanAuditLog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ action: 'plan_soft_deleted' })
            );
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[]]); // no plan
                    return fn(db);
                }
            );

            // Act
            const result = await softDeletePlan('missing-uuid');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const existingPlan = makePlanRow();
            const txDb = buildMockDb([[existingPlan]], [], [[]]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await softDeletePlan('plan-uuid-1', {}, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR on withTransaction failure', async () => {
            // Arrange
            mockWithTransaction.mockRejectedValue(new Error('fail'));

            // Act
            const result = await softDeletePlan('plan-uuid-1');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── restorePlan ─────────────────────────────────────────────────────────

    describe('restorePlan()', () => {
        it('should restore a soft-deleted plan', async () => {
            // Arrange
            const softDeletedPlan = makePlanRow({ deletedAt: new Date('2025-06-01') });
            const restoredPlan = makePlanRow({ deletedAt: null, active: true });
            const priceRow = makePriceRow();

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[softDeletedPlan], [priceRow]], [], [[restoredPlan]]);
                    return fn(db);
                }
            );

            // Act
            const result = await restorePlan('plan-uuid-1');

            // Assert
            expect(result.success).toBe(true);
            expect(mockInsertPlanAuditLog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ action: 'plan_restored' })
            );
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[]]); // no plan
                    return fn(db);
                }
            );

            // Act
            const result = await restorePlan('missing-uuid');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
        });

        it('should return VALIDATION_ERROR when plan is not soft-deleted', async () => {
            // Arrange
            const activePlan = makePlanRow({ deletedAt: null, active: true });

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[activePlan]]);
                    return fn(db);
                }
            );

            // Act
            const result = await restorePlan('plan-uuid-1');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(result.error.message).toContain('not soft-deleted');
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const softDeletedPlan = makePlanRow({ deletedAt: new Date() });
            const restoredPlan = makePlanRow({ deletedAt: null });
            const txDb = buildMockDb([[softDeletedPlan], []], [], [[restoredPlan]]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await restorePlan('plan-uuid-1', {}, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR on withTransaction failure', async () => {
            // Arrange
            mockWithTransaction.mockRejectedValue(new Error('fail'));

            // Act
            const result = await restorePlan('plan-uuid-1');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // ── hardDeletePlan ──────────────────────────────────────────────────────

    describe('hardDeletePlan()', () => {
        it('should hard-delete a plan with no active subscriptions', async () => {
            // Arrange
            const existingPlan = makePlanRow();

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb(
                        [
                            [existingPlan], // getPlanByIdInternal
                            [{ value: 0 }]
                        ], // subscription count = 0
                        [],
                        [],
                        [[], []] // delete billingPrices, delete billingPlans
                    );
                    return fn(db);
                }
            );

            // Act
            const result = await hardDeletePlan('plan-uuid-1');

            // Assert
            expect(result.success).toBe(true);
            expect(mockInsertPlanAuditLog).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ action: 'plan_hard_deleted' })
            );
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb([[]]); // no plan
                    return fn(db);
                }
            );

            // Act
            const result = await hardDeletePlan('missing-uuid');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
        });

        it('should return ALREADY_EXISTS when plan has active subscriptions', async () => {
            // Arrange
            const existingPlan = makePlanRow();

            mockWithTransaction.mockImplementation(
                async (fn: (db: unknown) => Promise<unknown>) => {
                    const db = buildMockDb(
                        [
                            [existingPlan], // getPlanByIdInternal
                            [{ value: 3 }]
                        ] // subscription count = 3
                    );
                    return fn(db);
                }
            );

            // Act
            const result = await hardDeletePlan('plan-uuid-1');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('ALREADY_EXISTS');
            expect(result.error.message).toContain('3 subscription');
        });

        it('should use ctx.tx when provided', async () => {
            // Arrange
            const existingPlan = makePlanRow();
            const txDb = buildMockDb([[existingPlan], [{ value: 0 }]], [], [], [[], []]);
            const ctx = { tx: txDb as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await hardDeletePlan('plan-uuid-1', {}, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should return INTERNAL_ERROR on withTransaction failure', async () => {
            // Arrange
            mockWithTransaction.mockRejectedValue(new Error('fail'));

            // Act
            const result = await hardDeletePlan('plan-uuid-1');

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
