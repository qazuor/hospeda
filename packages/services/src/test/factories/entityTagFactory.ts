import type { AccommodationId, EntityTagType, TagId } from '@repo/types';
import { EntityTypeEnum } from '@repo/types';

/**
 * Returns a mock EntityTagType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EntityTagType
 * @example
 * const entityTag = getMockEntityTag({ tagId: 'tag-2' as TagId });
 */
export const getMockEntityTag = (overrides: Partial<EntityTagType> = {}): EntityTagType => ({
    tagId: 'tag-1' as TagId,
    entityId: 'acc-1' as AccommodationId,
    entityType: EntityTypeEnum.ACCOMMODATION,
    ...overrides
});

export const createMockEntityTag = (overrides: Partial<EntityTagType> = {}): EntityTagType =>
    getMockEntityTag(overrides);
