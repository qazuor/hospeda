import type { PostSponsorId, PostSponsorType, UserId } from '@repo/types';
import { ClientTypeEnum, LifecycleStatusEnum } from '@repo/types';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock PostSponsorType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns PostSponsorType
 * @example
 * const sponsor = getMockPostSponsor({ id: 'sponsor-2' as PostSponsorId });
 */
export const getMockPostSponsor = (overrides: Partial<PostSponsorType> = {}): PostSponsorType => ({
    id: 'sponsor-uuid' as PostSponsorId,
    name: 'Sponsor Name',
    type: ClientTypeEnum.POST_SPONSOR,
    description: 'Sponsor description',
    logo: undefined,
    contact: undefined,
    social: undefined,
    adminInfo: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

export const createMockPostSponsor = (overrides: Partial<PostSponsorType> = {}): PostSponsorType =>
    getMockPostSponsor(overrides);

export const getMockPostSponsorId = (id?: string): PostSponsorId => {
    return getMockId('post-sponsor', id) as PostSponsorId;
};
