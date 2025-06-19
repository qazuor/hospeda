import type { AccommodationId, EntityTagType, TagId } from '@repo/types';
import { EntityTypeEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/client';
import { REntityTagModel } from '../../src/models/tag/rEntityTag.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/client');
vi.mock('../../src/utils/logger');

const model = new REntityTagModel();

/**
 * Test suite for REntityTagModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

// This file uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
// This is documented and justified according to project rules.

const asEntityId = (id: string) => id as unknown as AccommodationId;
const asTagId = (id: string) => id as unknown as TagId;

describe('REntityTagModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('findWithRelations - relation found', async () => {
        const rEntityTagMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                entityId: asEntityId('a'),
                tagId: asTagId('b'),
                entity: {},
                tag: {}
            })
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rEntityTag: rEntityTagMock
            }
        });
        const result = await model.findWithRelations({ tagId: 'a' }, { tag: true });
        expect(result).toBeTruthy();
        expect((result as { tag?: unknown }).tag).toBeDefined();
    });

    it('findWithRelations - no relations, fallback to findOne', async () => {
        // Helper for typed IDs
        const asTagId = (id: string) => id as unknown as import('@repo/types').TagId;
        const asAccommodationId = (id: string) => id as unknown as AccommodationId;
        const dummy: EntityTagType = {
            tagId: asTagId('a'),
            entityId: asAccommodationId('b'),
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const spy = vi.spyOn(model, 'findOne').mockResolvedValue(dummy);
        const result = await model.findWithRelations({ tagId: asTagId('a') }, {});
        expect(spy).toHaveBeenCalled();
        expect(result).toBeTruthy();
    });

    it('findWithRelations - not found', async () => {
        const rEntityTagMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue(null)
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rEntityTag: rEntityTagMock
            }
        });
        const result = await model.findWithRelations({ tagId: 'x' }, { tag: true });
        expect(result).toBeNull();
    });

    it('findWithRelations - DB error', async () => {
        const rEntityTagMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rEntityTag: rEntityTagMock
            }
        });
        await expect(model.findWithRelations({ tagId: 'a' }, { tag: true })).rejects.toThrow(
            DbError
        );
    });

    it('findAllWithTags - returns relations and tags correctly', async () => {
        const rEntityTagMock = createDrizzleRelationMock({
            findMany: vi.fn().mockResolvedValue([
                {
                    tagId: asTagId('t1'),
                    entityId: asEntityId('e1'),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    tag: { id: asTagId('t1'), name: 'Tag 1' }
                },
                {
                    tagId: asTagId('t2'),
                    entityId: asEntityId('e1'),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    tag: { id: asTagId('t2'), name: 'Tag 2' }
                }
            ])
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rEntityTag: rEntityTagMock
            }
        });
        const result = await model.findAllWithTags('e1', EntityTypeEnum.ACCOMMODATION);
        expect(result).toBeDefined();
        expect(result).toHaveLength(2);
        expect(result[0]?.tag).toBeDefined();
        expect(result[1]?.tag?.name).toBe('Tag 2');
    });

    it('findAllWithEntities - returns relations and tags correctly', async () => {
        const rEntityTagMock = createDrizzleRelationMock({
            findMany: vi.fn().mockResolvedValue([
                {
                    tagId: asTagId('t1'),
                    entityId: asEntityId('e1'),
                    entityType: EntityTypeEnum.ACCOMMODATION,
                    tag: { id: asTagId('t1'), name: 'Tag 1' }
                },
                {
                    tagId: asTagId('t1'),
                    entityId: asEntityId('e2'),
                    entityType: EntityTypeEnum.DESTINATION,
                    tag: { id: asTagId('t1'), name: 'Tag 1' }
                }
            ])
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rEntityTag: rEntityTagMock
            }
        });
        const result = await model.findAllWithEntities('t1');
        expect(result).toBeDefined();
        expect(result).toHaveLength(2);
        expect(result[0]?.tag).toBeDefined();
        expect(result[1]?.entityType).toBe(EntityTypeEnum.DESTINATION);
    });

    it('findAllWithTags - handles DB errors', async () => {
        const rEntityTagMock = createDrizzleRelationMock({
            findMany: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rEntityTag: rEntityTagMock
            }
        });
        await expect(model.findAllWithTags('e1', EntityTypeEnum.ACCOMMODATION)).rejects.toThrow(
            DbError
        );
    });

    it('findAllWithEntities - handles DB errors', async () => {
        const rEntityTagMock = createDrizzleRelationMock({
            findMany: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rEntityTag: rEntityTagMock
            }
        });
        await expect(model.findAllWithEntities('t1')).rejects.toThrow(DbError);
    });
});
