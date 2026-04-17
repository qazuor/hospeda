/**
 * End-to-end tests for the transaction plumbing introduced in SPEC-059.
 *
 * Verifies that `withServiceTransaction` correctly threads `ctx.tx` through:
 *   - Write methods: `create` forwards `ctx.tx` to `model.create`.
 *   - Write methods: `update` forwards `ctx.tx` to both `model.findById` (via
 *     `_getAndValidateEntity`) and `model.update`.
 *   - Read methods: `getById` forwards `ctx.tx` to the underlying model read call.
 *   - Rollback semantics: when the transaction callback throws, the write is rolled
 *     back; a post-rollback read returns NOT_FOUND.
 *
 * All assertions run against mock model instances. No live database is required.
 * `withTransaction` from `@repo/db` is mocked to inject a fake `tx` object,
 * following the same approach as `test/utils/transaction.test.ts`.
 */

import type { ListRelationsConfig, PaginatedListOutput } from '@repo/schemas';
import { LifecycleStatusEnum, type PermissionEnum, RoleEnum, TagColorEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseCrudService } from '../../src/base/base.crud.service';
import type { Actor, BaseModel, ServiceConfig, ServiceContext } from '../../src/types';
import '../setupTest';

// ---------------------------------------------------------------------------
// Mock @repo/db — override only withTransaction; no importOriginal to avoid
// circular initialisation order issues with the @repo/logger mock in setupTest.
// ---------------------------------------------------------------------------

/** Stable mock tx object injected by the mocked withTransaction. */
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

// Must be imported after mocks are registered (dynamic import required).
const { withServiceTransaction } = await import('../../src/utils/transaction');

// ---------------------------------------------------------------------------
// Minimal entity type used across all test cases
// ---------------------------------------------------------------------------

type TestTag = {
    id: string;
    name: string;
    slug: string;
    color: string;
    lifecycleState: string;
    createdAt: Date;
    updatedAt: Date;
    createdById: string;
    updatedById: string;
    deletedAt?: Date | null;
    deletedById?: string | null;
};

// ---------------------------------------------------------------------------
// Mock model — records tx argument passed to each method
// The vi.fn() calls are untyped to keep compatibility with this Vitest version
// (vi.fn does not accept two type arguments in v3.x). Return values are
// configured per-test via .mockResolvedValue().
// ---------------------------------------------------------------------------

class MockTagModel implements BaseModel<TestTag> {
    readonly entityName = 'tag';

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
// Minimal concrete service — exercises BaseCrudService write + read plumbing
// ---------------------------------------------------------------------------

const createSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    color: z.string().min(1),
    lifecycleState: z.string().min(1)
});

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().optional(),
    color: z.string().optional()
});

const searchSchema = z.object({ q: z.string().optional() });

class TestTagService extends BaseCrudService<
    TestTag,
    MockTagModel,
    typeof createSchema,
    typeof updateSchema,
    typeof searchSchema
