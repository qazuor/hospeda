import type { PostId, PostType } from '@repo/types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PostCategoryEnum,
    VisibilityEnum
} from '@repo/types';
import { getMockUserId } from './userFactory';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock PostType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns PostType
 * @example
 * const post = getMockPost({ id: 'post-2' as PostId });
 */
export const getMockPost = (overrides: Partial<PostType> = {}): PostType => ({
    id: getMockPostId('post-uuid'),
    slug: 'post-slug',
    category: PostCategoryEnum.GENERAL,
    title: 'Título del post',
    summary: 'Resumen',
    content: 'Contenido',
    media: {
        featuredImage: {
            url: 'https://example.com/image.jpg',
            moderationState: ModerationStatusEnum.PENDING_REVIEW
        }
    },
    authorId: getMockUserId('user-uuid'),
    sponsorshipId: undefined,
    relatedDestinationId: undefined,
    relatedAccommodationId: undefined,
    relatedEventId: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    isNews: false,
    isFeaturedInWebsite: false,
    expiresAt: undefined,
    likes: 0,
    comments: 0,
    shares: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: getMockUserId('creator-uuid'),
    updatedById: getMockUserId('updater-uuid'),
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    seo: undefined,
    tags: [],
    ...overrides
});

/**
 * Returns a mock input object for creating a post.
 * @returns Object with post input fields.
 * @example
 * const input = getMockPostInput();
 */
export const getMockPostInput = () => ({
    slug: 'post-slug',
    category: PostCategoryEnum.GENERAL,
    title: 'Título del post',
    summary: 'Resumen',
    content: 'Contenido',
    media: { url: 'https://example.com/image.jpg' },
    authorId: getMockUserId(),
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    isNews: false,
    isFeaturedInWebsite: false,
    likes: 0,
    comments: 0,
    shares: 0
});

export const createMockPost = (overrides: Partial<PostType> = {}): PostType =>
    getMockPost(overrides);

export const createMockPostInput = (
    overrides: Partial<
        Omit<
            PostType,
            | 'id'
            | 'createdAt'
            | 'updatedAt'
            | 'deletedAt'
            | 'createdById'
            | 'updatedById'
            | 'deletedById'
        >
    > = {}
): Omit<
    PostType,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
> => {
    const { id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById, ...input } =
        getMockPost();
    return { ...input, ...overrides };
};

export const getMockPostId = (id?: string): PostId => {
    return getMockId('post', id) as PostId;
};
