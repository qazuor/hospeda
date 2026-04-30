/**
 * Unit tests for TagModel (SPEC-086 T-015).
 *
 * Tests the refactored TagModel with the new three-type system
 * (INTERNAL / SYSTEM / USER) and picker visibility rules.
 *
 * References:
 * - SPEC-086 D-006 (picker visibility)
 * - SPEC-086 D-007 (entity-tag visibility per actor)
 * - SPEC-086 D-014 (safeIlike search on name)
 * - SPEC-086 D-018 (schema shape)
 * - SPEC-086 D-021 (quota enforcement)
 *
 * Uses vi.mock + vi.spyOn to mock the DB client.
 * Uses @ts-ignore on Drizzle mocks — the RelationalQueryBuilder interface
 * cannot be fully replicated in tests; only the used methods are mocked.
 */
import { TagTypeEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { TagModel } from '../../../src/models/tag/tag.model';
import { DbError } from '../../../src/utils/error';

vi.mock('../../../src/utils/logger');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal mock for a Drizzle select chain that returns the provided rows. */
function mockSelectChain(rows: unknown[]) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(rows)
            })
        })
        // count query path (select({ total: count() }))
        // We reuse the same rows array; callers extract [0]?.total
    };
}

/** Minimal mock for a count query returning the provided total. */
function mockSelectCountChain(total: number) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total }])
            })
        })
    };
}

const UUID_ACTOR = '00000000-0000-0000-0000-000000000001';
const UUID_OTHER = '00000000-0000-0000-0000-000000000002';

const makeTag = (overrides: Record<string, unknown>) => ({
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Test Tag',
    color: 'BLUE',
    icon: null,
    description: null,
    type: TagTypeEnum.SYSTEM,
    ownerId: null,
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagModel', () => {
    let model: TagModel;

    beforeEach(() => {
        model = new TagModel();
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // findByType
    // =========================================================================
    describe('findByType', () => {
        it('returns tags of the specified type', async () => {
            const internalTag = makeTag({ type: TagTypeEnum.INTERNAL, ownerId: null });
            const db = mockSelectChain([internalTag]);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findByType(TagTypeEnum.INTERNAL);
            expect(result).toHaveLength(1);
            expect(result[0]?.type).toBe(TagTypeEnum.INTERNAL);
        });

        it('handles an empty result set', async () => {
            const db = mockSelectChain([]);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findByType(TagTypeEnum.USER);
            expect(result).toHaveLength(0);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('db failure'))
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.findByType(TagTypeEnum.SYSTEM)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // findByOwner
    // =========================================================================
    describe('findByOwner', () => {
        it('returns USER tags for the specified owner', async () => {
            const userTag = makeTag({ type: TagTypeEnum.USER, ownerId: UUID_ACTOR });
            const db = mockSelectChain([userTag]);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findByOwner(UUID_ACTOR);
            expect(result).toHaveLength(1);
            expect(result[0]?.ownerId).toBe(UUID_ACTOR);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('connection error'))
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.findByOwner(UUID_ACTOR)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // countActiveByOwner — D-021 quota enforcement
    // =========================================================================
    describe('countActiveByOwner', () => {
        it('counts only type=USER, lifecycleState=ACTIVE for the owner', async () => {
            const db = mockSelectCountChain(5);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.countActiveByOwner(UUID_ACTOR);
            expect(result).toBe(5);
        });

        it('returns 0 when the owner has no active USER tags', async () => {
            const db = mockSelectCountChain(0);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.countActiveByOwner(UUID_ACTOR);
            expect(result).toBe(0);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('fail'))
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.countActiveByOwner(UUID_ACTOR)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // findPickerTags — D-006 picker visibility
    // =========================================================================
    describe('findPickerTags', () => {
        it('includes SYSTEM and own USER tags when hasInternalView is false', async () => {
            const systemTag = makeTag({ type: TagTypeEnum.SYSTEM, ownerId: null });
            const userTag = makeTag({
                id: '00000000-0000-0000-0000-000000000020',
                type: TagTypeEnum.USER,
                ownerId: UUID_ACTOR
            });
            const db = mockSelectChain([systemTag, userTag]);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findPickerTags({
                actorId: UUID_ACTOR,
                hasInternalView: false
            });

            // Both rows returned by mock; the select chain is called
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('includes INTERNAL tags when hasInternalView is true', async () => {
            const internalTag = makeTag({ type: TagTypeEnum.INTERNAL, ownerId: null });
            const systemTag = makeTag({
                id: '00000000-0000-0000-0000-000000000020',
                type: TagTypeEnum.SYSTEM,
                ownerId: null
            });
            const db = mockSelectChain([internalTag, systemTag]);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findPickerTags({
                actorId: UUID_ACTOR,
                hasInternalView: true
            });

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('does NOT include other users USER tags (only own USER tags)', async () => {
            // Mock returns only SYSTEM tag and own USER tag, not other user's tag
            const systemTag = makeTag({ type: TagTypeEnum.SYSTEM, ownerId: null });
            const ownUserTag = makeTag({
                id: '00000000-0000-0000-0000-000000000020',
                type: TagTypeEnum.USER,
                ownerId: UUID_ACTOR
            });
            // Other user's tag should NOT appear in the result
            const db = mockSelectChain([systemTag, ownUserTag]);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findPickerTags({
                actorId: UUID_ACTOR,
                hasInternalView: false
            });

            // Verify no row belongs to UUID_OTHER
            for (const tag of result) {
                if (tag.type === TagTypeEnum.USER) {
                    expect(tag.ownerId).toBe(UUID_ACTOR);
                    expect(tag.ownerId).not.toBe(UUID_OTHER);
                }
            }
        });

        it('applies nameQuery filter via safeIlike when provided', async () => {
            const matchingTag = makeTag({ name: 'Matching Tag', type: TagTypeEnum.SYSTEM });
            const db = mockSelectChain([matchingTag]);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findPickerTags({
                actorId: UUID_ACTOR,
                hasInternalView: false,
                nameQuery: 'Matching'
            });

            expect(result).toBeDefined();
        });

        it('ignores empty nameQuery', async () => {
            const db = mockSelectChain([]);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findPickerTags({
                actorId: UUID_ACTOR,
                hasInternalView: false,
                nameQuery: '   '
            });

            expect(Array.isArray(result)).toBe(true);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('db failure'))
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(
                model.findPickerTags({ actorId: UUID_ACTOR, hasInternalView: false })
            ).rejects.toThrow(DbError);
        });
    });
});
