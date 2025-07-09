import {
    type ImageType,
    type MediaType,
    ModerationStatusEnum,
    PostCategoryEnum
} from '@repo/types';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { getMockTag } from '../../../../services/src/test/factories/tagFactory';
import {
    normalizeCreateInput,
    normalizeImage,
    normalizeMedia,
    normalizeUpdateInput
} from '../../../src/services/post/post.normalizers';
import type { PostCreateInput, PostUpdateSchema } from '../../../src/services/post/post.schemas';

const validTag = getMockTag();

const validImage: ImageType = {
    url: 'https://example.com/image.jpg',
    caption: 'A nice image',
    description: 'A beautiful description for the image',
    moderationState: ModerationStatusEnum.PENDING,
    tags: [validTag]
};

const validMedia: MediaType = {
    featuredImage: validImage,
    gallery: [validImage],
    videos: [
        {
            url: 'https://example.com/video.mp4',
            moderationState: ModerationStatusEnum.PENDING,
            caption: 'A video',
            description: 'A video description',
            tags: [validTag]
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
            moderationState: ModerationStatusEnum.PENDING,
            tags: validImage.tags
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
        const invalidImage: ImageType = { ...validImage, url: 123 as unknown as string };
        const media: MediaType = {
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
            title: '  Hello  ',
            summary: '  Summary  ',
            content: '  Content  ',
            media: validMedia,
            category: PostCategoryEnum.GENERAL
        };
        const result = normalizeCreateInput(input);
        expect(result.title).toBe('Hello');
        expect(result.summary).toBe('Summary');
        expect(result.content).toBe('Content');
        expect(result.media?.featuredImage?.url).toBe(validImage.url);
    });

    it('generates summary from content if summary is empty', () => {
        const input: PostCreateInput = {
            title: 'Test',
            summary: '',
            content: 'This is a long content that should be used to generate the summary. '.repeat(
                10
            ),
            media: validMedia,
            category: PostCategoryEnum.GENERAL
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
        const input: { id: string } & Partial<Omit<z.infer<typeof PostUpdateSchema>, 'id'>> = {
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
        const input: { id: string } & Partial<Omit<z.infer<typeof PostUpdateSchema>, 'id'>> = {
            id: 'mock-post-id',
            summary: '',
            content: 'This is a long content for update. '.repeat(10)
        };
        const result = normalizeUpdateInput(input);
        expect(result.summary?.length).toBeLessThanOrEqual(200);
    });

    it('handles missing media gracefully', () => {
        const input: { id: string } & Partial<Omit<z.infer<typeof PostUpdateSchema>, 'id'>> = {
            id: 'mock-post-id',
            title: 'Test update',
            summary: 'Summary',
            content: 'Content'
        };
        const result = normalizeUpdateInput(input);
        expect(result.media).toBeUndefined();
    });
});
