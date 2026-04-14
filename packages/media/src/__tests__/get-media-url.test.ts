import { describe, expect, it } from 'vitest';
import { getMediaUrl } from '../get-media-url.js';

describe('getMediaUrl', () => {
    const cloudinaryBase =
        'https://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/accommodations/abc/featured.jpg';
    const unsplashUrl = 'https://images.unsplash.com/photo-abc?w=800';

    // REQ-01.3-A: Cloudinary URL with preset
    it('should insert card preset transforms into Cloudinary URL', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'card' });
        expect(result).toBe(
            'https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto/v1234/hospeda/prod/accommodations/abc/featured.jpg'
        );
    });

    // REQ-01.3-B: Non-Cloudinary URL passes through
    it('should return non-Cloudinary URLs unchanged', () => {
        expect(getMediaUrl(unsplashUrl, { preset: 'card' })).toBe(unsplashUrl);
    });

    // REQ-01.3-C: Nullish returns fallback
    it('should return fallback for null', () => {
        expect(getMediaUrl(null)).toBe('/images/placeholder.svg');
    });

    it('should return fallback for undefined', () => {
        expect(getMediaUrl(undefined)).toBe('/images/placeholder.svg');
    });

    it('should return fallback for empty string', () => {
        expect(getMediaUrl('')).toBe('/images/placeholder.svg');
    });

    it('should return fallback for whitespace-only string', () => {
        expect(getMediaUrl('   ')).toBe('/images/placeholder.svg');
    });

    // REQ-01.3-D: Width override
    it('should apply width override while keeping other preset transforms', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'card', width: 600 });
        expect(result).toContain('w_600');
        expect(result).toContain('h_300');
        expect(result).toContain('c_fill');
        expect(result).not.toContain('w_400');
    });

    // REQ-01.3-E: Raw transform string
    it('should use raw transform string bypassing presets', () => {
        const result = getMediaUrl(cloudinaryBase, {
            raw: 'w_300,h_300,c_crop,g_center'
        });
        expect(result).toContain('/upload/w_300,h_300,c_crop,g_center/v1234');
    });

    // REQ-01.4-A: Unknown preset
    it('should throw TypeError for unknown preset', () => {
        // @ts-expect-error Testing invalid preset
        expect(() => getMediaUrl(cloudinaryBase, { preset: 'nonexistent' })).toThrow(TypeError);
        // @ts-expect-error Testing invalid preset
        expect(() => getMediaUrl(cloudinaryBase, { preset: 'nonexistent' })).toThrow(
            'Unknown media preset: nonexistent'
        );
    });

    // All 7 presets work
    it.each(['thumbnail', 'card', 'hero', 'gallery', 'avatar', 'full', 'og'] as const)(
        'should work with preset "%s"',
        (preset) => {
            const result = getMediaUrl(cloudinaryBase, { preset });
            expect(result).toContain('/upload/');
            expect(result).toContain('q_auto');
            expect(result).not.toBe(cloudinaryBase);
        }
    );

    // No options returns URL unchanged
    it('should return Cloudinary URL unchanged when no options provided', () => {
        expect(getMediaUrl(cloudinaryBase)).toBe(cloudinaryBase);
    });

    // Height override
    it('should apply height override', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'card', height: 200 });
        expect(result).toContain('h_200');
        expect(result).not.toContain('h_300');
    });

    // Gallery preset has no h_ to override — should prepend
    it('should prepend width to gallery preset (no existing w_ replacement)', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'gallery', width: 600 });
        expect(result).toContain('w_600');
        expect(result).not.toContain('w_800');
    });

    // Full preset has no w_ or h_ — should prepend both
    it('should prepend width to full preset that has no w_', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'full', width: 500 });
        expect(result).toContain('w_500');
        expect(result).toContain('q_auto');
    });

    it('should prepend height to full preset that has no h_', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'full', height: 400 });
        expect(result).toContain('h_400');
        expect(result).toContain('q_auto');
    });

    // Both width and height overrides together
    it('should apply both width and height overrides', () => {
        const result = getMediaUrl(cloudinaryBase, {
            preset: 'card',
            width: 800,
            height: 600
        });
        expect(result).toContain('w_800');
        expect(result).toContain('h_600');
        expect(result).not.toContain('w_400');
        expect(result).not.toContain('h_300');
    });

    // Raw ignores preset entirely
    it('should ignore preset when raw is provided', () => {
        const result = getMediaUrl(cloudinaryBase, {
            preset: 'card',
            raw: 'w_100,c_scale'
        });
        expect(result).toContain('w_100,c_scale');
        expect(result).not.toContain('c_fill');
    });

    // Thumbnail preset
    it('should insert thumbnail preset transforms', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'thumbnail' });
        expect(result).toContain('w_200,h_200,c_thumb,g_auto,q_auto,f_auto');
    });

    // Hero preset
    it('should insert hero preset transforms', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'hero' });
        expect(result).toContain('w_1200,h_600,c_fill,g_auto,q_auto,f_auto');
    });

    // Avatar preset
    it('should insert avatar preset transforms', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'avatar' });
        expect(result).toContain('w_150,h_150,c_thumb,g_face,q_auto,f_auto');
    });

    // OG preset
    it('should insert og preset transforms', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'og' });
        expect(result).toContain('w_1200,h_630,c_fill,q_auto,f_auto');
    });

    // Transforms placed exactly between /upload/ and path
    it('should place transforms exactly after /upload/ and before the rest of the path', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'card' });
        const parts = result.split('/upload/');
        expect(parts).toHaveLength(2);
        const afterUpload = parts[1] ?? '';
        expect(afterUpload.startsWith('w_400,h_300')).toBe(true);
    });
});
