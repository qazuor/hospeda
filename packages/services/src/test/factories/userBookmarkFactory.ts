import type { UserBookmarkId, UserBookmarkType } from '@repo/types';
import { EntityTypeEnum, LifecycleStatusEnum } from '@repo/types';
import { getMockAccommodationId } from './accommodationFactory';
import { getMockUserId } from './userFactory';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock UserBookmarkType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns UserBookmarkType
 * @example
 * const bookmark = getMockUserBookmark({ id: 'bookmark-2' as UserBookmarkId });
 */
export const getMockUserBookmark = (
    overrides: Partial<UserBookmarkType> = {}
): UserBookmarkType => ({
    id: getMockUserBookmarkId('bookmark-uuid'),
    userId: getMockUserId('user-uuid'),
    entityId: getMockAccommodationId('accommodation-uuid'),
    entityType: EntityTypeEnum.DESTINATION,
    name: 'Mi destino favorito',
    description: 'Un destino que quiero visitar',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: getMockUserId('creator-uuid'),
    updatedById: getMockUserId('updater-uuid'),
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    ...overrides
});

export const createMockUserBookmark = (
    overrides: Partial<UserBookmarkType> = {}
): UserBookmarkType => getMockUserBookmark(overrides);

export const createMockUserBookmarkInput = (
    overrides: Partial<Omit<UserBookmarkType, 'id'>> = {}
): Omit<UserBookmarkType, 'id'> => {
    const { id, ...input } = getMockUserBookmark();
    return { ...input, ...overrides } as Omit<UserBookmarkType, 'id'>;
};

export const getMockUserBookmarkId = (id?: string): UserBookmarkId => {
    return getMockId('user-bookmark', id) as UserBookmarkId;
};
