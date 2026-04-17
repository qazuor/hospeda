/**
 * @fileoverview
 * Integration tests for cross-service atomicity with withServiceTransaction.
 *
 * Verifies that two independent services sharing the same ServiceContext
 * (and therefore the same ctx.tx) participate in a single atomic transaction
 * boundary. Both services must receive the SAME tx object, and a failure in
 * either service must propagate out of withServiceTransaction without silently
 * committing a partial write.
 */

import type { ListRelationsConfig, PaginatedListOutput } from '@repo/schemas';
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseCrudService } from '../../src/base/base.crud.service';
import type { Actor, BaseModel, ServiceConfig, ServiceContext } from '../../src/types';
import '../setupTest';

// ---------------------------------------------------------------------------
// Mock @repo/db — withTransaction injects a single stable tx object so that
// both services operating inside the same callback receive the SAME reference.
// ---------------------------------------------------------------------------

const mockTx = { execute: vi.fn().mockResolvedValue(undefined) };

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    buildSearchCondition: vi.fn(() => undefined),
    BaseModelImpl: class {}
}));

vi.mock('drizzle-orm', () => ({
    sql: Object.assign(
        (strings: TemplateStringsArray, ..._values: unknown[]) => ({
            type: 'sql',
            strings,
            _values
        }),
        {
            raw: (value: string) => ({ type: 'sql-raw', value })
        }
    )
}));

// Dynamic import must come after mocks are registered.
const { withServiceTransaction } = await import('../../src/utils/transaction');

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

type EntityA = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    createdById: string;
    updatedById: string;
    deletedAt?: Date | null;
};

type EntityB = {
    id: string;
    label: string;
    createdAt: Date;
    updatedAt: Date;
    createdById: string;
    updatedById: string;
    deletedAt?: Date | null;
};

// ---------------------------------------------------------------------------
// Mock models — record every tx argument passed to create
// ---------------------------------------------------------------------------

class MockModelA implements BaseModel<EntityA> {
    readonly entityName = 'entityA';
    findById = vi.fn();
    findOne = vi.fn();
    findOneWithRelations = vi.fn();
    create = vi.fn();
    update = vi.fn();
    updateById = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    count = vi.fn();
    findAll = vi.fn();
    findAllWithRelations = vi.fn();
    findWithRelations = vi.fn();
    raw = vi.fn();
    getTable = vi.fn();
}

