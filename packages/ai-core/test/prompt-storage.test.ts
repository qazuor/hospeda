/**
 * Tests for new ai-core prompt storage helpers (SPEC-173 T-028).
 *
 * Covers: createPromptVersion, activatePromptVersion, listPromptVersionsByFeature.
 * The DB is stubbed entirely via `vi.mock('@repo/db')` — no real connection needed.
 *
 * Strategy:
 * - Mock `getDb` + `withTransaction` + all Drizzle chain helpers.
 * - Capture insert/update/select arguments to assert correctness.
 * - Verify invariants: version auto-increment, deactivation of others on activate.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @repo/db BEFORE importing the modules under test
// ---------------------------------------------------------------------------

const { mockWithTransaction } = vi.hoisted(() => ({
    mockWithTransaction: vi.fn()
}));

vi.mock('@repo/db', () => ({
    aiPromptVersions: {
        id: 'id',
        feature: 'feature',
        version: 'version',
        content: 'content',
        isActive: 'is_active',
        createdBy: 'created_by',
        createdAt: 'created_at',
        deletedAt: 'deleted_at'
    },
    eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
    and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
    isNull: vi.fn((_col) => `isNull(${String(_col)})`),
    desc: vi.fn((_col) => `desc(${String(_col)})`),
    max: vi.fn((_col) => 'max_col'),
    getDb: vi.fn(),
    withTransaction: mockWithTransaction
}));

import * as dbModule from '@repo/db';
import {
    activatePromptVersion,
    createPromptVersion,
    listPromptVersionsByFeature
} from '../src/storage/index.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helper — build chainable select stub with a fixed result
// ---------------------------------------------------------------------------

/**
 * Builds a `select().from().where().orderBy()` chain for listPromptVersionsByFeature.
 * Also supports `.where().limit()` for getActivePrompt-style calls.
 */
function buildSelectChain(rows: unknown[]): ReturnType<typeof vi.fn> {
    const limitFn = vi.fn().mockResolvedValue(rows);
    const orderByFn = vi.fn().mockResolvedValue(rows); // direct resolve for list queries
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn, orderBy: orderByFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn, orderBy: orderByFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });
    return selectFn;
}

/**
 * Builds a `select().from().where().limit()` chain (no orderBy).
 * Used by createPromptVersion max-query and activatePromptVersion lookup.
 */
function buildSelectNoOrderChain(rows: unknown[]): ReturnType<typeof vi.fn> {
    const limitFn = vi.fn().mockResolvedValue(rows);
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });
    return selectFn;
}

function buildInsertChain(rows: unknown[]): ReturnType<typeof vi.fn> {
    const returningFn = vi.fn().mockResolvedValue(rows);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    const insertFn = vi.fn().mockReturnValue({ values: valuesFn });
    return insertFn;
}

function buildUpdateChain(rows: unknown[]): ReturnType<typeof vi.fn> {
    const returningFn = vi.fn().mockResolvedValue(rows);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    return updateFn;
}

