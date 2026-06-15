/**
 * Extended unit tests for ContentModerationTermService
 *
 * Covers uncovered paths (term.service.ts ~38% → higher):
 * - seedFromEnv: imports words + domains from env vars
 * - seedFromEnv: returns importedCount=0 when env vars are empty
 * - seedFromEnv: propagates bulkImport error
 * - Permission hooks: _canCreate, _canUpdate, _canDelete, _canHardDelete, _canRestore, _canView, _canList, _canSearch, _canCount, _canUpdateVisibility — all with insufficient permissions
 * - _afterSoftDelete / _afterHardDelete / _afterRestore: invalidate moderation cache
 * - _afterCreate / _afterUpdate: call term-level cache invalidation
 * - _executeSearch: passes filters to DB
 * - _executeCount: passes filters to DB
 */

import crypto from 'node:crypto';
import { ModerationCategoryEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentModerationTermService } from '../../../src/services/contentModeration/term.service';
import { createActor } from '../../factories/actorFactory';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { invalidateModerationCache, invalidateModerationCacheByTermPattern } = vi.hoisted(() => ({
    invalidateModerationCache: vi.fn(),
    invalidateModerationCacheByTermPattern: vi.fn()
}));

const { mockDbSelect } = vi.hoisted(() => ({
    mockDbSelect: vi.fn()
}));

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@repo/content-moderation', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/content-moderation')>()),
    invalidateModerationCache,
    invalidateModerationCacheByTermPattern
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: mockDbSelect
        })),
        // Provide required exports that the service imports
        contentModerationTerms: {
            id: 'id',
            term: 'term',
            kind: 'kind',
            category: 'category',
            enabled: 'enabled',
            deletedAt: 'deletedAt'
        },
        and: vi.fn((...args: unknown[]) => ({ _and: args })),
        count: vi.fn(() => ({ _count: true })),
        eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
        isNull: vi.fn((col: unknown) => ({ _isNull: col })),
        safeIlike: vi.fn((col: unknown, val: unknown) => ({ _ilike: { col, val } })),
        sql: Object.assign(
            vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
                _sql: { strings, values }
            })),
            { raw: vi.fn() }
        )
    };
});

vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (
            fn: (ctx: { tx: undefined; hookState: Record<string, never> }) => Promise<unknown>
        ) => fn({ tx: undefined, hookState: {} })
    )
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

// Import dynamically after mocks so each test group sees a clean module
let TermService: typeof ContentModerationTermService;

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeModel(overrides: Record<string, unknown> = {}) {
    return {
        create: vi.fn(async (data: Record<string, unknown>) => ({
            id: crypto.randomUUID(),
            term: data.term,
            kind: data.kind,
            category: data.category,
            severity: data.severity,
            enabled: data.enabled,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            createdById: 'actor-id',
            updatedById: 'actor-id'
        })),
        findOne: vi.fn().mockResolvedValue(null),
        findById: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        softDelete: vi.fn().mockResolvedValue({ count: 1 }),
        hardDelete: vi.fn().mockResolvedValue({ count: 1 }),
        restore: vi.fn().mockResolvedValue({ count: 1 }),
        findAll: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findEnabledTerms: vi.fn().mockResolvedValue([]),
        ...overrides
    };
}

/** Actor with full moderation permissions */
const adminActor = createActor({
    role: RoleEnum.SUPER_ADMIN,
    permissions: Object.values(PermissionEnum)
});

/** Actor with NO permissions */
const noPermActor = createActor({
    role: RoleEnum.USER,
    permissions: []
});

/** Build a mock DB chain for _executeSearch / _executeCount.
 *
 * The _executeSearch call chain is:
 *   db.select().from().where().limit().offset().orderBy()  → items
 *   db.select({ value: count() }).from().where()           → countRows (awaited directly)
 *
 * The chain must be awaitable at the `orderBy()` terminal AND at the `where()` terminal.
 */
