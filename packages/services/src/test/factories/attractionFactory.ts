import type { AttractionId, AttractionType, UserId } from '@repo/types';
import { AttractionTypeEnum, ModerationStatusEnum } from '@repo/types';

/**
 * Returns a mock AttractionType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns AttractionType
 * @example
 * const attraction = getMockAttraction({ id: 'attraction-2' as AttractionId });
 */
export const getMockAttraction = (overrides: Partial<AttractionType> = {}): AttractionType => ({
    id: 'attraction-uuid' as AttractionId,
    name: 'Attraction Test',
    description: 'A test attraction',
    type: AttractionTypeEnum.CULTURAL,
    media: { featuredImage: { url: '', moderationState: ModerationStatusEnum.PENDING_REVIEW } },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    ...overrides
});

export const createMockAttraction = (overrides: Partial<AttractionType> = {}): AttractionType =>
    getMockAttraction(overrides);

export const getMockAttractionId = (id?: string): AttractionId =>
    (id && /^[0-9a-fA-F-]{36}$/.test(id)
        ? id
        : '88888888-8888-8888-8888-888888888888') as AttractionId;
