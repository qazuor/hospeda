import type { PostCreateInput, PostUpdateInput } from '@repo/schemas';
import {
    type Image,
    LifecycleStatusEnum,
    type Media,
    ModerationStatusEnum,
    PostCategoryEnum,
    type UserIdType,
    VisibilityEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeImage,
    normalizeMedia,
    normalizeUpdateInput
} from '../../../src/services/post/post.normalizers';
import { getMockId } from '../../factories/utilsFactory';

const validImage: Image = {
    url: 'https://example.com/image.jpg',
    caption: 'A nice image',
    description: 'A beautiful description for the image',
    moderationState: ModerationStatusEnum.PENDING
};

const validMedia: Media = {
    featuredImage: validImage,
    gallery: [validImage],
    videos: [
        {
            url: 'https://example.com/video.mp4',
            moderationState: ModerationStatusEnum.PENDING,
            caption: 'A video',
            description: 'A video description'
        }
    ]
};

describe('normalizeImage', () => {
    it('returns undefined for invalid input', () => {
        expect(normalizeImage(undefined)).toBeUndefined();
        expect(normalizeImage(null)).toBeUndefined();
        expect(normalizeImage({})).toBeUndefined();
        expect(normalizeImage({ url: 123 })).toBeUndefined();
    });

    it('returns normalized image for valid input', () => {
        const result = normalizeImage(validImage);
        expect(result).toMatchObject({
            url: validImage.url,
            caption: validImage.caption,
            description: validImage.description,
            moderationState: ModerationStatusEnum.PENDING
        });
    });
});

describe('normalizeMedia', () => {
    it('returns undefined if featuredImage is invalid', () => {
        expect(normalizeMedia({})).toBeUndefined();
        expect(normalizeMedia({ featuredImage: null })).toBeUndefined();
    });

    it('returns normalized media for valid input', () => {
        const result = normalizeMedia(validMedia);
        expect(result?.featuredImage?.url).toBe(validImage.url);
        expect(result?.gallery?.[0]?.url).toBe(validImage.url);
        if (result?.videos && validMedia.videos) {
            expect(result.videos[0]?.url).toBe(validMedia.videos[0]?.url);
        }
    });

    it('filters out invalid images in gallery', () => {
        const invalidImage: Image = { ...validImage, url: 123 as unknown as string };
        const media: Media = {
            ...validMedia,
            gallery: [validImage, invalidImage]
        };
        const result = normalizeMedia(media);
        expect(result?.gallery?.length).toBe(1);
    });
});

describe('normalizeCreateInput', () => {
    it('trims and normalizes fields', () => {
        const input: PostCreateInput = {
            slug: 'hello-post',
            title: '  Hello  ',
            summary: '  Summary  ',
            content: '  Content  ',
            media: validMedia,
            category: PostCategoryEnum.GENERAL,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            isNews: true,
            isFeaturedInWebsite: false,
            authorId: getMockId('user') as UserIdType,
            likes: 0,
            comments: 0,
            shares: 0,
            publishedAt: new Date(),
            readingTimeMinutes: 5
        };
        const result = normalizeCreateInput(input);
        expect(result.title).toBe('Hello');
        expect(result.summary).toBe('Summary');
        expect(result.content).toBe('Content');
        expect(result.media?.featuredImage?.url).toBe(validImage.url);
    });

    it('generates summary from content if summary is empty', () => {
        const input: PostCreateInput = {
            slug: 'test-post',
            title: 'Test',
            summary: '',
            content: 'This is a long content that should be used to generate the summary. '.repeat(
                10
            ),
            media: validMedia,
            category: PostCategoryEnum.GENERAL,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            isFeatured: false,
            visibility: VisibilityEnum.PUBLIC,
            isNews: true,
            isFeaturedInWebsite: false,
            authorId: getMockId('user') as UserIdType,
            likes: 0,
            comments: 0,
            shares: 0,
            publishedAt: new Date(),
            readingTimeMinutes: 5
        };
        const result = normalizeCreateInput(input);
        expect(result.summary?.length).toBeLessThanOrEqual(200);
        expect(result.summary).toBe(result.summary?.trim());
    });

    it('handles missing media gracefully', () => {
        const input = {
            title: 'Test',
            summary: 'Summary',
            content: 'Content',
            category: PostCategoryEnum.GENERAL
        } as unknown as PostCreateInput;
        const result = normalizeCreateInput(input);
        expect(result.media).toBeUndefined();
    });
});

describe('normalizeUpdateInput', () => {
    it('trims and normalizes fields if present', () => {
        const input: { id: string } & Partial<Omit<PostUpdateInput, 'id'>> = {
            id: 'mock-post-id',
            title: '  Update  ',
            summary: '  Update summary  ',
            content: '  Update content  ',
            media: validMedia
        };
        const result = normalizeUpdateInput(input);
        expect(result.title).toBe('Update');
        expect(result.summary).toBe('Update summary');
        expect(result.content).toBe('Update content');
        expect(result.media?.featuredImage?.url).toBe(validImage.url);
    });

    it('generates summary from content if summary is empty', () => {
        const input: { id: string } & Partial<Omit<PostUpdateInput, 'id'>> = {
            id: 'mock-post-id',
            summary: '',
            content: 'This is a long content for update. '.repeat(10)
        };
        const result = normalizeUpdateInput(input);
        expect(result.summary?.length).toBeLessThanOrEqual(200);
    });

    it('handles missing media gracefully', () => {
        const input: { id: string } & Partial<Omit<PostUpdateInput, 'id'>> = {
            id: 'mock-post-id',
            title: 'Test update',
            summary: 'Summary',
            content: 'Content'
        };
        const result = normalizeUpdateInput(input);
        expect(result.media).toBeUndefined();
    });
});