/** Update chain that returns void (no `.returning()` called). */
function buildUpdateVoidChain(): ReturnType<typeof vi.fn> {
    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    return updateFn;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const PROMPT_ROW_V1 = {
    id: 'bbbbbbbb-0000-0000-0000-000000000001',
    feature: 'text_improve',
    version: 1,
    content: 'You are a writing assistant.',
    isActive: true,
    createdBy: ACTOR_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    deletedById: null
};

const PROMPT_ROW_V2 = {
    ...PROMPT_ROW_V1,
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    version: 2,
    content: 'You are an expert writing assistant.',
    isActive: false
};

// ---------------------------------------------------------------------------
// createPromptVersion
// ---------------------------------------------------------------------------

describe('createPromptVersion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when no previous versions exist', () => {
        it('should insert version 1', async () => {
            // Arrange — withTransaction delegates to the callback synchronously.
            const selectMaxFn = buildSelectNoOrderChain([{ maxVersion: null }]);
            const updateFn = buildUpdateVoidChain();
            const insertFn = buildInsertChain([{ ...PROMPT_ROW_V1, version: 1 }]);

            const fakeTx = { select: selectMaxFn, update: updateFn, insert: insertFn };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act
            const row = await createPromptVersion({
                feature: 'text_improve',
                content: 'You are a writing assistant.',
                isActive: true,
                actorId: ACTOR_ID
            });

            // Assert: version = 0 (null max) + 1 = 1
            expect(row.version).toBe(1);
            expect(insertFn).toHaveBeenCalled();
        });
    });

    describe('when versions already exist', () => {
        it('should insert version = max + 1', async () => {
            // Arrange
            const selectMaxFn = buildSelectNoOrderChain([{ maxVersion: 3 }]);
            const updateFn = buildUpdateVoidChain();
            const insertFn = buildInsertChain([{ ...PROMPT_ROW_V1, version: 4 }]);

            const fakeTx = { select: selectMaxFn, update: updateFn, insert: insertFn };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act
            const row = await createPromptVersion({
                feature: 'text_improve',
                content: 'new content',
                isActive: true,
                actorId: ACTOR_ID
            });

            // Assert
            expect(row.version).toBe(4);
        });

        it('should deactivate all existing rows when isActive=true', async () => {
            // Arrange
            const selectMaxFn = buildSelectNoOrderChain([{ maxVersion: 1 }]);
            const updateFn = buildUpdateVoidChain();
            const insertFn = buildInsertChain([{ ...PROMPT_ROW_V1, version: 2 }]);

            const fakeTx = { select: selectMaxFn, update: updateFn, insert: insertFn };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act
            await createPromptVersion({
                feature: 'text_improve',
                content: 'active prompt',
                isActive: true,
                actorId: ACTOR_ID
            });

            // Assert: update was called to deactivate others
            expect(updateFn).toHaveBeenCalled();
        });

        it('should NOT deactivate others when isActive=false', async () => {
            // Arrange
            const selectMaxFn = buildSelectNoOrderChain([{ maxVersion: 1 }]);
            const updateFn = buildUpdateVoidChain();
            const insertFn = buildInsertChain([{ ...PROMPT_ROW_V1, version: 2, isActive: false }]);

            const fakeTx = { select: selectMaxFn, update: updateFn, insert: insertFn };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act
            const row = await createPromptVersion({
                feature: 'text_improve',
                content: 'draft prompt',
                isActive: false,
                actorId: ACTOR_ID
            });

            // Assert: update NOT called (no deactivation step)
            expect(updateFn).not.toHaveBeenCalled();
            expect(row.isActive).toBe(false);
        });
    });

    describe('when a tx is provided', () => {
        it('should use the provided tx instead of withTransaction', async () => {
            // Arrange
            const selectMaxFn = buildSelectNoOrderChain([{ maxVersion: 2 }]);
            const updateFn = buildUpdateVoidChain();
            const insertFn = buildInsertChain([{ ...PROMPT_ROW_V1, version: 3 }]);

            const fakeTx = { select: selectMaxFn, update: updateFn, insert: insertFn };

            // Act
            const row = await createPromptVersion({
                feature: 'text_improve',
                content: 'tx prompt',
                isActive: true,
                actorId: ACTOR_ID,
                tx: fakeTx as never
            });

            // Assert: withTransaction was NOT called (tx was passed in)
            expect(mockWithTransaction).not.toHaveBeenCalled();
            expect(row.version).toBe(3);
        });
    });

    describe('when the insert returns no row', () => {
        it('should throw an unexpected-state error', async () => {
            // Arrange
            const selectMaxFn = buildSelectNoOrderChain([{ maxVersion: 0 }]);
            const updateFn = buildUpdateVoidChain();
            const insertFn = buildInsertChain([]); // empty returning

            const fakeTx = { select: selectMaxFn, update: updateFn, insert: insertFn };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act + Assert
            await expect(
                createPromptVersion({
                    feature: 'text_improve',
                    content: 'boom',
                    isActive: true,
                    actorId: ACTOR_ID
                })
            ).rejects.toThrow('createPromptVersion');
        });
    });

    describe('when maxResult returns an empty array (no rows at all)', () => {
        it('should treat maxVersion as 0 and insert version 1', async () => {
            // Arrange — selectMaxFn returns [] (no rows), exercising the
            // `maxResult[0]?.maxVersion ?? 0` branch where `maxResult[0]` is
            // undefined (the ?. yields undefined, ?? gives 0).
            const selectMaxFn = buildSelectNoOrderChain([]); // empty — no max row
            const updateFn = buildUpdateVoidChain();
            const insertFn = buildInsertChain([{ ...PROMPT_ROW_V1, version: 1 }]);

            const fakeTx = { select: selectMaxFn, update: updateFn, insert: insertFn };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act
            const row = await createPromptVersion({
                feature: 'text_improve',
                content: 'first ever prompt',
                isActive: false,
                actorId: ACTOR_ID
            });

            // Assert — version should be 1 (0 + 1 from the fallback)
            expect(row.version).toBe(1);
        });
    });
});

// ---------------------------------------------------------------------------
// activatePromptVersion
// ---------------------------------------------------------------------------

