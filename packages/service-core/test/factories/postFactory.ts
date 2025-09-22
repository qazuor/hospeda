import type { Post, PostCreateInput, PostIdType, UserIdType } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PostCategoryEnum,
    VisibilityEnum
} from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class PostFactoryBuilder {
    private post: Partial<Post> = {};

    with(fields: Partial<Post>): this {
        Object.assign(this.post, fields);
        return this;
    }

    build(): Post {
        return {
            id: getMockId('post') as PostIdType,
            slug: 'slug',
            category: PostCategoryEnum.GENERAL,
            title: 'Test Post',
            summary: 'Summary',
            content:
                'This is a comprehensive content for the post that meets the minimum length requirement of 100 characters. It provides detailed information about the topic and ensures proper validation.',
            media: {
                featuredImage: {
                    url: 'https://example.com/image.jpg',
                    moderationState: ModerationStatusEnum.APPROVED
                },
                gallery: [],
                videos: []
            },
            authorId: getMockId('user') as UserIdType,
            visibility: VisibilityEnum.PUBLIC,
            isFeatured: false,
            isNews: true,
            isFeaturedInWebsite: false,
            expiresAt: new Date(),
            likes: 0,
            comments: 0,
            shares: 0,
            publishedAt: new Date(),
            readingTimeMinutes: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            ...this.post
        };
    }
}

export const createMockPost = (fields: Partial<Post> = {}): Post =>
    new PostFactoryBuilder().with(fields).build();

/**
 * Factory for a valid PostCreateInput (only user-provided fields)
 * Generates a unique title by default to avoid collisions in tests.
 */
export const createMockPostCreateInput = (
    overrides: Partial<PostCreateInput> = {}
): PostCreateInput => {
    // Generate a unique suffix for the title if none is provided
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const baseInput = {
        slug: `test-post-${uniqueSuffix}`,
        title: `Test Post ${uniqueSuffix}`,
        summary: 'A valid summary for the post.',
        content:
            'This is a comprehensive and detailed content for the post that meets the minimum length requirement of 100 characters. It provides valuable information about the topic, includes relevant details, and ensures proper validation passes successfully.',
        media: {
            featuredImage: {
                url: 'https://example.com/image.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            }
        },
        category: PostCategoryEnum.GENERAL,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        isFeatured: false,
        visibility: VisibilityEnum.PUBLIC,
        isNews: false,
        isFeaturedInWebsite: false,
        likes: 0,
        comments: 0,
        shares: 0,
        publishedAt: new Date(),
        readingTimeMinutes: 5,
        authorId: getMockId('user') as UserIdType,
        ...overrides
    };

    // If isNews is true and no expiresAt is provided, add a future expiresAt
    if (baseInput.isNews && !baseInput.expiresAt) {
        baseInput.expiresAt = new Date(Date.now() + 86400000); // 24 hours from now
    }

    return baseInput;
};

export const getMockPostId = (id?: string): PostIdType => getMockId('post', id) as PostIdType;

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use createMockPostCreateInput instead
 */
export const createNewPostInput = createMockPostCreateInput;
