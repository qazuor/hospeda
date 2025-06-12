import type { TagId, TagType, UserId } from '@repo/types';
import { LifecycleStatusEnum, TagColorEnum } from '@repo/types';

/**
 * Returns a mock TagType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns TagType
 * @example
 * const tag = getMockTag({ id: 'tag-2' as TagId });
 */
export const getMockTag = (overrides: Partial<TagType> = {}): TagType => ({
    id: '33333333-3333-3333-3333-333333333333' as TagId,
    name: 'Test Tag',
    color: TagColorEnum.BLUE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '11111111-1111-1111-1111-111111111111' as UserId,
    updatedById: '11111111-1111-1111-1111-111111111111' as UserId,
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

export const getMockTagId = (id?: string): TagId =>
    (id && /^[0-9a-fA-F-]{36}$/.test(id) ? id : '33333333-3333-3333-3333-333333333333') as TagId;
