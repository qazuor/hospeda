/**
 * @file post-detail-attribution.test.ts
 * @description Tests for stock image attribution on the post detail page (SPEC-274).
 *
 * IMPORTANT — current state of the attribution render path:
 *
 * The original suite asserted that `<ImageAttribution>` rendered inside a
 * `.post-detail__cover` block. That block was only reachable when
 * `hasRealFeatured` was `false` (i.e. `media.featuredImage.url` was absent) —
 * and in that case `media.featuredImage.attribution` is absent too, so the
 * attribution never actually rendered. Whenever a post DID have a cover, the
 * page took the `ImageGallery` branch, and `ImageGallery` has no attribution
 * support at all.
 *
 * The unreachable cover block was removed so a post with no imagery renders
 * nothing instead of a placeholder. These tests now assert what is actually
 * true: the media type still carries `attribution`, and no placeholder cover
 * markup remains. Rendering attribution for post covers requires wiring it
 * through `ImageGallery` and is NOT implemented.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const postDetailPage = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/[slug].astro'),
    'utf8'
);

const imageGallerySrc = readFileSync(
    resolve(__dirname, '../../src/components/ImageGallery.client.tsx'),
    'utf8'
);

describe('Post detail page - Stock image attribution (SPEC-274)', () => {
    describe('Type definition', () => {
        it('should extend RawMediaImage with attribution field', () => {
            expect(postDetailPage).toContain('interface RawMediaImage {');
            expect(postDetailPage).toContain('attribution?: {');
            expect(postDetailPage).toContain('photographer: string');
            expect(postDetailPage).toContain('sourceUrl: string');
            expect(postDetailPage).toContain('license: string');
            expect(postDetailPage).toContain("provider: 'unsplash' | 'pexels'");
        });
    });

    describe('Cover rendering', () => {
        it('should not render a placeholder cover block', () => {
            // The removed block was the only consumer of ImageAttribution here,
            // and it was unreachable: it required a featuredImage with no url.
            expect(postDetailPage).not.toContain('post-detail__cover');
            expect(postDetailPage).not.toContain('<ImageAttribution');
        });

        it('should gate all image markup on there being at least one real image', () => {
            expect(postDetailPage).toMatch(/\{galleryImages\.length > 0 && \(/);
        });
    });

    describe('Known gap', () => {
        it('documents that ImageGallery cannot display attribution yet', () => {
            // Guard: if someone adds attribution support to ImageGallery, this
            // test fails and the post cover attribution should be wired up.
            expect(imageGallerySrc).not.toContain('attribution');
        });
    });
});
