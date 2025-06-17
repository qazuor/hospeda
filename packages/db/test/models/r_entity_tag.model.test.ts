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

    it('findWithRelations - relación encontrada', async () => {
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

    it('findWithRelations - sin relaciones, fallback a findOne', async () => {
        // Helper para IDs tipados
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

    it('findWithRelations - no encontrada', async () => {
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

    it('findWithRelations - error de DB', async () => {
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
});
