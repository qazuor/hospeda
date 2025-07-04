import type { PostId, PostType, UserId } from '@repo/types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PostCategoryEnum,
    VisibilityEnum
} from '@repo/types';
import type { PostCreateInput } from '../../src/services/post/post.schemas';
import { getMockId } from './utilsFactory';

export class PostFactoryBuilder {
    private post: Partial<PostType> = {};

    with(fields: Partial<PostType>): this {
        Object.assign(this.post, fields);
        return this;
    }

    build(): PostType {
        return {
            id: getMockId('post') as PostId,
            slug: 'slug',
            category: PostCategoryEnum.GENERAL,
            title: 'Test Post',
            summary: 'Summary',
            content: 'Content',
            media: {
                featuredImage: {
                    url: 'https://example.com/image.jpg',
                    moderationState: ModerationStatusEnum.APPROVED,
                    tags: []
                },
                gallery: [],
                videos: []
            },
            authorId: getMockId('user') as UserId,
            visibility: VisibilityEnum.PUBLIC,
            isFeatured: false,
            isNews: true,
            isFeaturedInWebsite: false,
            expiresAt: new Date(),
            likes: 0,
            comments: 0,
            shares: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserId,
            updatedById: getMockId('user') as UserId,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            ...this.post
        };
    }
}

export const createMockPost = (fields: Partial<PostType> = {}): PostType =>
    new PostFactoryBuilder().with(fields).build();

/**
 * Factory for a valid PostCreateInput (only user-provided fields)
 * Generates a unique title by default to avoid collisions in tests.
 */
export const createNewPostInput = (overrides: Partial<PostCreateInput> = {}): PostCreateInput => {
    // Genera un sufijo único para el título si no se provee uno
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    return {
        title: `Test Post ${uniqueSuffix}`,
        summary: 'A valid summary for the post.',
        content: 'A valid content for the post, at least 10 chars.',
        media: {
            featuredImage: {
                url: 'https://example.com/image.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            }
        },
        category: PostCategoryEnum.GENERAL,
        ...overrides
    };
};
