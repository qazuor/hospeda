import type { EntityTagType } from '@repo/types';
import { EntityTypeEnum } from '@repo/types';
import { getMockAccommodationId } from './accommodationFactory';
import { getMockTagId } from './tagFactory';

/**
 * Returns a mock EntityTagType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EntityTagType
 * @example
 * const entityTag = getMockEntityTag({ tagId: 'tag-2' as TagId });
 */
export const getMockEntityTag = (overrides: Partial<EntityTagType> = {}): EntityTagType => ({
    tagId: getMockTagId('tag-1'),
    entityId: getMockAccommodationId('acc-1'),
    entityType: EntityTypeEnum.ACCOMMODATION,
    ...overrides
});

export const createMockEntityTag = (overrides: Partial<EntityTagType> = {}): EntityTagType =>
    getMockEntityTag(overrides);
