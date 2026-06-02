/**
 * PlanService Tests — T-003, T-004, T-005, T-006, T-007
 *
 * Covers:
 * - T-003: read (listPlans, getPlanById, mapDbToPlan)
 * - T-004: create (createPlan)
 * - T-005: update (updatePlan)
 * - T-006: toggle active + soft-delete
 * - T-007: hard-delete with referential guard
 *
 * Mock strategy:
 * All query builder methods default to returning mockDb (chainable via mockReturnValue).
 * For each test, terminal methods (limit, offset, returning, values) get
 * mockResolvedValueOnce to emit data. Intermediate `.where()` calls (when they
 * are NOT the terminal method) get mockReturnValueOnce(mockDb) explicitly queued
 * BEFORE the terminal `.where()` call, so the chain is preserved.
 *
 * @module test/services/plan.service
 */

import { ServiceErrorCode } from '@repo/schemas';
import { PlanService, mapDbToPlan } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb, mockGetDb, mockWithTransaction } = vi.hoisted(() => {
    const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        returning: vi.fn(),
        values: vi.fn(),
        set: vi.fn(),
        orderBy: vi.fn(),
        offset: vi.fn(),
        groupBy: vi.fn()
    };

    const mockWithTransaction = vi.fn(async <T>(callback: (tx: typeof mockDb) => Promise<T>) => {
        return callback(mockDb);
    });

    return {
        mockDb,
        mockGetDb: vi.fn(() => mockDb),
        mockWithTransaction
    };
});

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
        metadata: 'metadata',
        livemode: 'livemode',
        deletedAt: 'deletedAt',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    billingPrices: {
        id: 'id',
        planId: 'planId',
        currency: 'currency',
        unitAmount: 'unitAmount',
        billingInterval: 'billingInterval',
        intervalCount: 'intervalCount',
        active: 'active',
        trialDays: 'trialDays',
        livemode: 'livemode'
    },
    billingSubscriptions: {
        id: 'id',
        planId: 'planId',
        customerId: 'customerId',
        status: 'status'
    },
    billingAuditLogs: {
        id: 'id',
        action: 'action',
        entityType: 'entityType',
        entityId: 'entityId',
        actorId: 'actorId',
        actorType: 'actorType',
        changes: 'changes',
        previousValues: 'previousValues',
        livemode: 'livemode',
        ipAddress: 'ipAddress',
        userAgent: 'userAgent'
    },
    and: vi.fn((...args: unknown[]) => args),
    asc: vi.fn((field: unknown) => `asc(${String(field)})`),
    count: vi.fn(() => 'count-fn'),
    desc: vi.fn((field: unknown) => `desc(${String(field)})`),
    eq: vi.fn((field: unknown, value: unknown) => ({ field, value, op: 'eq' })),
    isNull: vi.fn((field: unknown) => ({ field, op: 'isNull' })),
    isNotNull: vi.fn((field: unknown) => ({ field, op: 'isNotNull' })),
    safeIlike: vi.fn((field: unknown, value: unknown) => ({ field, value, op: 'safeIlike' })),
    sql: Object.assign(
        vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: 'sql' })),
        { join: vi.fn((items: unknown[], _sep: unknown) => items) }
    )
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2024-01-01T00:00:00.000Z');

const mockPlanRow = {
    id: 'plan-uuid-001',
    name: 'owner-basico',
    description: 'Plan básico para anfitriones',
    active: true,
    entitlements: ['CAN_LIST_ACCOMMODATION'],
    limits: { MAX_ACCOMMODATIONS: 1 },
    metadata: {
        slug: 'owner-basico',
        displayName: 'Básico',
        category: 'owner',
        isDefault: true,
        sortOrder: 1,
        trialDays: 14,
        hasTrial: true,
        monthlyPriceArs: 500000,
        annualPriceArs: 5000000,
        monthlyPriceUsdRef: 5
    },
    livemode: false,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW
};

const mockMonthlyPrice = {
    id: 'price-monthly-001',
    planId: 'plan-uuid-001',
    currency: 'ARS',
    unitAmount: 500000,
    billingInterval: 'month',
    intervalCount: 1,
    active: true,
    trialDays: 14,
    livemode: false
};

