import type { TagId, TagType } from '@repo/types';
import { LifecycleStatusEnum, TagColorEnum } from '@repo/types';
import { getMockUserId } from './userFactory';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock TagType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns TagType
 * @example
 * const tag = getMockTag({ id: 'tag-2' as TagId });
 */
export const getMockTag = (overrides: Partial<TagType> = {}): TagType => ({
    id: getMockTagId(),
    name: 'Test Tag',
    color: TagColorEnum.BLUE,
    icon: 'star',
    notes: 'Notas de prueba',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: getMockUserId('creator-uuid'),
    updatedById: getMockUserId('updater-uuid'),
    deletedAt: undefined,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

export const createMockTag = (overrides: Partial<TagType> = {}): TagType => getMockTag(overrides);

export const createMockTagInput = (
    overrides: Partial<Omit<TagType, 'id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<TagType, 'id' | 'createdAt' | 'updatedAt'> => {
    const { id, createdAt, updatedAt, ...input } = getMockTag();
    return { ...input, ...overrides };
};

export const getMockTagId = (id?: string): TagId => {
    return getMockId('tag', id) as TagId;
};