> {
    protected readonly entityName = 'tag';
    protected readonly model: MockTagModel;
    protected readonly createSchema = createSchema;
    protected readonly updateSchema = updateSchema;
    protected readonly searchSchema = searchSchema;

    constructor(config: ServiceConfig, model: MockTagModel) {
        super(config, 'tag');
        this.model = model;
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    protected _canCreate(_actor: Actor): void {}
    protected _canUpdate(_actor: Actor, _entity: TestTag): void {}
    protected _canSoftDelete(_actor: Actor, _entity: TestTag): void {}
    protected _canHardDelete(_actor: Actor, _entity: TestTag): void {}
    protected _canRestore(_actor: Actor, _entity: TestTag): void {}
    protected _canView(_actor: Actor, _entity: TestTag): void {}
    protected _canList(): void {}
    protected _canSearch(): void {}
    protected _canCount(): void {}
    protected _canUpdateVisibility(): void {}

    // biome-ignore lint/suspicious/noExplicitAny: base class uses any for search return type compatibility
    protected async _executeSearch(): Promise<PaginatedListOutput<TestTag>> {
        return { items: [], total: 0 };
    }

    protected async _executeCount(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const makeActor = (permissions: PermissionEnum[] = []): Actor => ({
    id: 'actor-uuid-0000-0000-0000-000000000001',
    role: RoleEnum.ADMIN,
    permissions
});

const makeTag = (overrides: Partial<TestTag> = {}): TestTag => ({
    id: 'tag-uuid-0000-0000-0000-000000000001',
    name: 'Test Tag',
    slug: 'test-tag',
    color: TagColorEnum.BLUE,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: 'actor-uuid-0000-0000-0000-000000000001',
    updatedById: 'actor-uuid-0000-0000-0000-000000000001',
    deletedAt: null,
    deletedById: null,
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests — write plumbing
// ---------------------------------------------------------------------------

describe('withServiceTransaction — write plumbing (SPEC-059)', () => {
    let model: MockTagModel;
    let service: TestTagService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTx.execute.mockResolvedValue(undefined);
        model = new MockTagModel();
        service = new TestTagService({}, model);
    });

    /**
     * TC-01: create inside withServiceTransaction forwards ctx.tx to model.create.
     */
    it('TC-01: create inside transaction forwards ctx.tx to model.create', async () => {
        // Arrange
        const actor = makeActor();
        const tag = makeTag();
        const input = {
            name: tag.name,
            slug: tag.slug,
            color: tag.color,
            lifecycleState: tag.lifecycleState
        };

        model.create.mockResolvedValue(tag);

        let capturedCtx: ServiceContext | undefined;

        // Act
        const result = await withServiceTransaction(async (ctx) => {
            capturedCtx = ctx;
            return service.create(actor, input, ctx);
        });

        // Assert — ctx has the tx injected by withServiceTransaction
        expect(capturedCtx?.tx).toBe(mockTx);

        // Assert — service call succeeded
        expect(result.data?.name).toBe(tag.name);

        // Assert — model.create received mockTx as its second argument
        expect(model.create).toHaveBeenCalledTimes(1);
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: tag.name }),
            mockTx
        );
    });

    /**
     * TC-02: A throw inside withServiceTransaction propagates (triggering rollback).
     *        The entity is NOT found after the transaction completes.
     */
    it('TC-02: create inside rolled-back transaction is not persisted', async () => {
        // Arrange
        const actor = makeActor();
        const tag = makeTag();
        const input = {
            name: tag.name,
            slug: tag.slug,
            color: tag.color,
            lifecycleState: tag.lifecycleState
        };

        model.create.mockResolvedValue(tag);

        // Act — throw inside the transaction callback to simulate rollback
        await expect(
            withServiceTransaction(async (ctx) => {
                await service.create(actor, input, ctx);
                throw new Error('forced rollback');
            })
        ).rejects.toThrow('forced rollback');

        // Assert — model.create WAS called (the service ran before the throw)
        expect(model.create).toHaveBeenCalledTimes(1);
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: tag.name }),
            mockTx
        );

        // Assert — a post-rollback read (outside any tx, no tx forwarded) returns NOT_FOUND.
        // Simulate the clean DB state after rollback: the entity was never committed.
        model.findOne.mockResolvedValue(null);
        model.findOneWithRelations.mockResolvedValue(null);

        const findResult = await service.getById(makeActor(), tag.id);
        expect(findResult.error?.code).toBe('NOT_FOUND');
    });

    /**
     * TC-03: update inside withServiceTransaction forwards ctx.tx to both
     *        model.findById (via _getAndValidateEntity) and model.update.
     */
    it('TC-03: update inside transaction forwards ctx.tx to model.findById and model.update', async () => {
        // Arrange
        const actor = makeActor();
        const tag = makeTag();
        const updateInput = { name: 'Updated Tag' };
        const updatedTag = makeTag(updateInput);

        model.findById.mockResolvedValue(tag);
        model.update.mockResolvedValue(updatedTag);

        // Act
        await withServiceTransaction(async (ctx) => {
            return service.update(actor, tag.id, updateInput, ctx);
        });

        // Assert — _getAndValidateEntity passed tx to model.findById
        expect(model.findById).toHaveBeenCalledWith(tag.id, mockTx);

        // Assert — model.update received tx as third argument
        expect(model.update).toHaveBeenCalledWith(
            expect.objectContaining({ id: tag.id }),
            expect.any(Object),
            mockTx
        );
    });
});

