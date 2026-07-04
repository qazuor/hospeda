/**
 * Tests for GptVideoPayloadSchema (HOS-65 T-007, G-3 multi-format publishing).
 *
 * Mirrors GptImagePayloadSchema but supports public_url mode only — video files
 * are too large for the openai_file_refs path (phase 1).
 *
 * @see packages/schemas/src/entities/social/social-draft.http.schema.ts
 */
import { describe, expect, it } from 'vitest';
import {
    GptVideoPayloadSchema,
    SocialDraftTargetSchema
} from '../../../src/entities/social/social-draft.http.schema.js';

describe('GptVideoPayloadSchema', () => {
    it('accepts a valid public_url payload', () => {
        const result = GptVideoPayloadSchema.safeParse({
            mode: 'public_url',
            url: 'https://cdn.example.com/clip.mp4'
        });

        expect(result.success).toBe(true);
    });

    it('accepts optional mimeType and altText alongside url', () => {
        const result = GptVideoPayloadSchema.safeParse({
            mode: 'public_url',
            url: 'https://cdn.example.com/clip.mp4',
            mimeType: 'video/mp4',
            altText: 'A short promo clip'
        });

        expect(result.success).toBe(true);
    });

    it('rejects a public_url payload missing url', () => {
        const result = GptVideoPayloadSchema.safeParse({ mode: 'public_url' });

        expect(result.success).toBe(false);
    });

    it('rejects a non-URL url value', () => {
        const result = GptVideoPayloadSchema.safeParse({ mode: 'public_url', url: 'not-a-url' });

        expect(result.success).toBe(false);
    });

    it('rejects an unknown mode (openai_file_refs not supported for video in phase 1)', () => {
        const result = GptVideoPayloadSchema.safeParse({
            mode: 'openai_file_refs',
            url: 'https://cdn.example.com/clip.mp4'
        });

        expect(result.success).toBe(false);
    });
});

describe('SocialDraftTargetSchema per-target assets (HOS-65 T-008)', () => {
    it('parses a target carrying an image asset and preserves it', () => {
        const result = SocialDraftTargetSchema.safeParse({
            platform: 'INSTAGRAM',
            publishFormat: 'STORY',
            assets: [{ image: { mode: 'public_url', url: 'https://cdn.example.com/pic.jpg' } }]
        });

        expect(result.success).toBe(true);
        // Must be PRESERVED, not stripped — proves the field is defined on the schema.
        expect(result.success && result.data.assets).toHaveLength(1);
    });

    it('parses a target carrying a video asset and preserves it', () => {
        const result = SocialDraftTargetSchema.safeParse({
            platform: 'TIKTOK',
            publishFormat: 'VIDEO_POST',
            assets: [{ video: { mode: 'public_url', url: 'https://cdn.example.com/clip.mp4' } }]
        });

        expect(result.success).toBe(true);
        expect(result.success && result.data.assets).toHaveLength(1);
    });

    it('parses a target with no assets field (backward compatible)', () => {
        const result = SocialDraftTargetSchema.safeParse({
            platform: 'FACEBOOK',
            publishFormat: 'FEED_POST'
        });

        expect(result.success).toBe(true);
        expect(result.success && result.data.assets).toBeUndefined();
    });
});