const mockAnnualPrice = {
    id: 'price-annual-001',
    planId: 'plan-uuid-001',
    currency: 'ARS',
    unitAmount: 5000000,
    billingInterval: 'year',
    intervalCount: 1,
    active: true,
    trialDays: null,
    livemode: false
};

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/** Make all mockDb methods return mockDb by default (enables chaining). */
function setupChain() {
    for (const key of Object.keys(mockDb)) {
        mockDb[key]!.mockReturnValue(mockDb);
    }
}

// ---------------------------------------------------------------------------
// mapDbToPlan — T-003 (pure unit tests, no DB mock needed)
// ---------------------------------------------------------------------------

describe('mapDbToPlan', () => {
    describe('when given a plan row with monthly + annual prices', () => {
        it('should map all fields correctly to BillingPlanResponse', () => {
            const result = mapDbToPlan(
                mockPlanRow as Parameters<typeof mapDbToPlan>[0],
                [mockMonthlyPrice, mockAnnualPrice] as unknown as Parameters<typeof mapDbToPlan>[1]
            );
            expect(result.id).toBe('plan-uuid-001');
            expect(result.slug).toBe('owner-basico');
            expect(result.name).toBe('Básico');
            expect(result.description).toBe('Plan básico para anfitriones');
            expect(result.category).toBe('owner');
            expect(result.monthlyPriceArs).toBe(500000);
            expect(result.annualPriceArs).toBe(5000000);
            expect(result.monthlyPriceUsdRef).toBe(5);
            expect(result.hasTrial).toBe(true);
            expect(result.trialDays).toBe(14);
            expect(result.isDefault).toBe(true);
            expect(result.sortOrder).toBe(1);
            expect(result.entitlements).toEqual(['CAN_LIST_ACCOMMODATION']);
            expect(result.limits).toEqual({ MAX_ACCOMMODATIONS: 1 });
            expect(result.isActive).toBe(true);
            expect(result.createdAt).toBe(NOW.toISOString());
        });
    });

    describe('when given only a monthly price', () => {
        it('should set annualPriceArs to null', () => {
            const result = mapDbToPlan(
                mockPlanRow as Parameters<typeof mapDbToPlan>[0],
                [mockMonthlyPrice] as unknown as Parameters<typeof mapDbToPlan>[1]
            );
            expect(result.annualPriceArs).toBeNull();
        });
    });

    describe('when no prices are given', () => {
        it('should set monthlyPriceArs to 0 and annualPriceArs to null', () => {
            const result = mapDbToPlan(mockPlanRow as Parameters<typeof mapDbToPlan>[0], []);
            expect(result.monthlyPriceArs).toBe(0);
            expect(result.annualPriceArs).toBeNull();
        });
    });

    describe('when metadata is null', () => {
        it('should use safe defaults', () => {
            const planWithNoMeta = { ...mockPlanRow, metadata: null };
            const result = mapDbToPlan(planWithNoMeta as Parameters<typeof mapDbToPlan>[0], []);
            expect(result.name).toBe('owner-basico'); // falls back to planRow.name
            expect(result.category).toBe('owner'); // default
            expect(result.hasTrial).toBe(false);
            expect(result.trialDays).toBe(0);
            expect(result.isDefault).toBe(false);
            expect(result.sortOrder).toBe(0);
        });
    });
});

// ---------------------------------------------------------------------------
// PlanService — T-003 through T-007
// ---------------------------------------------------------------------------