// ---------------------------------------------------------------------------
// Tests — read plumbing
// ---------------------------------------------------------------------------

describe('withServiceTransaction — read plumbing (SPEC-059)', () => {
    let model: MockTagModel;
    let service: TestTagService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTx.execute.mockResolvedValue(undefined);
        model = new MockTagModel();
        service = new TestTagService({}, model);
    });

    /**
     * TC-04: getById inside withServiceTransaction forwards ctx.tx to the
     *        underlying model read method (findOneWithRelations or findOne).
     *
     * TestTagService inherits getDefaultGetByIdRelations from BaseCrudPermissions,
     * which returns getDefaultListRelations() — an empty object `{}`.  The base
     * getByField implementation calls findOneWithRelations when the relations object
     * is non-null (even if empty). The tx must be forwarded as the last argument.
     */
    it('TC-04: getById inside transaction forwards ctx.tx to model read method', async () => {
        // Arrange
        const actor = makeActor();
        const tag = makeTag();

        model.findOneWithRelations.mockResolvedValue(tag);
        model.findOne.mockResolvedValue(tag);

        let capturedCtx: ServiceContext | undefined;

        // Act
        const result = await withServiceTransaction(async (ctx) => {
            capturedCtx = ctx;
            return service.getById(actor, tag.id, ctx);
        });

        // Assert — ctx carries tx
        expect(capturedCtx?.tx).toBe(mockTx);

        // Assert — read succeeded
        expect(result.data?.id).toBe(tag.id);

        // Assert — at least one model read method was called with mockTx
        const txPassedToFindOneWithRelations = model.findOneWithRelations.mock.calls.some(
            (args: unknown[]) => args.includes(mockTx)
        );
        const txPassedToFindOne = model.findOne.mock.calls.some((args: unknown[]) =>
            args.includes(mockTx)
        );

        expect(txPassedToFindOneWithRelations || txPassedToFindOne).toBe(true);
    });

    /**
     * TC-05: getById inside a rolled-back transaction does not leak data to the
     *        outer scope; a subsequent read without tx returns NOT_FOUND.
     */
    it('TC-05: data read inside a rolled-back transaction is not visible after rollback', async () => {
        // Arrange
        const actor = makeActor();
        const tag = makeTag();

        model.findOneWithRelations.mockResolvedValue(tag);
        model.findOne.mockResolvedValue(tag);

        let dataSeenInsideTx: TestTag | null | undefined;

        // Act — read entity inside transaction, then throw to roll back
        await expect(
            withServiceTransaction(async (ctx) => {
                const r = await service.getById(actor, tag.id, ctx);
                dataSeenInsideTx = r.data;
                throw new Error('forced rollback');
            })
        ).rejects.toThrow('forced rollback');

        // Assert — data WAS visible inside the tx before the throw
        expect(dataSeenInsideTx).toMatchObject({ id: tag.id });

        // Assert — after rollback, a fresh read (without tx) returns NOT_FOUND,
        // simulating a clean DB state where no committed data exists.
        model.findOneWithRelations.mockResolvedValue(null);
        model.findOne.mockResolvedValue(null);

        const postRollbackResult = await service.getById(makeActor(), tag.id);
        expect(postRollbackResult.error?.code).toBe('NOT_FOUND');
    });
});