describe('activatePromptVersion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when the version exists', () => {
        it('should deactivate all rows for the feature and activate the target', async () => {
            // Arrange
            const selectFn = buildSelectNoOrderChain([
                { id: PROMPT_ROW_V1.id, feature: PROMPT_ROW_V1.feature }
            ]);
            // First update: deactivate all (no returning); second update: activate target (returning)
            const deactivateUpdate = buildUpdateVoidChain();
            const activateUpdate = buildUpdateChain([{ ...PROMPT_ROW_V1, isActive: true }]);

            let updateCallCount = 0;
            const updateFn = vi.fn(() => {
                updateCallCount++;
                if (updateCallCount === 1) {
                    // deactivate step — no returning
                    const setFn = vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(undefined)
                    });
                    void deactivateUpdate;
                    return { set: setFn };
                }
                // activate step — with returning
                return activateUpdate();
            });

            const fakeTx = { select: selectFn, update: updateFn };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act
            const row = await activatePromptVersion({ id: PROMPT_ROW_V1.id });

            // Assert: result is the activated row
            expect(row).not.toBeNull();
            expect(updateFn).toHaveBeenCalledTimes(2);
        });

        it('should return null when the version ID does not exist', async () => {
            // Arrange
            const selectFn = buildSelectNoOrderChain([]); // not found
            const fakeTx = { select: selectFn, update: vi.fn() };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act
            const row = await activatePromptVersion({ id: 'nonexistent-uuid' });

            // Assert
            expect(row).toBeNull();
        });

        it('should return null when the activate update returns no rows', async () => {
            // Arrange — target row exists, but the final activate UPDATE.returning()
            // returns an empty array.  This covers the `row ?? null` branch in
            // activatePromptVersion (prompt.storage.ts line ~263).
            const selectFn = buildSelectNoOrderChain([
                { id: PROMPT_ROW_V1.id, feature: PROMPT_ROW_V1.feature }
            ]);
            let updateCallCount = 0;
            const updateFn = vi.fn(() => {
                updateCallCount++;
                if (updateCallCount === 1) {
                    // First update: deactivate all rows (no returning)
                    const setFn = vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(undefined)
                    });
                    return { set: setFn };
                }
                // Second update: activate target — returning() returns EMPTY array
                const returningFn = vi.fn().mockResolvedValue([]); // empty → row = undefined
                const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
                const setFn = vi.fn().mockReturnValue({ where: whereFn });
                return { set: setFn };
            });

            const fakeTx = { select: selectFn, update: updateFn };
            mockWithTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(fakeTx)
            );

            // Act
            const row = await activatePromptVersion({ id: PROMPT_ROW_V1.id });

            // Assert — undefined from returning() is coerced to null
            expect(row).toBeNull();
        });
    });

    describe('when a tx is provided', () => {
        it('should not call withTransaction', async () => {
            // Arrange
            const selectFn = buildSelectNoOrderChain([
                { id: PROMPT_ROW_V1.id, feature: PROMPT_ROW_V1.feature }
            ]);
            let updateCallCount = 0;
            const updateFn = vi.fn(() => {
                updateCallCount++;
                if (updateCallCount === 1) {
                    const setFn = vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(undefined)
                    });
                    return { set: setFn };
                }
                const returningFn = vi.fn().mockResolvedValue([PROMPT_ROW_V2]);
                const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
                const setFn = vi.fn().mockReturnValue({ where: whereFn });
                return { set: setFn };
            });

            const fakeTx = { select: selectFn, update: updateFn };

            // Act
            await activatePromptVersion({ id: PROMPT_ROW_V1.id, tx: fakeTx as never });

            // Assert
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// listPromptVersionsByFeature
// ---------------------------------------------------------------------------

describe('listPromptVersionsByFeature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when versions exist', () => {
        it('should return rows ordered desc by version (mock order)', async () => {
            // Arrange
            const rows = [PROMPT_ROW_V2, PROMPT_ROW_V1]; // v2 first = desc
            mockGetDb.mockReturnValue({ select: buildSelectChain(rows) });

            // Act
            const result = await listPromptVersionsByFeature({ feature: 'text_improve' });

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(PROMPT_ROW_V2);
            expect(result[1]).toEqual(PROMPT_ROW_V1);
        });

        it('should exclude soft-deleted rows by default', async () => {
            // Arrange — only v1 (active, not deleted)
            mockGetDb.mockReturnValue({
                select: buildSelectChain([PROMPT_ROW_V1])
            });

            // Act
            const result = await listPromptVersionsByFeature({ feature: 'text_improve' });

            // Assert
            expect(result).toHaveLength(1);
        });

        it('should include soft-deleted rows when includeDeleted=true', async () => {
            // Arrange — both active and soft-deleted
            const deletedRow = {
                ...PROMPT_ROW_V1,
                id: 'bbbbbbbb-0000-0000-0000-000000000003',
                version: 0,
                deletedAt: new Date('2026-03-01')
            };
            mockGetDb.mockReturnValue({
                select: buildSelectChain([PROMPT_ROW_V1, deletedRow])
            });

            // Act
            const result = await listPromptVersionsByFeature({
                feature: 'text_improve',
                includeDeleted: true
            });

            // Assert
            expect(result).toHaveLength(2);
        });
    });

    describe('when no versions exist', () => {
        it('should return an empty array', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildSelectChain([]) });

            // Act
            const result = await listPromptVersionsByFeature({ feature: 'chat' });

            // Assert
            expect(result).toHaveLength(0);
        });
    });

    describe('when a tx is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { select: buildSelectChain([PROMPT_ROW_V1]) };

            // Act
            const result = await listPromptVersionsByFeature({
                feature: 'text_improve',
                tx: fakeTx as never
            });

            // Assert
            expect(result).toHaveLength(1);
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });
});
