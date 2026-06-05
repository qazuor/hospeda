import { describe, expect, it } from 'vitest';
import { getMediaUrl, stripCloudinaryTransform } from '../get-media-url.js';

describe('getMediaUrl', () => {
    const cloudinaryBase =
        'https://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/accommodations/abc/featured.jpg';
    const unsplashUrl = 'https://images.unsplash.com/photo-abc?w=800';

    // REQ-01.3-A: Cloudinary URL with preset (SPEC-078-GAPS GAP-078-133:
    // every preset now ends in `dpr_auto` for Retina/HiDPI support).
    it('should insert card preset transforms into Cloudinary URL', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'card' });
        expect(result).toBe(
            'https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto,dpr_auto/v1234/hospeda/prod/accommodations/abc/featured.jpg'
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

    // GAP-078-182: raw transform allowlist
    describe('GAP-078-182: raw transform allowlist', () => {
        it('accepts an allowlisted single token (e_grayscale)', () => {
            const result = getMediaUrl(cloudinaryBase, { raw: 'e_grayscale' });
            expect(result).toContain('/upload/e_grayscale/v1234');
        });

        it('accepts a comma-separated string of allowlisted tokens', () => {
            const result = getMediaUrl(cloudinaryBase, {
                raw: 'w_300,h_300,c_crop,g_center,q_auto,f_auto,ar_1.5,dpr_2.0,e_blur:200'
            });
            expect(result).toContain(
                '/upload/w_300,h_300,c_crop,g_center,q_auto,f_auto,ar_1.5,dpr_2.0,e_blur:200/'
            );
        });

        it('rejects an unknown raw token', () => {
            expect(() => getMediaUrl(cloudinaryBase, { raw: 'unknown_token' })).toThrow(TypeError);
            expect(() => getMediaUrl(cloudinaryBase, { raw: 'unknown_token' })).toThrow(
                /Disallowed transform token/
            );
        });

        it('rejects a mixed string when even one token is disallowed', () => {
            expect(() => getMediaUrl(cloudinaryBase, { raw: 'w_300,fl_attachment' })).toThrow(
                TypeError
            );
        });

        it('rejects an l_/u_ overlay token (potential SSRF / remote layer)', () => {
            expect(() => getMediaUrl(cloudinaryBase, { raw: 'l_remote:image:url' })).toThrow(
                TypeError
            );
        });

        it('rejects empty token within raw string', () => {
            expect(() => getMediaUrl(cloudinaryBase, { raw: 'w_300,,h_300' })).toThrow(TypeError);
        });
    });

    // Transforms placed exactly between /upload/ and path
    it('should place transforms exactly after /upload/ and before the rest of the path', () => {
        const result = getMediaUrl(cloudinaryBase, { preset: 'card' });
        const parts = result.split('/upload/');
        expect(parts).toHaveLength(2);
        const afterUpload = parts[1] ?? '';
        expect(afterUpload.startsWith('w_400,h_300')).toBe(true);
    });

    // GAP-078-069 (T-042): per-call fallback override routed through transforms.
    describe('GAP-078-069: options.fallback override', () => {
        it('returns options.fallback when input is null', () => {
            expect(getMediaUrl(null, { fallback: '/default.png' })).toBe('/default.png');
        });

        it('returns options.fallback when input is undefined', () => {
            expect(getMediaUrl(undefined, { fallback: '/default.png' })).toBe('/default.png');
        });

        it('returns options.fallback when input is empty string', () => {
            expect(getMediaUrl('', { fallback: '/default.png' })).toBe('/default.png');
        });

        it('returns options.fallback when input is whitespace-only', () => {
            expect(getMediaUrl('   ', { fallback: '/default.png' })).toBe('/default.png');
        });

        it('prefers per-call fallback over the module-level placeholder', () => {
            // Module default would be `/images/placeholder.svg`; caller override wins.
            const result = getMediaUrl(null, { fallback: '/brand/avatar.svg' });
            expect(result).toBe('/brand/avatar.svg');
            expect(result).not.toBe('/images/placeholder.svg');
        });

        it('applies the preset to a Cloudinary fallback URL', () => {
            const cloudinaryFallback =
                'https://res.cloudinary.com/hospeda/image/upload/v1/placeholders/avatar.jpg';
            const result = getMediaUrl(null, {
                preset: 'avatar',
                fallback: cloudinaryFallback
            });
            // Same preset semantics the normal input would have received.
            expect(result).toContain('/upload/w_150,h_150,c_thumb,g_face,q_auto,f_auto,dpr_auto/');
            expect(result).toContain('placeholders/avatar.jpg');
        });

        it('applies raw transforms to a Cloudinary fallback URL', () => {
            const cloudinaryFallback =
                'https://res.cloudinary.com/hospeda/image/upload/v1/placeholders/hero.jpg';
            const result = getMediaUrl(undefined, {
                raw: 'w_800,h_400,c_fill',
                fallback: cloudinaryFallback
            });
            expect(result).toContain('/upload/w_800,h_400,c_fill/');
        });

        it('applies width/height overrides to a Cloudinary fallback URL', () => {
            const cloudinaryFallback =
                'https://res.cloudinary.com/hospeda/image/upload/v1/placeholders/card.jpg';
            const result = getMediaUrl('', {
                preset: 'card',
                width: 800,
                height: 600,
                fallback: cloudinaryFallback
            });
            expect(result).toContain('w_800');
            expect(result).toContain('h_600');
            expect(result).not.toContain('w_400');
            expect(result).not.toContain('h_300');
        });

        it('leaves a non-Cloudinary fallback URL unchanged', () => {
            const result = getMediaUrl(null, {
                preset: 'avatar',
                fallback: '/local/avatar.svg'
            });
            expect(result).toBe('/local/avatar.svg');
        });

        it('falls back to the module placeholder when options.fallback is empty', () => {
            // Empty-string fallback is treated as "no override"; we never want
            // the function to recurse into another empty branch.
            expect(getMediaUrl(null, { fallback: '' })).toBe('/images/placeholder.svg');
            expect(getMediaUrl(null, { fallback: '   ' })).toBe('/images/placeholder.svg');
        });
    });

    // GAP-078-179 (T-042): skip .replace('/upload/') for non-upload delivery types.
    describe('GAP-078-179: non-upload delivery types are not re-transformed', () => {
        it('returns /image/fetch/ URLs unchanged (preset ignored)', () => {
            const fetchUrl =
                'https://res.cloudinary.com/hospeda/image/fetch/https%3A%2F%2Fimages.unsplash.com%2Fphoto-abc';
            expect(getMediaUrl(fetchUrl, { preset: 'card' })).toBe(fetchUrl);
        });

        it('returns /image/private/ URLs unchanged (signed — mutating path would break signature)', () => {
            const privateUrl =
                'https://res.cloudinary.com/hospeda/image/private/s--abcDEF12--/v1/secret/report.jpg';
            expect(getMediaUrl(privateUrl, { preset: 'card' })).toBe(privateUrl);
        });

        it('returns /image/authenticated/ URLs unchanged', () => {
            const authenticatedUrl =
                'https://res.cloudinary.com/hospeda/image/authenticated/s--abcDEF12--/v1/restricted/doc.jpg';
            expect(getMediaUrl(authenticatedUrl, { preset: 'hero' })).toBe(authenticatedUrl);
        });

        it('does not skip /upload/ URLs just because the string contains the word fetch', () => {
            // Regression: make sure the detection is anchored on the path
            // segment, not an arbitrary substring match.
            const uploadUrl =
                'https://res.cloudinary.com/hospeda/image/upload/v1/fetch-notes/hero.jpg';
            const result = getMediaUrl(uploadUrl, { preset: 'card' });
            expect(result).toContain('/upload/w_400,h_300');
            expect(result).toContain('fetch-notes/hero.jpg');
        });
    });

    // GAP-078-166 + GAP-078-211 + GAP-078-218 (T-042): double-transform guard.
    describe('GAP-078-166/211/218: double-transform regression', () => {
        it('does not inject a second transform into an already-transformed URL (preset)', () => {
            const alreadyTransformed =
                'https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto,dpr_auto/v1234/hospeda/prod/accommodations/abc/featured.jpg';
            const result = getMediaUrl(alreadyTransformed, { preset: 'card' });
            // URL is returned verbatim — no second preset segment stitched in.
            expect(result).toBe(alreadyTransformed);
            // Specifically: must not contain two transform segments side by side.
            expect(result).not.toMatch(/\/upload\/[^/]+\/w_400/);
        });

        it('does not inject a second transform into a named-transform URL (t_<name>)', () => {
            // Cloudinary also supports named transforms of the form `t_<name>`
            // baked into the URL. Those must also short-circuit the replace.
            const namedTransformed =
                'https://res.cloudinary.com/hospeda/image/upload/t_card/v1234/hospeda/prod/accommodations/abc/featured.jpg';
            const result = getMediaUrl(namedTransformed, { preset: 'card' });
            expect(result).toBe(namedTransformed);
            expect(result).not.toMatch(/\/upload\/t_card\/w_400/);
        });

        it('still transforms an URL whose first segment after /upload/ is a version marker', () => {
            // Guard: `v1234` is a version segment, NOT a transform segment.
            // The double-transform detector must let it through so the
            // insert path still runs.
            const versionedUrl =
                'https://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/accommodations/abc/featured.jpg';
            const result = getMediaUrl(versionedUrl, { preset: 'card' });
            expect(result).toContain(
                '/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto,dpr_auto/v1234/'
            );
        });

        it('does not inject a second transform with raw option either', () => {
            const alreadyTransformed =
                'https://res.cloudinary.com/hospeda/image/upload/w_200,h_200,c_thumb,g_auto,q_auto,f_auto,dpr_auto/v1234/hospeda/prod/users/xyz/avatar.jpg';
            const result = getMediaUrl(alreadyTransformed, { raw: 'w_300,h_300,c_crop' });
            expect(result).toBe(alreadyTransformed);
        });
    });

    // GAP-078-212: HTTP (non-HTTPS) Cloudinary URL handling.
    // Documents current behavior: `getMediaUrl` is a pure string transformer
    // that detects the Cloudinary host via `url.includes('res.cloudinary.com')`,
    // so http:// URLs are accepted and transforms are inserted in place. The
    // scheme is preserved as-is (no upgrade, no throw). Hostname enforcement
    // and HTTPS upgrade live in `extractPublicId` and the ingestion layer.
    describe('GAP-078-212: HTTP (non-HTTPS) Cloudinary URLs', () => {
        const httpCloudinaryUrl =
            'http://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/accommodations/abc/featured.jpg';

        it('inserts transforms into an http:// Cloudinary URL without upgrading the scheme', () => {
            const result = getMediaUrl(httpCloudinaryUrl, { preset: 'card' });

            // Scheme is preserved (no auto-upgrade at this layer).
            expect(result.startsWith('http://')).toBe(true);
            expect(result.startsWith('https://')).toBe(false);

            // Transforms are inserted exactly after /upload/.
            expect(result).toContain('/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto,dpr_auto/');
        });

        it('returns an http:// Cloudinary URL unchanged when no options are provided', () => {
            const result = getMediaUrl(httpCloudinaryUrl);

            // Pure passthrough when no preset/raw is supplied.
            expect(result).toBe(httpCloudinaryUrl);
        });
    });
});