class MockModelB implements BaseModel<EntityB> {
    readonly entityName = 'entityB';
    findById = vi.fn();
    findOne = vi.fn();
    findOneWithRelations = vi.fn();
    create = vi.fn();
    update = vi.fn();
    updateById = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    count = vi.fn();
    findAll = vi.fn();
    findAllWithRelations = vi.fn();
    findWithRelations = vi.fn();
    raw = vi.fn();
    getTable = vi.fn();
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createSchemaA = z.object({ name: z.string().min(1) });
const updateSchemaA = z.object({ name: z.string().min(1).optional() });
const searchSchemaA = z.object({ q: z.string().optional() });

const createSchemaB = z.object({ label: z.string().min(1) });
const updateSchemaB = z.object({ label: z.string().min(1).optional() });
const searchSchemaB = z.object({ q: z.string().optional() });

// ---------------------------------------------------------------------------
// Minimal concrete services — permission hooks are no-ops so all actors pass
// ---------------------------------------------------------------------------

class TestServiceA extends BaseCrudService<
    EntityA,
    MockModelA,
    typeof createSchemaA,
    typeof updateSchemaA,
    typeof searchSchemaA
> {
    protected readonly entityName = 'entityA';
    protected readonly model: MockModelA;
    protected readonly createSchema = createSchemaA;
    protected readonly updateSchema = updateSchemaA;
    protected readonly searchSchema = searchSchemaA;

    constructor(config: ServiceConfig, model: MockModelA) {
        super(config, 'entityA');
        this.model = model;
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    protected _canCreate(): void {}
    protected _canUpdate(): void {}
    protected _canSoftDelete(): void {}
    protected _canHardDelete(): void {}
    protected _canRestore(): void {}
    protected _canView(): void {}
    protected _canList(): void {}
    protected _canSearch(): void {}
    protected _canCount(): void {}
    protected _canUpdateVisibility(): void {}

    protected async _executeSearch(): Promise<PaginatedListOutput<EntityA>> {
        return { items: [], total: 0 };
    }

    protected async _executeCount(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

class TestServiceB extends BaseCrudService<
    EntityB,
    MockModelB,
    typeof createSchemaB,
    typeof updateSchemaB,
    typeof searchSchemaB
> {
    protected readonly entityName = 'entityB';
    protected readonly model: MockModelB;
    protected readonly createSchema = createSchemaB;
    protected readonly updateSchema = updateSchemaB;
    protected readonly searchSchema = searchSchemaB;

    constructor(config: ServiceConfig, model: MockModelB) {
        super(config, 'entityB');
        this.model = model;
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    protected _canCreate(): void {}
    protected _canUpdate(): void {}
    protected _canSoftDelete(): void {}
    protected _canHardDelete(): void {}
    protected _canRestore(): void {}
    protected _canView(): void {}
    protected _canList(): void {}
    protected _canSearch(): void {}
    protected _canCount(): void {}
    protected _canUpdateVisibility(): void {}

    protected async _executeSearch(): Promise<PaginatedListOutput<EntityB>> {
        return { items: [], total: 0 };
    }

    protected async _executeCount(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeActor = (): Actor => ({
    id: 'actor-uuid-0000-0000-0000-000000000001',
    role: RoleEnum.ADMIN,
    permissions: [] as unknown as readonly PermissionEnum[]
});

const makeEntityA = (overrides: Partial<EntityA> = {}): EntityA => ({
    id: 'entity-a-uuid-000-0000-0000-000000000001',
    name: 'Entity A',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: 'actor-uuid-0000-0000-0000-000000000001',
    updatedById: 'actor-uuid-0000-0000-0000-000000000001',
    deletedAt: null,
    ...overrides
});

const makeEntityB = (overrides: Partial<EntityB> = {}): EntityB => ({
    id: 'entity-b-uuid-000-0000-0000-000000000001',
    label: 'Entity B',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: 'actor-uuid-0000-0000-0000-000000000001',
    updatedById: 'actor-uuid-0000-0000-0000-000000000001',
    deletedAt: null,
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cross-service transaction — shared ctx.tx (SPEC-059)', () => {
    let modelA: MockModelA;
    let modelB: MockModelB;
    let serviceA: TestServiceA;
    let serviceB: TestServiceB;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTx.execute.mockResolvedValue(undefined);
        modelA = new MockModelA();
        modelB = new MockModelB();
        serviceA = new TestServiceA({}, modelA);
        serviceB = new TestServiceB({}, modelB);
    });

    /**
     * TC-CX-01: Two services sharing the same withServiceTransaction ctx each
     * forward the SAME ctx.tx reference to their underlying model.create calls.
     * This is the observable proof that both writes participate in a single
     * atomic transaction boundary.
     */
    it('TC-CX-01: serviceA.create and serviceB.create both receive the same ctx.tx', async () => {
        // Arrange
        const actor = makeActor();
        const entityA = makeEntityA();
        const entityB = makeEntityB();

        modelA.create.mockResolvedValue(entityA);
        modelB.create.mockResolvedValue(entityB);

        let capturedCtx: ServiceContext | undefined;

        // Act
        await withServiceTransaction(async (ctx) => {
            capturedCtx = ctx;
            await serviceA.create(actor, { name: entityA.name }, ctx);
            await serviceB.create(actor, { label: entityB.label }, ctx);
        });

        // Assert — the ctx held a non-null tx
        expect(capturedCtx?.tx).toBeDefined();
        expect(capturedCtx?.tx).toBe(mockTx);

        // Assert — modelA.create received the transaction object as second arg
        expect(modelA.create).toHaveBeenCalledTimes(1);
        expect(modelA.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: entityA.name }),
            mockTx
        );

        // Assert — modelB.create received the SAME transaction object
        expect(modelB.create).toHaveBeenCalledTimes(1);
        expect(modelB.create).toHaveBeenCalledWith(
            expect.objectContaining({ label: entityB.label }),
            mockTx
        );

        // Assert — both model calls received the exact same tx reference
        const txPassedToA = modelA.create.mock.calls[0]?.[1];
        const txPassedToB = modelB.create.mock.calls[0]?.[1];
        expect(txPassedToA).toBe(txPassedToB);
    });

    /**
     * TC-CX-02: When serviceB.create throws after serviceA.create succeeds,
     * withServiceTransaction propagates the error. Both model.create calls
     * were made with the same tx (serviceA ran before the failure), and the
     * outer error propagates to the caller — no partial commit is silently
     * swallowed.
     *
     * Because withTransaction is mocked (no real DB), "rollback semantics"
     * are verified by: (a) confirming the outer throw propagates, and
     * (b) confirming both model calls used the same tx object, meaning the
     * mocked withTransaction was invoked once and provided the same boundary.
     */
    it('TC-CX-02: failure in serviceB propagates; both model calls used the same tx', async () => {
        // Arrange
        const actor = makeActor();
        const entityA = makeEntityA();

        modelA.create.mockResolvedValue(entityA);
        modelB.create.mockRejectedValue(new Error('serviceB failure'));

        const { withTransaction } = await import('@repo/db');
        const withTransactionSpy = withTransaction as ReturnType<typeof vi.fn>;

        // Act & Assert — the error from serviceB must propagate out
        await expect(
            withServiceTransaction(async (ctx) => {
                await serviceA.create(actor, { name: entityA.name }, ctx);
                await serviceB.create(actor, { label: 'Entity B' }, ctx);
            })
        ).rejects.toThrow('serviceB failure');

        // Assert — withTransaction was called exactly once (single boundary)
        expect(withTransactionSpy).toHaveBeenCalledTimes(1);

        // Assert — serviceA's model.create was called before the failure
        expect(modelA.create).toHaveBeenCalledTimes(1);
        expect(modelA.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: entityA.name }),
            mockTx
        );

        // Assert — serviceB's model.create was attempted
        expect(modelB.create).toHaveBeenCalledTimes(1);

        // Assert — both received the same tx object (shared boundary)
        const txPassedToA = modelA.create.mock.calls[0]?.[1];
        const txPassedToB = modelB.create.mock.calls[0]?.[1];
        expect(txPassedToA).toBe(mockTx);
        expect(txPassedToB).toBe(mockTx);
        expect(txPassedToA).toBe(txPassedToB);
    });
});
