/**
 * Unit tests for the video/story Cloudinary preset constants and resolver
 * (HOS-65 T-017).
 *
 * @module test/services/social/social-video-pipeline-config.util
 */

import { SocialPublishFormatEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    STORY_ASPECT_RATIO_TRANSFORM,
    VIDEO_POST_LIMITS,
    resolveVideoPipelinePreset
} from '../../../src/services/social/social-video-pipeline-config.util';

describe('STORY_ASPECT_RATIO_TRANSFORM', () => {
    it('should enforce a 9:16 vertical aspect ratio with a fill crop', () => {
        expect(STORY_ASPECT_RATIO_TRANSFORM).toEqual({
            aspect_ratio: '9:16',
            crop: 'fill',
            gravity: 'auto'
        });
    });
});

describe('VIDEO_POST_LIMITS', () => {
    it('should cap duration at 60 seconds', () => {
        expect(VIDEO_POST_LIMITS.maxDurationSeconds).toBe(60);
    });

    it('should cap size at 100 MB', () => {
        expect(VIDEO_POST_LIMITS.maxSizeBytes).toBe(100 * 1024 * 1024);
    });
});

describe('resolveVideoPipelinePreset', () => {
    it('should return the STORY transform preset for SocialPublishFormatEnum.STORY', () => {
        const result = resolveVideoPipelinePreset(SocialPublishFormatEnum.STORY);

        expect(result).toEqual({
            kind: 'story',
            transformation: STORY_ASPECT_RATIO_TRANSFORM
        });
    });

    it('should return the VIDEO_POST limits preset for SocialPublishFormatEnum.VIDEO_POST', () => {
        const result = resolveVideoPipelinePreset(SocialPublishFormatEnum.VIDEO_POST);

        expect(result).toEqual({
            kind: 'video_post',
            limits: VIDEO_POST_LIMITS
        });
    });

    it('should return kind "none" for a format with no video/story preset (e.g. CAROUSEL)', () => {
        const result = resolveVideoPipelinePreset(SocialPublishFormatEnum.CAROUSEL);

        expect(result).toEqual({ kind: 'none' });
    });

    it('should return kind "none" for TEXT_POST', () => {
        const result = resolveVideoPipelinePreset(SocialPublishFormatEnum.TEXT_POST);

        expect(result).toEqual({ kind: 'none' });
    });
});
