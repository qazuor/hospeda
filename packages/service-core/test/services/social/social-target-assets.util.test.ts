import { SocialMediaTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveTargetAssets } from '../../../src/services/social/social-target-assets.util';

describe('resolveTargetAssets', () => {
    it('returns the target own assets as-is when non-empty', () => {
        const ownAssets = [
            { image: { mode: 'public_url' as const, url: 'https://example.com/a.jpg' } },
            { video: { mode: 'public_url' as const, url: 'https://example.com/b.mp4' } }
        ];

        const result = resolveTargetAssets({
            target: { assets: ownAssets },
            legacyImage: { mode: 'public_url', url: 'https://example.com/legacy.jpg' },
            targetMediaType: SocialMediaTypeEnum.IMAGE
        });

        expect(result).toEqual(ownAssets);
        expect(result).toBe(ownAssets);
    });

    it('wraps the legacy image as a single-item fallback when no own assets and media type requires it', () => {
        const legacyImage = { mode: 'public_url' as const, url: 'https://example.com/legacy.jpg' };

        const result = resolveTargetAssets({
            target: {},
            legacyImage,
            targetMediaType: SocialMediaTypeEnum.IMAGE
        });

        expect(result).toEqual([{ image: legacyImage }]);
    });

    it('returns an empty array when the target media type is NONE, even with a legacy image present', () => {
        const result = resolveTargetAssets({
            target: {},
            legacyImage: { mode: 'public_url', url: 'https://example.com/legacy.jpg' },
            targetMediaType: SocialMediaTypeEnum.NONE
        });

        expect(result).toEqual([]);
    });

    it('returns an empty array when there are no own assets and no legacy image', () => {
        const result = resolveTargetAssets({
            target: {},
            targetMediaType: SocialMediaTypeEnum.IMAGE
        });

        expect(result).toEqual([]);
    });

    it('treats an explicitly empty own-assets array as absent and falls back to the legacy image', () => {
        const legacyImage = { mode: 'public_url' as const, url: 'https://example.com/legacy.jpg' };

        const result = resolveTargetAssets({
            target: { assets: [] },
            legacyImage,
            targetMediaType: SocialMediaTypeEnum.IMAGE
        });

        expect(result).toEqual([{ image: legacyImage }]);
    });
});