// ─── stripCloudinaryTransform ─────────────────────────────────────────────────
// SPEC-186 T-009: strips an existing Cloudinary transform segment from a
// delivery URL so the URL can be re-submitted to getMediaUrl with a different
// preset (per-cell role matching the fixed aspect-ratio of each gallery cell).

describe('stripCloudinaryTransform', () => {
    const GALLERY_URL =
        'https://res.cloudinary.com/hospeda/image/upload/w_800,q_auto,f_auto,dpr_auto/v1234/hospeda/prod/accommodations/abc/gallery.jpg';
    const BARE_URL =
        'https://res.cloudinary.com/hospeda/image/upload/v1234/hospeda/prod/accommodations/abc/gallery.jpg';

    describe('Cloudinary URL with a single-segment transform', () => {
        it('removes the gallery preset transform segment and returns a bare URL', () => {
            const result = stripCloudinaryTransform(GALLERY_URL);
            expect(result).toBe(BARE_URL);
        });

        it('after stripping, getMediaUrl can apply a different preset', () => {
            const stripped = stripCloudinaryTransform(GALLERY_URL);
            const result = getMediaUrl(stripped, { preset: 'galleryFeatured' });
            expect(result).toContain(
                '/upload/w_1000,ar_16:10,c_fill,g_auto,q_auto,f_auto,dpr_auto/'
            );
        });

        it('works with the card preset already applied', () => {
            const cardUrl =
                'https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto,dpr_auto/v1234/sample.jpg';
            const result = stripCloudinaryTransform(cardUrl);
            expect(result).toBe('https://res.cloudinary.com/hospeda/image/upload/v1234/sample.jpg');
        });

        it('allows re-applying galleryHalf preset after stripping the gallery preset', () => {
            const stripped = stripCloudinaryTransform(GALLERY_URL);
            const result = getMediaUrl(stripped, { preset: 'galleryHalf' });
            expect(result).toContain('ar_4:3');
            expect(result).toContain('c_fill');
        });

        it('allows re-applying galleryQuarter preset after stripping', () => {
            const stripped = stripCloudinaryTransform(GALLERY_URL);
            const result = getMediaUrl(stripped, { preset: 'galleryQuarter' });
            expect(result).toContain('ar_1:1');
            expect(result).toContain('c_fill');
            expect(result).toContain('w_400');
        });

        it('allows re-applying the full preset after stripping (for lightbox)', () => {
            const stripped = stripCloudinaryTransform(GALLERY_URL);
            const result = getMediaUrl(stripped, { preset: 'full' });
            expect(result).toContain('q_auto');
            expect(result).not.toContain('c_fill');
            expect(result).not.toContain('ar_');
        });
    });

    describe('Cloudinary URL that is already bare (no transform segment)', () => {
        it('returns the URL unchanged when no transform is present', () => {
            const result = stripCloudinaryTransform(BARE_URL);
            expect(result).toBe(BARE_URL);
        });
    });

    describe('Cloudinary URL with named transform (t_ prefix)', () => {
        it('strips a named transform (t_) segment', () => {
            const namedUrl =
                'https://res.cloudinary.com/hospeda/image/upload/t_media_lib_thumb/v1234/sample.jpg';
            const result = stripCloudinaryTransform(namedUrl);
            expect(result).toBe('https://res.cloudinary.com/hospeda/image/upload/v1234/sample.jpg');
        });
    });

    describe('non-`/upload/` delivery types', () => {
        it('returns /image/fetch/ URLs unchanged', () => {
            const fetchUrl =
                'https://res.cloudinary.com/hospeda/image/fetch/w_400/https://external.com/img.jpg';
            expect(stripCloudinaryTransform(fetchUrl)).toBe(fetchUrl);
        });

        it('returns /image/private/ URLs unchanged', () => {
            const privateUrl =
                'https://res.cloudinary.com/hospeda/image/private/w_400/v1234/sample.jpg';
            expect(stripCloudinaryTransform(privateUrl)).toBe(privateUrl);
        });

        it('returns /image/authenticated/ URLs unchanged', () => {
            const authUrl =
                'https://res.cloudinary.com/hospeda/image/authenticated/w_400/v1234/sample.jpg';
            expect(stripCloudinaryTransform(authUrl)).toBe(authUrl);
        });
    });

    describe('non-Cloudinary URLs — pass-through', () => {
        it('returns a placeholder SVG unchanged', () => {
            const placeholder = '/images/placeholder-accommodation.svg';
            expect(stripCloudinaryTransform(placeholder)).toBe(placeholder);
        });

        it('returns an Unsplash URL unchanged', () => {
            const unsplash = 'https://images.unsplash.com/photo-abc?w=800';
            expect(stripCloudinaryTransform(unsplash)).toBe(unsplash);
        });

        it('returns an empty string unchanged', () => {
            expect(stripCloudinaryTransform('')).toBe('');
        });
    });

    describe('integration: buildCellUrl behavior simulation', () => {
        /**
         * Simulates what ImageGallery.client.tsx does:
         * buildCellUrl(url, preset) = getMediaUrl(stripCloudinaryTransform(url), { preset })
         *
         * Verifies that a URL pre-baked with the 'gallery' preset produces the
         * correct cell-specific Cloudinary URL after the two-step strip + apply.
         */
        it('gallery-preset URL → galleryFeatured produces correct transform', () => {
            const stripped = stripCloudinaryTransform(GALLERY_URL);
            const result = getMediaUrl(stripped, { preset: 'galleryFeatured' });
            expect(result).toBe(
                'https://res.cloudinary.com/hospeda/image/upload/w_1000,ar_16:10,c_fill,g_auto,q_auto,f_auto,dpr_auto/v1234/hospeda/prod/accommodations/abc/gallery.jpg'
            );
        });

        it('gallery-preset URL → galleryHalf produces correct transform', () => {
            const stripped = stripCloudinaryTransform(GALLERY_URL);
            const result = getMediaUrl(stripped, { preset: 'galleryHalf' });
            expect(result).toBe(
                'https://res.cloudinary.com/hospeda/image/upload/w_640,ar_4:3,c_fill,g_auto,q_auto,f_auto,dpr_auto/v1234/hospeda/prod/accommodations/abc/gallery.jpg'
            );
        });

        it('gallery-preset URL → galleryQuarter produces correct transform', () => {
            const stripped = stripCloudinaryTransform(GALLERY_URL);
            const result = getMediaUrl(stripped, { preset: 'galleryQuarter' });
            expect(result).toBe(
                'https://res.cloudinary.com/hospeda/image/upload/w_400,ar_1:1,c_fill,g_auto,q_auto,f_auto,dpr_auto/v1234/hospeda/prod/accommodations/abc/gallery.jpg'
            );
        });

        it('gallery-preset URL → galleryThumb produces correct transform', () => {
            const stripped = stripCloudinaryTransform(GALLERY_URL);
            const result = getMediaUrl(stripped, { preset: 'galleryThumb' });
            expect(result).toBe(
                'https://res.cloudinary.com/hospeda/image/upload/w_120,ar_1:1,c_fill,g_auto,q_auto,f_auto,dpr_auto/v1234/hospeda/prod/accommodations/abc/gallery.jpg'
            );
        });

        it('plain (non-Cloudinary) URL passes through unchanged regardless of preset', () => {
            const placeholder = '/images/placeholder-accommodation.svg';
            const stripped = stripCloudinaryTransform(placeholder);
            // getMediaUrl passes non-Cloudinary through unchanged
            const result = getMediaUrl(stripped, { preset: 'galleryFeatured' });
            expect(result).toBe(placeholder);
        });
    });
});