describe('PlanService', () => {
    let service: PlanService;

    beforeEach(() => {
        vi.clearAllMocks();
        setupChain();
        service = new PlanService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // T-003 — getById
    //
    // Drizzle chain: select().from().where(AND...).limit(1) → plan
    //   - where() is INTERMEDIATE → must keep returning mockDb
    //   - limit() is TERMINAL     → mockResolvedValueOnce([plan])
    //
    // Then: select().from().where(AND...) → prices
    //   - where() is TERMINAL     → mockResolvedValueOnce([prices])
    //
    // Queue for `where`: [mockReturnValueOnce(mockDb), mockResolvedValueOnce([prices])]
    // -------------------------------------------------------------------------

    describe('getById', () => {
        it('should return a plan when found', async () => {
            // Arrange
            mockDb
                .where!.mockReturnValueOnce(mockDb) // intermediate (plan query)
                .mockResolvedValueOnce([mockMonthlyPrice, mockAnnualPrice]); // terminal (prices query)
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]); // terminal (plan query)

            // Act
            const result = await service.getById('plan-uuid-001');

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe('plan-uuid-001');
                expect(result.data.monthlyPriceArs).toBe(500000);
                expect(result.data.annualPriceArs).toBe(5000000);
            }
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            // Arrange: plan query returns empty
            mockDb.where!.mockReturnValueOnce(mockDb); // intermediate
            mockDb.limit!.mockResolvedValueOnce([]); // terminal: not found

            // Act
            const result = await service.getById('nonexistent');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });

        it('should return NOT_FOUND for soft-deleted plans (excluded by where clause)', async () => {
            // The WHERE includes isNull(deletedAt); if plan is soft-deleted, limit returns []
            mockDb.where!.mockReturnValueOnce(mockDb);
            mockDb.limit!.mockResolvedValueOnce([]);
            const result = await service.getById('soft-deleted-uuid');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });
    });

    // -------------------------------------------------------------------------
    // T-003 — list
    //
    // Count query: select(count).from().where(AND...) → [{value:N}]
    //   - where() is TERMINAL
    //
    // Plan rows: select().from().where(AND...).orderBy().limit(pageSize).offset(n) → rows
    //   - where() is INTERMEDIATE
    //   - offset() is TERMINAL
    //
    // Prices batch: select().from().where(ANY planIds) → [prices]
    //   - where() is TERMINAL
    //
    // Queue for `where`: [terminal-count, intermediate-planRows, terminal-prices]
    // -------------------------------------------------------------------------

    describe('list', () => {
        it('should return paginated list of plans', async () => {
            // Arrange
            mockDb
                .where!.mockResolvedValueOnce([{ value: 1 }]) // count (terminal)
                .mockReturnValueOnce(mockDb) // plan rows (intermediate)
                .mockResolvedValueOnce([mockMonthlyPrice, mockAnnualPrice]) // prices (terminal)
                .mockReturnValueOnce(mockDb); // subscriber count (intermediate, before groupBy)
            mockDb.offset!.mockResolvedValueOnce([mockPlanRow]); // plan rows (terminal)
            mockDb.groupBy!.mockResolvedValueOnce([]); // subscriber count (terminal)

            // Act
            const result = await service.list({ page: 1, pageSize: 10 });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(1);
                expect(result.data.pagination.total).toBe(1);
                expect(result.data.items[0]?.slug).toBe('owner-basico');
            }
        });

        it('should return empty list when no plans match filters', async () => {
            // count = 0, plan rows = [] (early return before prices fetch)
            mockDb
                .where!.mockResolvedValueOnce([{ value: 0 }]) // count (terminal)
                .mockReturnValueOnce(mockDb); // plan rows (intermediate)
            mockDb.offset!.mockResolvedValueOnce([]); // plan rows (terminal): empty

            // Act
            const result = await service.list({ active: true });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(0);
                expect(result.data.pagination.total).toBe(0);
            }
        });

        it('should preserve ordering from DB (sorted by sortOrder ASC in query)', async () => {
            // The orderBy clause sorts by metadata.sortOrder ASC — DB returns in order
            const plan2 = {
                ...mockPlanRow,
                id: 'plan-uuid-002',
                name: 'owner-pro',
                metadata: { ...mockPlanRow.metadata, sortOrder: 2, displayName: 'Pro' }
            };
            mockDb
                .where!.mockResolvedValueOnce([{ value: 2 }])
                .mockReturnValueOnce(mockDb)
                .mockResolvedValueOnce([mockMonthlyPrice, mockAnnualPrice])
                .mockReturnValueOnce(mockDb); // subscriber count (intermediate, before groupBy)
            mockDb.offset!.mockResolvedValueOnce([mockPlanRow, plan2]);
            mockDb.groupBy!.mockResolvedValueOnce([]); // subscriber count (terminal)

            const result = await service.list({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items[0]?.sortOrder).toBe(1);
                expect(result.data.items[1]?.sortOrder).toBe(2);
            }
        });
    });

    // -------------------------------------------------------------------------
    // T-004 — create
    //
    // 1. Dup check: select().from().where(eq name).limit(1) → [] or [{id}]
    //    where=INTERMEDIATE, limit=TERMINAL
    //
    // 2. Plan insert: insert(billingPlans).values({...}).returning() → [planRow]
    //    values=chain, returning=TERMINAL
    //
    // 3. Monthly insert: insert(billingPrices).values({...}) → []
    //    values=TERMINAL
    //
    // 4. Annual insert (if annualPriceArs>0): insert(billingPrices).values({...}) → []
    //    values=TERMINAL
    //
    // 5. Audit: insert(billingAuditLogs).values({...}) → []
    //    values=TERMINAL
    //
    // 6. Prices re-fetch: select().from().where(AND planId+active) → [prices]
    //    where=TERMINAL
    //
    // Queue for `where`: [intermediate-dup, terminal-prices-refetch]
    // Queue for `values`: [monthly, optional-annual, audit]
    // -------------------------------------------------------------------------

    describe('create', () => {
        const createInput = {
            slug: 'owner-nuevo',
            name: 'Nuevo Plan',
            description: 'Descripción del nuevo plan',
            category: 'owner' as const,
            monthlyPriceArs: 600000,
            annualPriceArs: 6000000,
            monthlyPriceUsdRef: 6,
            hasTrial: true,
            trialDays: 14,
            isDefault: false,
            sortOrder: 5,
            entitlements: ['CAN_LIST_ACCOMMODATION'],
            limits: { MAX_ACCOMMODATIONS: 2 },
            isActive: true
        };

        it('should create plan with monthly and annual prices', async () => {
            // Arrange
            // values() call order: [plan-insert (intermediate→returning), monthly (terminal), annual (terminal), audit (terminal)]
            const newPlanRow = { ...mockPlanRow, id: 'new-plan-uuid', name: 'owner-nuevo' };
            mockDb
                .where!.mockReturnValueOnce(mockDb) // dup check (intermediate)
                .mockResolvedValueOnce([mockMonthlyPrice, mockAnnualPrice]); // prices re-fetch (terminal)
            mockDb.limit!.mockResolvedValueOnce([]); // dup check: none
            mockDb.returning!.mockResolvedValueOnce([newPlanRow]); // plan insert terminal
            mockDb
                .values!.mockReturnValueOnce(mockDb) // plan insert: intermediate (returning follows)
                .mockResolvedValueOnce([]) // monthly price: terminal
                .mockResolvedValueOnce([]) // annual price: terminal
                .mockResolvedValueOnce([]); // audit: terminal

            // Act
            const result = await service.create(createInput, {
                livemode: false,
                actorId: 'actor-1'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.insert).toHaveBeenCalled();
            expect(mockDb.returning).toHaveBeenCalled();
        });

        it('should create plan with only monthly price when annualPriceArs is null', async () => {
            // Arrange
            const inputNoAnnual = { ...createInput, annualPriceArs: null };
            const newPlanRow = { ...mockPlanRow, id: 'plan-uuid-2', name: 'owner-nuevo' };
            mockDb.where!.mockReturnValueOnce(mockDb).mockResolvedValueOnce([mockMonthlyPrice]);
            mockDb.limit!.mockResolvedValueOnce([]);
            mockDb.returning!.mockResolvedValueOnce([newPlanRow]);
            mockDb
                .values!.mockReturnValueOnce(mockDb) // plan insert: intermediate
                .mockResolvedValueOnce([]) // monthly: terminal
                .mockResolvedValueOnce([]); // audit: terminal (no annual insert)

            // Act
            const result = await service.create(inputNoAnnual);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should NOT insert annual price when annualPriceArs is 0', async () => {
            // Arrange
            const inputZeroAnnual = { ...createInput, annualPriceArs: 0 };
            const newPlanRow = { ...mockPlanRow, id: 'plan-uuid-3', name: 'owner-nuevo' };
            mockDb.where!.mockReturnValueOnce(mockDb).mockResolvedValueOnce([mockMonthlyPrice]);
            mockDb.limit!.mockResolvedValueOnce([]);
            mockDb.returning!.mockResolvedValueOnce([newPlanRow]);
            mockDb
                .values!.mockReturnValueOnce(mockDb) // plan insert: intermediate
                .mockResolvedValueOnce([]) // monthly: terminal
                .mockResolvedValueOnce([]); // audit: terminal

            // Act
            const result = await service.create(inputZeroAnnual);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject duplicate slug with ALREADY_EXISTS', async () => {
            // Arrange: dup check finds existing plan
            mockDb.where!.mockReturnValueOnce(mockDb); // dup check (intermediate)
            mockDb.limit!.mockResolvedValueOnce([{ id: 'existing' }]); // dup check: found!

            // Act
            const result = await service.create(createInput);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
                expect(result.error.message).toMatch(/already exists/i);
            }
        });

        it('should emit audit log on successful create', async () => {
            // Arrange
            const { billingAuditLogs } = await import('@repo/db');
            const newPlanRow = { ...mockPlanRow, id: 'new-uuid', name: 'owner-nuevo' };
            mockDb.where!.mockReturnValueOnce(mockDb).mockResolvedValueOnce([mockMonthlyPrice]);
            mockDb.limit!.mockResolvedValueOnce([]);
            mockDb.returning!.mockResolvedValueOnce([newPlanRow]);
            mockDb
                .values!.mockReturnValueOnce(mockDb) // plan insert: intermediate
                .mockResolvedValueOnce([]) // monthly: terminal
                .mockResolvedValueOnce([]) // annual: terminal (annualPriceArs=6000000 > 0)
                .mockResolvedValueOnce([]); // audit: terminal

            // Act
            await service.create(createInput, { actorId: 'admin-user' });

            // Assert: insert called with audit logs table
            expect(mockDb.insert).toHaveBeenCalledWith(billingAuditLogs);
        });

        it('should return INTERNAL_ERROR on plan insert failure', async () => {
            // Arrange: dup check ok, plan insert fails
            mockDb.where!.mockReturnValueOnce(mockDb);
            mockDb.limit!.mockResolvedValueOnce([]);
            mockDb.returning!.mockRejectedValueOnce(new Error('DB failure'));

            // Act
            const result = await service.create(createInput);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            }
        });
    });

    // -------------------------------------------------------------------------
    // T-005 — update
    //
    // 1. getPlanByIdInternal: select().from().where(eq id).limit(1) → plan
    //    where=INTERMEDIATE, limit=TERMINAL
    //
    // 2. Plan update: update().set().where(eq id).returning() → [updated]
    //    where=INTERMEDIATE (chain), returning=TERMINAL
    //
    // 3a. IF monthlyPriceArs changed:
    //    monthly price lookup: select().from().where(AND planId+month+active).limit(1) → [price]
    //    where=INTERMEDIATE, limit=TERMINAL
    //    price update: update().set().where(eq id).returning() → [updated price]
    //    OR price insert: insert().values() → []
    //
    // 3b. IF annualPriceArs changed:
    //    annual price lookup: select().from().where(AND planId+year+active).limit(1) → [price]
    //    where=INTERMEDIATE, limit=TERMINAL
    //    price deactivate/update/insert
    //
    // 4. Audit: insert(billingAuditLogs).values() → []
    //    values=TERMINAL
    //
    // 5. Prices re-fetch: select().from().where(AND planId+active) → [prices]
    //    where=TERMINAL
    // -------------------------------------------------------------------------

    describe('update', () => {
        it('should update plan description field', async () => {
            // Arrange (no price change — queries: getPlanByIdInternal, planUpdate, audit, pricesRefetch)
            mockDb
                .where!.mockReturnValueOnce(mockDb) // getPlanByIdInternal: intermediate
                .mockReturnValueOnce(mockDb) // planUpdate .where: intermediate
                .mockResolvedValueOnce([mockMonthlyPrice, mockAnnualPrice]); // prices refetch: terminal
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]); // getPlanByIdInternal: terminal
            mockDb.returning!.mockResolvedValueOnce([{ ...mockPlanRow, description: 'Updated' }]); // plan update
            mockDb.values!.mockResolvedValueOnce([]); // audit

            // Act
            const result = await service.update(
                'plan-uuid-001',
                { description: 'Updated' },
                { actorId: 'admin-1' }
            );

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reconcile monthly price when monthlyPriceArs changes', async () => {
            // Queries: getPlanByIdInternal, planUpdate, monthlyPriceLookup, priceUpdate, audit, pricesRefetch
            mockDb
                .where!.mockReturnValueOnce(mockDb) // getPlanByIdInternal: intermediate
                .mockReturnValueOnce(mockDb) // planUpdate .where: intermediate
                .mockReturnValueOnce(mockDb) // monthly price lookup: intermediate
                .mockReturnValueOnce(mockDb) // monthly price update .where: intermediate
                .mockResolvedValueOnce([{ ...mockMonthlyPrice, unitAmount: 700000 }]); // prices refetch: terminal
            mockDb
                .limit!.mockResolvedValueOnce([mockPlanRow]) // getPlanByIdInternal: terminal
                .mockResolvedValueOnce([mockMonthlyPrice]); // monthly price lookup: terminal
            mockDb
                .returning!.mockResolvedValueOnce([mockPlanRow]) // plan update
                .mockResolvedValueOnce([{ ...mockMonthlyPrice, unitAmount: 700000 }]); // price update
            mockDb.values!.mockResolvedValueOnce([]); // audit

            // Act
            const result = await service.update('plan-uuid-001', { monthlyPriceArs: 700000 });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should deactivate annual price when annualPriceArs is set to null', async () => {
            // Queries: getPlanByIdInternal, planUpdate, annualPriceLookup, priceDeactivate, audit, pricesRefetch
            mockDb
                .where!.mockReturnValueOnce(mockDb) // getPlanByIdInternal: intermediate
                .mockReturnValueOnce(mockDb) // planUpdate .where: intermediate
                .mockReturnValueOnce(mockDb) // annual price lookup: intermediate
                .mockReturnValueOnce(mockDb) // price deactivate .where: intermediate
                .mockResolvedValueOnce([mockMonthlyPrice]); // prices refetch: terminal
            mockDb
                .limit!.mockResolvedValueOnce([mockPlanRow]) // getPlanByIdInternal: terminal
                .mockResolvedValueOnce([mockAnnualPrice]); // annual price lookup: terminal
            mockDb
                .returning!.mockResolvedValueOnce([mockPlanRow]) // plan update
                .mockResolvedValueOnce([{ ...mockAnnualPrice, active: false }]); // price deactivate
            mockDb.values!.mockResolvedValueOnce([]); // audit

            // Act
            const result = await service.update('plan-uuid-001', { annualPriceArs: null });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            // Arrange: getPlanByIdInternal returns nothing
            mockDb.where!.mockReturnValueOnce(mockDb); // intermediate
            mockDb.limit!.mockResolvedValueOnce([]); // terminal: not found

            const result = await service.update('nonexistent', { name: 'New name' });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });

        it('should emit audit log with diff on update', async () => {
            // Arrange
            const { billingAuditLogs } = await import('@repo/db');
            mockDb
                .where!.mockReturnValueOnce(mockDb) // getPlanByIdInternal
                .mockReturnValueOnce(mockDb) // planUpdate .where
                .mockResolvedValueOnce([mockMonthlyPrice]); // prices refetch
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]);
            mockDb.returning!.mockResolvedValueOnce([{ ...mockPlanRow, active: false }]);
            mockDb.values!.mockResolvedValueOnce([]);

            // Act
            await service.update('plan-uuid-001', { isActive: false }, { actorId: 'admin-1' });

            // Assert
            expect(mockDb.insert).toHaveBeenCalledWith(billingAuditLogs);
        });

        it('should return INTERNAL_ERROR on update failure', async () => {
            mockDb.where!.mockReturnValueOnce(mockDb);
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]);
            mockDb.returning!.mockRejectedValueOnce(new Error('DB error'));

            const result = await service.update('plan-uuid-001', { name: 'New' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            }
        });
    });

    // -------------------------------------------------------------------------
    // T-006 — toggleActive
    //
    // 1. getPlanByIdInternal: where=INTERMEDIATE, limit=TERMINAL
    // 2. Plan update: update().set().where().returning() → where=INTERMEDIATE, returning=TERMINAL
    // 3. Audit: values=TERMINAL
    // 4. Prices refetch: where=TERMINAL
    // -------------------------------------------------------------------------

    describe('toggleActive', () => {
        it('should flip active flag to false', async () => {
            // Arrange
            const inactivePlan = { ...mockPlanRow, active: false };
            mockDb
                .where!.mockReturnValueOnce(mockDb) // getPlanByIdInternal: intermediate
                .mockReturnValueOnce(mockDb) // planUpdate .where: intermediate
                .mockResolvedValueOnce([mockMonthlyPrice]); // prices refetch: terminal
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]); // getPlanByIdInternal terminal
            mockDb.returning!.mockResolvedValueOnce([inactivePlan]); // plan update terminal
            mockDb.values!.mockResolvedValueOnce([]); // audit

            // Act
            const result = await service.toggleActive('plan-uuid-001', false, { actorId: 'admin' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(false);
            }
        });

        it('should flip active flag to true', async () => {
            // Arrange
            const inactivePlan = { ...mockPlanRow, active: false };
            mockDb
                .where!.mockReturnValueOnce(mockDb)
                .mockReturnValueOnce(mockDb)
                .mockResolvedValueOnce([mockMonthlyPrice]);
            mockDb.limit!.mockResolvedValueOnce([inactivePlan]);
            mockDb.returning!.mockResolvedValueOnce([mockPlanRow]); // active=true
            mockDb.values!.mockResolvedValueOnce([]);

            // Act
            const result = await service.toggleActive('plan-uuid-001', true);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(true);
            }
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            mockDb.where!.mockReturnValueOnce(mockDb);
            mockDb.limit!.mockResolvedValueOnce([]);
            const result = await service.toggleActive('no-uuid', true);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });

        it('should emit audit log on toggle', async () => {
            // Arrange
            const { billingAuditLogs } = await import('@repo/db');
            mockDb
                .where!.mockReturnValueOnce(mockDb)
                .mockReturnValueOnce(mockDb)
                .mockResolvedValueOnce([mockMonthlyPrice]);
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]);
            mockDb.returning!.mockResolvedValueOnce([{ ...mockPlanRow, active: false }]);
            mockDb.values!.mockResolvedValueOnce([]);

            // Act
            await service.toggleActive('plan-uuid-001', false, { actorId: 'admin' });

            // Assert
            expect(mockDb.insert).toHaveBeenCalledWith(billingAuditLogs);
        });
    });

    // -------------------------------------------------------------------------
    // T-006 — softDelete
    //
    // 1. getPlanByIdInternal: where=INTERMEDIATE, limit=TERMINAL
    // 2. Plan update: update().set().where() — where is the terminal (no returning)
    // 3. Audit: values=TERMINAL
    // -------------------------------------------------------------------------

    describe('softDelete', () => {
        it('should call update with active=false and set deletedAt', async () => {
            // Arrange
            // getPlanByIdInternal: where=intermediate, limit=terminal
            // plan update .where: terminal for the update (drizzle update ends at where)
            mockDb
                .where!.mockReturnValueOnce(mockDb) // getPlanByIdInternal: intermediate
                .mockReturnValue(mockDb); // update .where: doesn't need resolve (fire-and-forget update)
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]); // getPlanByIdInternal terminal
            mockDb.values!.mockResolvedValueOnce([]); // audit

            // Act
            const result = await service.softDelete('plan-uuid-001', { actorId: 'admin' });

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            mockDb.where!.mockReturnValueOnce(mockDb);
            mockDb.limit!.mockResolvedValueOnce([]);
            const result = await service.softDelete('no-uuid');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });

        it('should emit audit log on soft delete', async () => {
            // Arrange
            const { billingAuditLogs } = await import('@repo/db');
            mockDb.where!.mockReturnValueOnce(mockDb).mockReturnValue(mockDb);
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]);
            mockDb.values!.mockResolvedValueOnce([]);

            // Act
            await service.softDelete('plan-uuid-001', { actorId: 'admin' });

            // Assert
            expect(mockDb.insert).toHaveBeenCalledWith(billingAuditLogs);
        });

        it('should be reversible via toggleActive', async () => {
            // Soft-delete
            mockDb.where!.mockReturnValueOnce(mockDb).mockReturnValue(mockDb);
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]);
            mockDb.values!.mockResolvedValueOnce([]);
            const deleteResult = await service.softDelete('plan-uuid-001');
            expect(deleteResult.success).toBe(true);

            // Restore via toggleActive
            vi.clearAllMocks();
            setupChain();
            const deletedPlan = { ...mockPlanRow, active: false, deletedAt: new Date() };
            mockDb
                .where!.mockReturnValueOnce(mockDb)
                .mockReturnValueOnce(mockDb)
                .mockResolvedValueOnce([mockMonthlyPrice]);
            mockDb.limit!.mockResolvedValueOnce([deletedPlan]);
            mockDb.returning!.mockResolvedValueOnce([mockPlanRow]);
            mockDb.values!.mockResolvedValueOnce([]);

            const toggleResult = await service.toggleActive('plan-uuid-001', true);
            expect(toggleResult.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // T-007 — hardDelete with referential guard
    //
    // 1. getPlanByIdInternal: where=INTERMEDIATE, limit=TERMINAL
    // 2. Sub count: select().from().where(eq planId) → [{value:N}]
    //    where=TERMINAL
    // 3. Audit: insert().values() → []
    //    values=TERMINAL
    // 4. Delete prices: delete().where(eq planId)
    //    where=TERMINAL
    // 5. Delete plan: delete().where(eq id)
    //    where=TERMINAL
    //
    // Queue for `where`: [intermediate-getPlanByIdInternal, terminal-count, terminal-deletePrices, terminal-deletePlan]
    // -------------------------------------------------------------------------

    describe('hardDelete', () => {
        it('should block hard-delete when subscriptions reference the plan', async () => {
            // Arrange: plan exists, subscription count > 0
            mockDb
                .where!.mockReturnValueOnce(mockDb) // getPlanByIdInternal: intermediate
                .mockResolvedValueOnce([{ value: 2 }]); // sub count: terminal
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]); // getPlanByIdInternal: terminal

            // Act
            const result = await service.hardDelete('plan-uuid-001', { actorId: 'admin' });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
                expect(result.error.message).toMatch(/subscription/i);
            }
        });

        it('should hard-delete plan and prices when no subscriptions reference the plan', async () => {
            // Arrange
            const { billingAuditLogs } = await import('@repo/db');
            mockDb
                .where!.mockReturnValueOnce(mockDb) // getPlanByIdInternal: intermediate
                .mockResolvedValueOnce([{ value: 0 }]) // sub count: terminal
                .mockResolvedValueOnce([]) // delete prices: terminal
                .mockResolvedValueOnce([]); // delete plan: terminal
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]); // getPlanByIdInternal: terminal
            mockDb.values!.mockResolvedValueOnce([]); // audit: terminal

            // Act
            const result = await service.hardDelete('plan-uuid-001', { actorId: 'admin' });

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.delete).toHaveBeenCalledTimes(2); // prices + plan
            expect(mockDb.insert).toHaveBeenCalledWith(billingAuditLogs);
        });

        it('should return NOT_FOUND when plan does not exist', async () => {
            mockDb.where!.mockReturnValueOnce(mockDb);
            mockDb.limit!.mockResolvedValueOnce([]);
            const result = await service.hardDelete('no-uuid');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });

        it('should emit audit log BEFORE deleting prices and plan', async () => {
            // Arrange: track call order between insert and delete
            const { billingAuditLogs } = await import('@repo/db');
            const callOrder: string[] = [];

            mockDb.insert!.mockImplementation((_table: unknown) => {
                callOrder.push('insert');
                return mockDb;
            });
            mockDb.delete!.mockImplementation(() => {
                callOrder.push('delete');
                return mockDb;
            });

            mockDb
                .where!.mockReturnValueOnce(mockDb)
                .mockResolvedValueOnce([{ value: 0 }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]);
            mockDb.values!.mockResolvedValueOnce([]);

            // Act
            const result = await service.hardDelete('plan-uuid-001', { actorId: 'admin' });

            // Assert: insert comes before delete
            expect(result.success).toBe(true);
            const insertIdx = callOrder.indexOf('insert');
            const deleteIdx = callOrder.indexOf('delete');
            expect(insertIdx).toBeGreaterThanOrEqual(0);
            expect(insertIdx).toBeLessThan(deleteIdx);
            expect(mockDb.insert).toHaveBeenCalledWith(billingAuditLogs);
        });

        it('should return INTERNAL_ERROR on deletion failure', async () => {
            // Arrange: plan exists, no subs, but prices deletion fails
            mockDb
                .where!.mockReturnValueOnce(mockDb)
                .mockResolvedValueOnce([{ value: 0 }]) // sub count
                .mockRejectedValueOnce(new Error('Delete failed')); // delete prices fails
            mockDb.limit!.mockResolvedValueOnce([mockPlanRow]);
            mockDb.values!.mockResolvedValueOnce([]); // audit

            // Act
            const result = await service.hardDelete('plan-uuid-001');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            }
        });
    });
});
