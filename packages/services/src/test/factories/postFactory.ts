import type { PostId, PostType, UserId } from '@repo/types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PostCategoryEnum,
    VisibilityEnum
} from '@repo/types';

/**
 * Returns a mock PostType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns PostType
 * @example
 * const post = getMockPost({ id: 'post-2' as PostId });
 */
export const getMockPost = (overrides: Partial<PostType> = {}): PostType => ({
    id: 'post-uuid' as PostId,
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
    authorId: 'user-uuid' as UserId,
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
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
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
    authorId: 'user-uuid',
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

export const getMockPostId = (id?: string): PostId =>
    (id && /^[0-9a-fA-F-]{36}$/.test(id) ? id : '00000000-0000-0000-0000-000000000003') as PostId;
