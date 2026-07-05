import { SocialMediaTypeEnum, SocialPublishFormatEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    type MediaRow,
    resolveTargetMediaUrls
} from '../../../src/services/social/social-target-media.util';

const imageRow = (url: string, position: number): MediaRow => ({
    url,
    position,
    mediaType: SocialMediaTypeEnum.IMAGE
});

const videoRow = (url: string, position: number): MediaRow => ({
    url,
    position,
    mediaType: SocialMediaTypeEnum.VIDEO
});

describe('resolveTargetMediaUrls', () => {
    it('returns an empty array for TEXT_POST even when target rows are present', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.TEXT_POST,
            targetMediaRows: [imageRow('https://example.com/1.jpg', 0)],
            postMediaRowsFallback: [imageRow('https://example.com/fallback.jpg', 0)]
        });

        expect(result).toEqual([]);
    });

    it('returns only the first asset by position for STORY', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.STORY,
            targetMediaRows: [
                imageRow('https://example.com/second.jpg', 1),
                imageRow('https://example.com/first.jpg', 0)
            ],
            postMediaRowsFallback: []
        });

        expect(result).toEqual(['https://example.com/first.jpg']);
    });

    it('returns only the first VIDEO-type asset for VIDEO_POST', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.VIDEO_POST,
            targetMediaRows: [
                imageRow('https://example.com/image.jpg', 0),
                videoRow('https://example.com/second.mp4', 2),
                videoRow('https://example.com/first.mp4', 1)
            ],
            postMediaRowsFallback: []
        });

        expect(result).toEqual(['https://example.com/first.mp4']);
    });

    it('returns all assets ordered by position for CAROUSEL', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.CAROUSEL,
            targetMediaRows: [
                imageRow('https://example.com/c.jpg', 2),
                imageRow('https://example.com/a.jpg', 0),
                imageRow('https://example.com/b.jpg', 1)
            ],
            postMediaRowsFallback: []
        });

        expect(result).toEqual([
            'https://example.com/a.jpg',
            'https://example.com/b.jpg',
            'https://example.com/c.jpg'
        ]);
    });

    it('falls back to post-level media rows when target rows are empty', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.CAROUSEL,
            targetMediaRows: [],
            postMediaRowsFallback: [
                imageRow('https://example.com/post-b.jpg', 1),
                imageRow('https://example.com/post-a.jpg', 0)
            ]
        });

        expect(result).toEqual([
            'https://example.com/post-a.jpg',
            'https://example.com/post-b.jpg'
        ]);
    });

    // -------------------------------------------------------------------------
    // HOS-65 T-019 follow-up: the remaining 4 SocialPublishFormatEnum values
    // (FEED_POST, PHOTO_POST, IMAGE_POST, REEL) were previously unhandled and
    // fell into the "unrecognized format -> []" branch, which would silently
    // strip media from real seeded platform-formats (Instagram FEED_POST,
    // Facebook PHOTO_POST, REEL). Every enum value now has an explicit rule.
    // -------------------------------------------------------------------------

    it('returns all assets ordered by position for FEED_POST (same rule as CAROUSEL)', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.FEED_POST,
            targetMediaRows: [
                imageRow('https://example.com/b.jpg', 1),
                imageRow('https://example.com/a.jpg', 0)
            ],
            postMediaRowsFallback: []
        });

        expect(result).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    });

    it('returns all assets ordered by position for PHOTO_POST (same rule as CAROUSEL)', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.PHOTO_POST,
            targetMediaRows: [
                imageRow('https://example.com/b.jpg', 1),
                imageRow('https://example.com/a.jpg', 0)
            ],
            postMediaRowsFallback: []
        });

        expect(result).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    });

    it('returns only the first asset by position for IMAGE_POST (same rule as STORY)', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.IMAGE_POST,
            targetMediaRows: [
                imageRow('https://example.com/second.jpg', 1),
                imageRow('https://example.com/first.jpg', 0)
            ],
            postMediaRowsFallback: []
        });

        expect(result).toEqual(['https://example.com/first.jpg']);
    });

    it('returns only the first VIDEO-type asset for REEL (same rule as VIDEO_POST)', () => {
        const result = resolveTargetMediaUrls({
            publishFormat: SocialPublishFormatEnum.REEL,
            targetMediaRows: [
                imageRow('https://example.com/image.jpg', 0),
                videoRow('https://example.com/first.mp4', 1)
            ],
            postMediaRowsFallback: []
        });

        expect(result).toEqual(['https://example.com/first.mp4']);
    });
});
