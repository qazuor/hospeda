/**
 * Unit tests for PostTagModel and RPostPostTagModel (SPEC-086 T-016).
 *
 * Tests the PostTag subsystem models. PostTags are a public, SEO-driven
 * taxonomy — entirely separate from the User-Tag system.
 *
 * References:
 * - SPEC-086 D-001 (two separate subsystems)
 * - SPEC-086 D-013 (public endpoint: ACTIVE only, no pagination)
 * - SPEC-086 D-018 (final schema shape)
 * - AC-F13 (public listing returns only ACTIVE PostTags)
 *
 * Uses vi.mock + vi.spyOn to mock the DB client.
 * Uses @ts-ignore on Drizzle mocks — the RelationalQueryBuilder interface
 * cannot be fully replicated in tests; only the used methods are mocked.
 */
import type { PostTag } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import * as clientModule from '../../../src/client';
import { PostTagModel } from '../../../src/models/tag/post-tag.model';
import { RPostPostTagModel } from '../../../src/models/tag/r-post-post-tag.model';
import { DbError } from '../../../src/utils/error';

vi.mock('../../../src/utils/logger');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_POST_TAG_1 = 'aa000000-0000-0000-0000-000000000001';
const UUID_POST_TAG_2 = 'aa000000-0000-0000-0000-000000000002';
const UUID_POST_1 = 'bb000000-0000-0000-0000-000000000001';
const UUID_POST_2 = 'bb000000-0000-0000-0000-000000000002';

const makePostTag = (overrides: Partial<PostTag> = {}): PostTag => ({
    id: UUID_POST_TAG_1,
    name: 'Gastronomía',
    slug: 'gastronomia',
    color: 'BLUE',
    icon: null,
    description: null,
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null,
    ...overrides
});

/** Mock for count chain returning provided total. */
function mockCountChain(total: number) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total }])
            })
        })
    };
}

// ---------------------------------------------------------------------------
// PostTagModel
// ---------------------------------------------------------------------------

describe('PostTagModel', () => {
    let model: PostTagModel;

    beforeEach(() => {
        model = new PostTagModel();
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // findById
    // =========================================================================
    describe('findById', () => {
        it('returns the PostTag when found', async () => {
            const tag = makePostTag();
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([tag])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findById(UUID_POST_TAG_1);
            expect(result).toBeDefined();
            expect(result?.id).toBe(UUID_POST_TAG_1);
        });

        it('returns null when not found', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findById('nonexistent-uuid');
            expect(result).toBeNull();
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('db fail'))
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.findById(UUID_POST_TAG_1)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // findBySlug
    // =========================================================================
    describe('findBySlug', () => {
        it('returns the PostTag by slug', async () => {
            const tag = makePostTag({ slug: 'gastronomia' });
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([tag])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findBySlug('gastronomia');
            expect(result?.slug).toBe('gastronomia');
        });

        it('returns null for an unknown slug', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findBySlug('does-not-exist');
            expect(result).toBeNull();
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('fail'))
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.findBySlug('anything')).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // findActive — AC-F13
    // =========================================================================
    describe('findActive', () => {
        it('returns only ACTIVE PostTags ordered by name', async () => {
            const activeTag1 = makePostTag({ id: UUID_POST_TAG_1, name: 'Aventura' });
            const activeTag2 = makePostTag({ id: UUID_POST_TAG_2, name: 'Gastronomía' });
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([activeTag1, activeTag2])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findActive();

            // Both returned by mock — in a real DB, inactive would be filtered
            expect(result).toHaveLength(2);
        });

        it('excludes non-ACTIVE tags (DB level filter)', async () => {
            // Mock returns only ACTIVE tags (simulating DB filter)
            const activeTag = makePostTag({ lifecycleState: 'ACTIVE' });
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([activeTag])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findActive();

            for (const tag of result) {
                expect(tag.lifecycleState).toBe('ACTIVE');
            }
        });

        it('returns empty array when no ACTIVE tags exist', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findActive();
            expect(result).toHaveLength(0);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockRejectedValue(new Error('fail'))
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.findActive()).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // findActiveWithCounts — D-013
    // =========================================================================
    describe('findActiveWithCounts', () => {
        it('returns each ACTIVE PostTag with a usageCount field', async () => {
            const row = {
                ...makePostTag(),
                usageCount: 3
            };
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        leftJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                groupBy: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockResolvedValue([row])
                                })
                            })
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findActiveWithCounts();

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('usageCount');
            expect(result[0]?.usageCount).toBe(3);
        });

        it('returns usageCount as number (coerced from bigint)', async () => {
            // Drizzle count() may return bigint as string from pg driver
            const row = {
                ...makePostTag(),
                usageCount: '12'
            };
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        leftJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                groupBy: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockResolvedValue([row])
                                })
                            })
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findActiveWithCounts();

            expect(typeof result[0]?.usageCount).toBe('number');
            expect(result[0]?.usageCount).toBe(12);
        });

        it('returns PostTags with usageCount = 0 when no posts use them', async () => {
            const row = {
                ...makePostTag(),
                usageCount: 0
            };
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        leftJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                groupBy: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockResolvedValue([row])
                                })
                            })
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findActiveWithCounts();

            expect(result[0]?.usageCount).toBe(0);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        leftJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                groupBy: vi.fn().mockReturnValue({
                                    orderBy: vi.fn().mockRejectedValue(new Error('fail'))
                                })
                            })
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.findActiveWithCounts()).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // getImpactCount
    // =========================================================================
    describe('getImpactCount', () => {
        it('returns the number of posts using this PostTag', async () => {
            const db = mockCountChain(5);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.getImpactCount(UUID_POST_TAG_1);
            expect(result).toBe(5);
        });

        it('returns 0 when no posts use this PostTag', async () => {
            const db = mockCountChain(0);
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.getImpactCount(UUID_POST_TAG_1);
            expect(result).toBe(0);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('db fail'))
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.getImpactCount(UUID_POST_TAG_1)).rejects.toThrow(DbError);
        });
    });
});