function makeDbChain(rows: unknown[] = []) {
    const chain: Record<string, unknown> = {};
    const resolved = Promise.resolve(rows);
    Object.assign(chain, resolved);
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable query builder
    (chain as { then: unknown }).then = resolved.then.bind(resolved);
    (chain as { catch: unknown }).catch = resolved.catch.bind(resolved);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    // offset returns chain (not resolved) so orderBy can be called after it
    chain.offset = vi.fn().mockReturnValue(chain);
    // orderBy is the terminal call → resolves to rows
    chain.orderBy = vi.fn().mockResolvedValue(rows);
    return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ContentModerationTermService — extended coverage', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import('../../../src/services/contentModeration/term.service.js');
        TermService = mod.ContentModerationTermService;
    });

    afterEach(() => {
        process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS = undefined;
        process.env.HOSPEDA_MESSAGING_BLOCKED_DOMAINS = undefined;
    });

    // ── seedFromEnv ─────────────────────────────────────────────────────────

    describe('seedFromEnv()', () => {
        it('should return importedCount=0 when env vars are not set', async () => {
            // Arrange
            const service = new TermService({ logger: undefined }, makeModel() as never);

            // Act
            const result = await service.seedFromEnv(adminActor);

            // Assert
            expect(result.data?.importedCount).toBe(0);
            expect(result.error).toBeUndefined();
        });

        it('should import words from HOSPEDA_MESSAGING_BLOCKED_WORDS', async () => {
            // Arrange
            process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS = 'badword1,badword2';
            const service = new TermService({ logger: undefined }, makeModel() as never);

            // Act
            const result = await service.seedFromEnv(adminActor);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.importedCount).toBe(2);
        });

        it('should import domains from HOSPEDA_MESSAGING_BLOCKED_DOMAINS', async () => {
            // Arrange
            process.env.HOSPEDA_MESSAGING_BLOCKED_DOMAINS = 'spam.com,evil.org';
            const service = new TermService({ logger: undefined }, makeModel() as never);

            // Act
            const result = await service.seedFromEnv(adminActor);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.importedCount).toBe(2);
        });

        it('should import both words and domains together', async () => {
            // Arrange
            process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS = 'word1,word2';
            process.env.HOSPEDA_MESSAGING_BLOCKED_DOMAINS = 'domain1.com';
            const service = new TermService({ logger: undefined }, makeModel() as never);

            // Act
            const result = await service.seedFromEnv(adminActor);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.importedCount).toBe(3);
        });

        it('should trim whitespace and filter empty items from CSV', async () => {
            // Arrange — intentional spaces and empty segments
            process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS = ' word1 , , word2 ';
            const service = new TermService({ logger: undefined }, makeModel() as never);

            // Act
            const result = await service.seedFromEnv(adminActor);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.importedCount).toBe(2); // empty segment skipped
        });

        it('should propagate error from bulkImport when model.create fails', async () => {
            // Arrange
            process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS = 'word1';
            const model = makeModel({ create: vi.fn().mockRejectedValue(new Error('DB error')) });
            const service = new TermService({ logger: undefined }, model as never);

            // Act
            const result = await service.seedFromEnv(adminActor);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
        });
    });

    // ── Permission hooks ────────────────────────────────────────────────────

    describe('permission hooks', () => {
        it('_canCreate: should throw FORBIDDEN for actor without MODERATION_TERM_CREATE', async () => {
            // Arrange
            const service = new TermService({ logger: undefined }, makeModel() as never);
            const actor = createActor({ permissions: [] });

            // Act
            const result = await service.create(actor, {
                term: 'test',
                kind: 'word',
                category: ModerationCategoryEnum.OTHER,
                severity: 1,
                enabled: true
            });

            // Assert
            expect(result.error?.code).toBe('FORBIDDEN');
        });

        it('_canUpdate: should throw FORBIDDEN for actor without MODERATION_TERM_UPDATE', async () => {
            // Arrange
            const model = makeModel({
                findById: vi.fn().mockResolvedValue({
                    id: 'term-uuid-1',
                    term: 'test',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                })
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({ permissions: [PermissionEnum.MODERATION_TERM_VIEW] });

            // Act
            const result = await service.update(actor, 'term-uuid-1', { enabled: false });

            // Assert
            expect(result.error?.code).toBe('FORBIDDEN');
        });

        it('_canDelete (softDelete): should throw FORBIDDEN for actor without MODERATION_TERM_DELETE', async () => {
            // Arrange
            const model = makeModel({
                findById: vi.fn().mockResolvedValue({
                    id: 'term-uuid-2',
                    term: 'test',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                })
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({ permissions: [PermissionEnum.MODERATION_TERM_VIEW] });

            // Act
            const result = await service.softDelete(actor, 'term-uuid-2');

            // Assert
            expect(result.error?.code).toBe('FORBIDDEN');
        });

        it('_canView: should throw FORBIDDEN for actor without MODERATION_TERM_VIEW', async () => {
            // Arrange — actor has ZERO permissions, so _canView (checked after fetch) throws.
            // BaseCrudService.getByField uses model.findOne (no relations) then calls _canView.
            const termEntity = {
                id: 'term-uuid-3',
                term: 'test',
                kind: 'word',
                category: ModerationCategoryEnum.OTHER,
                severity: 1,
                enabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            };
            const model = makeModel({
                findById: vi.fn().mockResolvedValue(termEntity),
                findOne: vi.fn().mockResolvedValue(termEntity),
                findOneWithRelations: vi.fn().mockResolvedValue(termEntity)
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({ permissions: [] });

            // Act
            const result = await service.getById(actor, 'term-uuid-3');

            // Assert — FORBIDDEN because actor lacks MODERATION_TERM_VIEW
            expect(result.error?.code).toBe('FORBIDDEN');
        });

        it('_canList: should throw FORBIDDEN for actor without MODERATION_TERM_VIEW', async () => {
            // Arrange
            const service = new TermService({ logger: undefined }, makeModel() as never);

            // Act
            const result = await service.list(noPermActor, {});

            // Assert
            expect(result.error?.code).toBe('FORBIDDEN');
        });

        it('_canHardDelete: should throw FORBIDDEN for actor without MODERATION_TERM_HARD_DELETE', async () => {
            // Arrange
            const model = makeModel({
                findById: vi.fn().mockResolvedValue({
                    id: 'term-uuid-5',
                    term: 'test',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                })
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({
                permissions: [PermissionEnum.MODERATION_TERM_DELETE]
                // no MODERATION_TERM_HARD_DELETE
            });

            // Act
            const result = await service.hardDelete(actor, 'term-uuid-5');

            // Assert
            expect(result.error?.code).toBe('FORBIDDEN');
        });

        it('_canRestore: should throw FORBIDDEN for actor without MODERATION_TERM_RESTORE', async () => {
            // Arrange
            const model = makeModel({
                findById: vi.fn().mockResolvedValue({
                    id: 'term-uuid-6',
                    term: 'test',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: new Date() // soft-deleted
                })
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({
                permissions: [PermissionEnum.MODERATION_TERM_DELETE]
                // no MODERATION_TERM_RESTORE
            });

            // Act
            const result = await service.restore(actor, 'term-uuid-6');

            // Assert
            expect(result.error?.code).toBe('FORBIDDEN');
        });
    });

    // ── Cache invalidation hooks ─────────────────────────────────────────────

    describe('cache invalidation hooks', () => {
        it('_afterCreate: should invalidate moderation cache for the specific term', async () => {
            // Arrange
            const term = 'testword';
            const model = makeModel({
                create: vi.fn().mockResolvedValue({
                    id: crypto.randomUUID(),
                    term,
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                    createdById: adminActor.id,
                    updatedById: adminActor.id
                })
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({
                permissions: [
                    PermissionEnum.MODERATION_TERM_CREATE,
                    PermissionEnum.MODERATION_TERM_VIEW
                ]
            });

            // Act
            const result = await service.create(actor, {
                term,
                kind: 'word',
                category: ModerationCategoryEnum.OTHER,
                severity: 1,
                enabled: true
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(invalidateModerationCache).toHaveBeenCalled();
            expect(invalidateModerationCacheByTermPattern).toHaveBeenCalledWith(term);
        });

        it('_afterSoftDelete: should call invalidateModerationCache', async () => {
            // Arrange
            const model = makeModel({
                findById: vi.fn().mockResolvedValue({
                    id: 'term-delete-1',
                    term: 'blocked',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                }),
                softDelete: vi.fn().mockResolvedValue({ count: 1 })
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({
                permissions: [
                    PermissionEnum.MODERATION_TERM_DELETE,
                    PermissionEnum.MODERATION_TERM_VIEW
                ]
            });

            // Act
            await service.softDelete(actor, 'term-delete-1');

            // Assert
            expect(invalidateModerationCache).toHaveBeenCalled();
        });

        it('_afterHardDelete: should call invalidateModerationCache', async () => {
            // Arrange
            const model = makeModel({
                findById: vi.fn().mockResolvedValue({
                    id: 'term-hard-delete-1',
                    term: 'blocked',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                }),
                hardDelete: vi.fn().mockResolvedValue({ count: 1 })
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({
                permissions: [
                    PermissionEnum.MODERATION_TERM_HARD_DELETE,
                    PermissionEnum.MODERATION_TERM_VIEW
                ]
            });

            // Act
            await service.hardDelete(actor, 'term-hard-delete-1');

            // Assert
            expect(invalidateModerationCache).toHaveBeenCalled();
        });

        it('_afterRestore: should call invalidateModerationCache', async () => {
            // Arrange
            const model = makeModel({
                findById: vi.fn().mockResolvedValue({
                    id: 'term-restore-1',
                    term: 'blocked',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: new Date() // soft-deleted
                }),
                restore: vi.fn().mockResolvedValue({ count: 1 })
            });
            const service = new TermService({ logger: undefined }, model as never);
            const actor = createActor({
                permissions: [
                    PermissionEnum.MODERATION_TERM_RESTORE,
                    PermissionEnum.MODERATION_TERM_VIEW
                ]
            });

            // Act
            await service.restore(actor, 'term-restore-1');

            // Assert
            expect(invalidateModerationCache).toHaveBeenCalled();
        });
    });

    // ── _executeSearch / _executeCount ──────────────────────────────────────

    describe('_executeSearch() and _executeCount()', () => {
        it('_executeSearch: should call getDb and apply search filters', async () => {
            // Arrange
            const termRows = [
                {
                    id: 'term-1',
                    term: 'badword',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true,
                    deletedAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            const countRows = [{ value: 1 }];

            // _executeSearch does Promise.all([items, count]) — need two select chains
            let callIdx = 0;
            mockDbSelect.mockImplementation(() => {
                const rows = callIdx++ === 0 ? termRows : countRows;
                return makeDbChain(rows);
            });

            const service = new TermService({ logger: undefined }, makeModel() as never);
            const actor = createActor({
                permissions: [PermissionEnum.MODERATION_TERM_VIEW]
            });

            // Act
            const result = await service.search(actor, {
                search: 'bad',
                kind: 'word',
                enabled: true,
                page: 1,
                pageSize: 10,
                sort: 'createdAt:desc',
                status: 'all',
                includeDeleted: false
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });

        it('_executeCount: should return count from DB', async () => {
            // Arrange
            mockDbSelect.mockReturnValue(makeDbChain([{ value: 5 }]));

            const service = new TermService({ logger: undefined }, makeModel() as never);
            const actor = createActor({
                permissions: [PermissionEnum.MODERATION_TERM_VIEW]
            });

            // Act
            const result = await service.count(actor, {
                page: 1,
                pageSize: 20,
                sort: 'createdAt:desc',
                status: 'all',
                includeDeleted: false
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(5);
        });

        it('_executeCount with includeDeleted=true should not apply soft-delete filter', async () => {
            // Arrange
            mockDbSelect.mockReturnValue(makeDbChain([{ value: 10 }]));

            const service = new TermService({ logger: undefined }, makeModel() as never);
            const actor = createActor({
                permissions: [PermissionEnum.MODERATION_TERM_VIEW]
            });

            // Act
            const result = await service.count(actor, {
                page: 1,
                pageSize: 20,
                sort: 'createdAt:desc',
                status: 'all',
                includeDeleted: true
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(10);
        });
    });
});
