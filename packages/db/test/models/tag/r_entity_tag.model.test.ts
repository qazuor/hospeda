/**
 * Unit tests for REntityTagModel (SPEC-086 T-015).
 *
 * Tests the new attribution-aware methods on the refactored r_entity_tag model.
 * The 4-column PK `(tagId, entityId, entityType, assignedById)` enables per-user
 * attribution as per D-007 and D-018.
 *
 * References:
 * - SPEC-086 D-007 (entity-tag visibility per actor)
 * - SPEC-086 D-018 (final schema shape with 4-column PK)
 *
 * Uses @ts-ignore on Drizzle mocks — the RelationalQueryBuilder interface
 * cannot be fully replicated in tests; only the used methods are mocked.
 */
import type { AccommodationIdType, EntityTag, TagIdType } from '@repo/schemas';
import { EntityTypeEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { REntityTagModel } from '../../../src/models/tag/r_entity_tag.model';
import { DbError } from '../../../src/utils/error';
import { createDrizzleRelationMock } from '../../utils/drizzle-mock';

vi.mock('../../../src/utils/logger');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const asEntityId = (id: string) => id as unknown as AccommodationIdType;
const asTagId = (id: string) => id as unknown as TagIdType;

const UUID_TAG = '10000000-0000-0000-0000-000000000001';
const UUID_ENTITY = '20000000-0000-0000-0000-000000000001';
const UUID_ACTOR_A = '30000000-0000-0000-0000-000000000001';
const UUID_ACTOR_B = '30000000-0000-0000-0000-000000000002';

const makeAssignment = (overrides: Partial<EntityTag> = {}): EntityTag => ({
    tagId: asTagId(UUID_TAG),
    entityId: asEntityId(UUID_ENTITY),
    entityType: EntityTypeEnum.ACCOMMODATION,
    assignedById: asTagId(UUID_ACTOR_A) as unknown as EntityTag['assignedById'],
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REntityTagModel', () => {
    let model: REntityTagModel;

    beforeEach(() => {
        model = new REntityTagModel();
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // findByEntityAndActor — D-007
    // =========================================================================
    describe('findByEntityAndActor', () => {
        it('returns only assignments where assignedById matches actorId', async () => {
            const actorAAssignment = {
                ...makeAssignment(),
                assignedById: UUID_ACTOR_A,
                tag: { id: UUID_TAG, name: 'My Tag' }
            };
            const rEntityTagMock = createDrizzleRelationMock({
                findMany: vi.fn().mockResolvedValue([actorAAssignment])
            });
            vi.mocked(dbUtils.getDb).mockReturnValue({
                query: {
                    // @ts-ignore: mock Drizzle relation for test
                    rEntityTag: rEntityTagMock
                }
            });

            const result = await model.findByEntityAndActor(
                UUID_ENTITY,
                EntityTypeEnum.ACCOMMODATION,
                UUID_ACTOR_A
            );

            expect(result).toHaveLength(1);
            expect(result[0]?.assignedById).toBe(UUID_ACTOR_A);
        });

        it('returns empty array when actor has no assignments on entity', async () => {
            const rEntityTagMock = createDrizzleRelationMock({
                findMany: vi.fn().mockResolvedValue([])
            });
            vi.mocked(dbUtils.getDb).mockReturnValue({
                query: {
                    // @ts-ignore: mock Drizzle relation for test
                    rEntityTag: rEntityTagMock
                }
            });

            const result = await model.findByEntityAndActor(
                UUID_ENTITY,
                EntityTypeEnum.ACCOMMODATION,
                UUID_ACTOR_B
            );

            expect(result).toHaveLength(0);
        });

        it('throws DbError on database failure', async () => {
            const rEntityTagMock = createDrizzleRelationMock({
                findMany: vi.fn().mockRejectedValue(new Error('db error'))
            });
            vi.mocked(dbUtils.getDb).mockReturnValue({
                query: {
                    // @ts-ignore: mock Drizzle relation for test
                    rEntityTag: rEntityTagMock
                }
            });

            await expect(
                model.findByEntityAndActor(UUID_ENTITY, EntityTypeEnum.ACCOMMODATION, UUID_ACTOR_A)
            ).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // findByEntityAll — admin attribution view
    // =========================================================================
    describe('findByEntityAll', () => {
        it('returns all assignments for the entity regardless of actor', async () => {
            const assignmentA = {
                ...makeAssignment(),
                assignedById: UUID_ACTOR_A,
                tag: { id: UUID_TAG, name: 'Tag' },
                assignedBy: { id: UUID_ACTOR_A }
            };
            const assignmentB = {
                ...makeAssignment(),
                assignedById: UUID_ACTOR_B,
                tag: { id: UUID_TAG, name: 'Tag' },
                assignedBy: { id: UUID_ACTOR_B }
            };
            const rEntityTagMock = createDrizzleRelationMock({
                findMany: vi.fn().mockResolvedValue([assignmentA, assignmentB])
            });
            vi.mocked(dbUtils.getDb).mockReturnValue({
                query: {
                    // @ts-ignore: mock Drizzle relation for test
                    rEntityTag: rEntityTagMock
                }
            });

            const result = await model.findByEntityAll(UUID_ENTITY, EntityTypeEnum.ACCOMMODATION);

            expect(result).toHaveLength(2);
        });

        it('throws DbError on database failure', async () => {
            const rEntityTagMock = createDrizzleRelationMock({
                findMany: vi.fn().mockRejectedValue(new Error('fail'))
            });
            vi.mocked(dbUtils.getDb).mockReturnValue({
                query: {
                    // @ts-ignore: mock Drizzle relation for test
                    rEntityTag: rEntityTagMock
                }
            });

            await expect(
                model.findByEntityAll(UUID_ENTITY, EntityTypeEnum.ACCOMMODATION)
            ).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // countByTagId
    // =========================================================================
    describe('countByTagId', () => {
        it('returns the count of assignments referencing the tag', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ total: 7 }])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.countByTagId(UUID_TAG);

            expect(result).toBe(7);
        });

        it('returns 0 when there are no assignments', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ total: 0 }])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.countByTagId(UUID_TAG);

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

            await expect(model.countByTagId(UUID_TAG)).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // deleteByTagIdEntityUser
    // =========================================================================
    describe('deleteByTagIdEntityUser', () => {
        it('deletes the row identified by the 4-column PK and returns 1', async () => {
            const deletedRow = makeAssignment();
            const db = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([deletedRow])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.deleteByTagIdEntityUser(
                UUID_TAG,
                UUID_ENTITY,
                EntityTypeEnum.ACCOMMODATION,
                UUID_ACTOR_A
            );

            expect(result).toBe(1);
        });

        it('returns 0 when no row matched the composite PK', async () => {
            const db = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.deleteByTagIdEntityUser(
                UUID_TAG,
                UUID_ENTITY,
                EntityTypeEnum.ACCOMMODATION,
                UUID_ACTOR_B
            );

            expect(result).toBe(0);
        });

        it('throws DbError on database failure', async () => {
            const db = {
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockRejectedValue(new Error('constraint'))
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(
                model.deleteByTagIdEntityUser(
                    UUID_TAG,
                    UUID_ENTITY,
                    EntityTypeEnum.ACCOMMODATION,
                    UUID_ACTOR_A
                )
            ).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // assign
    // =========================================================================
    describe('assign', () => {
        it('inserts a row and returns the created EntityTag', async () => {
            const created = makeAssignment();
            const db = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([created])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            const result = await model.assign({
                tagId: UUID_TAG,
                entityId: UUID_ENTITY,
                entityType: EntityTypeEnum.ACCOMMODATION,
                assignedById: UUID_ACTOR_A
            });

            expect(result.tagId).toBeDefined();
            expect(result.assignedById).toBe(UUID_ACTOR_A);
        });

        it('throws DbError when insert returns no rows (unexpected)', async () => {
            const db = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(
                model.assign({
                    tagId: UUID_TAG,
                    entityId: UUID_ENTITY,
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    assignedById: UUID_ACTOR_A
                })
            ).rejects.toThrow(DbError);
        });

        it('throws DbError on PK violation (duplicate assignment)', async () => {
            const db = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi
                            .fn()
                            .mockRejectedValue(
                                new Error('duplicate key value violates unique constraint')
                            )
                    })
                })
            };
            vi.mocked(dbUtils.getDb).mockReturnValue(db as never);

            await expect(
                model.assign({
                    tagId: UUID_TAG,
                    entityId: UUID_ENTITY,
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    assignedById: UUID_ACTOR_A
                })
            ).rejects.toThrow(DbError);
        });
    });

    // =========================================================================
    // Legacy: findWithRelations
    // =========================================================================
    describe('findWithRelations (legacy)', () => {
        it('returns relation when tag relation is requested', async () => {
            const rEntityTagMock = createDrizzleRelationMock({
                findFirst: vi.fn().mockResolvedValue({
                    tagId: asTagId(UUID_TAG),
                    entityId: asEntityId(UUID_ENTITY),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    assignedById: UUID_ACTOR_A,
                    tag: { id: UUID_TAG, name: 'Tag' }
                })
            });
            vi.mocked(dbUtils.getDb).mockReturnValue({
                query: {
                    // @ts-ignore: mock Drizzle relation for test
                    rEntityTag: rEntityTagMock
                }
            });

            const result = await model.findWithRelations({ tagId: UUID_TAG }, { tag: true });

            expect(result).toBeTruthy();
        });

        it('falls back to findOne when no relations requested', async () => {
            const spy = vi.spyOn(model, 'findOne').mockResolvedValue(makeAssignment());

            const result = await model.findWithRelations({ tagId: UUID_TAG }, {});

            expect(spy).toHaveBeenCalled();
            expect(result).toBeTruthy();
        });

        it('returns null when not found', async () => {
            const rEntityTagMock = createDrizzleRelationMock({
                findFirst: vi.fn().mockResolvedValue(null)
            });
            vi.mocked(dbUtils.getDb).mockReturnValue({
                query: {
                    // @ts-ignore: mock Drizzle relation for test
                    rEntityTag: rEntityTagMock
                }
            });

            const result = await model.findWithRelations({ tagId: UUID_TAG }, { tag: true });

            expect(result).toBeNull();
        });

        it('throws DbError on database failure', async () => {
            const rEntityTagMock = createDrizzleRelationMock({
                findFirst: vi.fn().mockRejectedValue(new Error('fail'))
            });
            vi.mocked(dbUtils.getDb).mockReturnValue({
                query: {
                    // @ts-ignore: mock Drizzle relation for test
                    rEntityTag: rEntityTagMock
                }
            });

            await expect(
                model.findWithRelations({ tagId: UUID_TAG }, { tag: true })
            ).rejects.toThrow(DbError);
        });
    });
});