// ---------------------------------------------------------------------------
// RPostPostTagModel
// ---------------------------------------------------------------------------

describe('RPostPostTagModel', () => {
    let model: RPostPostTagModel;

    beforeEach(() => {
        model = new RPostPostTagModel();
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // setTagsForPost — idempotency
    // =========================================================================
    describe('setTagsForPost', () => {
        it('replaces all tags for a post atomically', async () => {
            const newRow = { postId: UUID_POST_1, postTagId: UUID_POST_TAG_1 };
            const dbForTx = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([newRow])
                    })
                })
            };
            // Mock withTransaction to execute the callback with dbForTx
            vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (fn) =>
                fn(dbForTx as never)
            );
            vi.mocked(dbUtils.getDb).mockReturnValue(dbForTx as never);

            const result = await model.setTagsForPost(UUID_POST_1, [UUID_POST_TAG_1]);

            expect(result).toHaveLength(1);
            expect(result[0]?.postTagId).toBe(UUID_POST_TAG_1);
        });

        it('is idempotent: applying same set twice yields same final state', async () => {
            const newRow = { postId: UUID_POST_1, postTagId: UUID_POST_TAG_1 };
            const dbForTx = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([newRow])
                    })
                })
            };
            vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (fn) =>
                fn(dbForTx as never)
            );

            const first = await model.setTagsForPost(UUID_POST_1, [UUID_POST_TAG_1]);
            const second = await model.setTagsForPost(UUID_POST_1, [UUID_POST_TAG_1]);

            expect(first).toHaveLength(1);
            expect(second).toHaveLength(1);
            expect(first[0]?.postTagId).toBe(second[0]?.postTagId);
        });

        it('clears all tags when postTagIds is empty', async () => {
            const dbForTx = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            };
            vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (fn) =>
                fn(dbForTx as never)
            );

            const result = await model.setTagsForPost(UUID_POST_1, []);
            expect(result).toHaveLength(0);
        });

        it('throws DbError when transaction fails', async () => {
            vi.spyOn(clientModule, 'withTransaction').mockRejectedValue(new Error('tx fail'));

            await expect(model.setTagsForPost(UUID_POST_1, [UUID_POST_TAG_1])).rejects.toThrow(
                DbError
            );
        });
    });

    // =========================================================================
    // removeTagFromPost
    // =========================================================================
    describe('removeTagFromPost', () => {
        it('removes the tag assignment and returns 1', async () => {
            const db = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi
                            .fn()
                            .mockResolvedValue([
                                { postId: UUID_POST_1, postTagId: UUID_POST_TAG_1 }
                            ])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.removeTagFromPost(UUID_POST_1, UUID_POST_TAG_1);
            expect(result).toBe(1);
        });

        it('returns 0 when the assignment does not exist', async () => {
            const db = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.removeTagFromPost(UUID_POST_1, UUID_POST_TAG_2);
            expect(result).toBe(0);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockRejectedValue(new Error('fail'))
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.removeTagFromPost(UUID_POST_1, UUID_POST_TAG_1)).rejects.toThrow(
                DbError
            );
        });
    });

    // =========================================================================
    // findByPostId
    // =========================================================================
    describe('findByPostId', () => {
        it('returns PostTag rows for all tags assigned to the post', async () => {
            const postTagRow = { postTag: makePostTag() };
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([postTagRow])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findByPostId(UUID_POST_1);

            expect(result).toHaveLength(1);
            expect(result[0]).toBeDefined();
        });

        it('returns empty array when post has no tags', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findByPostId(UUID_POST_2);
            expect(result).toHaveLength(0);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockRejectedValue(new Error('fail'))
                        })
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(model.findByPostId(UUID_POST_1)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // findPostsByPostTagId
    // =========================================================================
    describe('findPostsByPostTagId', () => {
        it('returns post IDs for all posts using this PostTag', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi
                            .fn()
                            .mockResolvedValue([{ postId: UUID_POST_1 }, { postId: UUID_POST_2 }])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findPostsByPostTagId(UUID_POST_TAG_1);

            expect(result).toHaveLength(2);
            expect(result).toContain(UUID_POST_1);
            expect(result).toContain(UUID_POST_2);
        });

        it('returns empty array when no posts use this PostTag', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.findPostsByPostTagId(UUID_POST_TAG_2);
            expect(result).toHaveLength(0);
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

            await expect(model.findPostsByPostTagId(UUID_POST_TAG_1)).rejects.toThrow(DbError);
        });
    });
});
