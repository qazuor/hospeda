/**
 * @file publicaciones-detail-media.test.ts
 * @description Regression suite for the post-detail enrichment work.
 *
 * BUG: The page used to read `post.featuredImage` as a flat string, but the
 * canonical PostPublicSchema shape is `post.media.featuredImage.url` (and
 * `post.media.gallery[].url` for the rest of the gallery). As a result the
 * cover always fell back to the placeholder SVG and the gallery never rendered.
 *
 * These tests are source-based assertions because Astro components cannot be
 * rendered through Vitest. They guard against a regression of the wrong-field-name
 * read and against losing the new gallery/video/engagement/header coverage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/publicaciones/[slug].astro');
const HEADER_PATH = resolve(__dirname, '../../src/components/post/PostDetailHeader.astro');

const pageSrc = readFileSync(PAGE_PATH, 'utf8');
const headerSrc = readFileSync(HEADER_PATH, 'utf8');

describe('publicaciones/[slug].astro — media + content enrichment', () => {
    describe('cover image reads from the canonical nested media field', () => {
        it('reads featuredImage from post.media.featuredImage.url, not post.featuredImage', () => {
            expect(pageSrc).toContain('mediaObj?.featuredImage?.url');
        });

        it('does NOT regress to reading post.featuredImage as a flat string', () => {
            // Reading post.featuredImage directly was the original bug — there's
            // no such field on the public post schema.
            expect(pageSrc).not.toMatch(/post\.featuredImage(?!\?\.url)/);
        });

        it('keeps a placeholder fallback when no real media is present', () => {
            expect(pageSrc).toContain('/assets/images/placeholder-blog.svg');
        });
    });

    describe('renders the gallery via ImageGallery island when media is available', () => {
        it('imports ImageGallery', () => {
            expect(pageSrc).toContain("from '@/components/ImageGallery.client'");
        });

        it('builds a galleryImages array from featuredImage + media.gallery', () => {
            expect(pageSrc).toContain('galleryImages');
            expect(pageSrc).toContain('mediaObj?.gallery');
        });

        it('uses the cover-plus-grid variant (the post-shaped layout)', () => {
            expect(pageSrc).toContain('variant="cover-plus-grid"');
        });

        it('hydrates the gallery only when visible (client:visible)', () => {
            // The gallery island is heavy — should not block initial paint.
            expect(pageSrc).toMatch(/<ImageGallery[\s\S]*?client:visible/);
        });

        it('falls back to a static <img> placeholder when no real media is loaded', () => {
            expect(pageSrc).toContain('hasRealFeatured');
        });
    });

    describe('videos: optional rendering of media.videos', () => {
        it('extracts postVideos from media.videos array', () => {
            expect(pageSrc).toContain('postVideos');
            expect(pageSrc).toContain('mediaObj?.videos');
        });

        it('only renders the videos section when at least one video is present', () => {
            expect(pageSrc).toMatch(/postVideos\.length > 0/);
        });

        it('uses the i18n key blog.detail.videosTitle for the section title', () => {
            expect(pageSrc).toContain("'blog.detail.videosTitle'");
        });
    });

    describe('PostDetailHeader receives the newly surfaced metadata', () => {
        it('forwards summary, author byline, engagement counters, badges, and updatedAt', () => {
            expect(pageSrc).toContain('summary={summary}');
            expect(pageSrc).toContain('updatedAt={updatedAt ?? null}');
            expect(pageSrc).toContain('likes={Number(post.likes ?? 0)}');
            expect(pageSrc).toContain('comments={Number(post.comments ?? 0)}');
            expect(pageSrc).toContain('shares={Number(post.shares ?? 0)}');
            expect(pageSrc).toContain('isFeatured={Boolean(post.isFeatured)}');
            expect(pageSrc).toContain('isNews={Boolean(post.isNews)}');
            expect(pageSrc).toMatch(/author=\{authorForCard \?/);
        });
    });

    describe('content rendering: delegates to renderContent helper', () => {
        it('imports renderContent from the shared lib', () => {
            expect(pageSrc).toMatch(
                /import\s*\{\s*renderContent\s*\}\s*from\s*['"]@\/lib\/render-content['"]/
            );
        });

        it('calls renderContent with the API body field and the siteOrigin', () => {
            expect(pageSrc).toMatch(
                /safeContentHtml\s*=\s*renderContent\(\s*\{\s*[\s\S]*?raw:\s*String\(post\.contentHtml/
            );
            expect(pageSrc).toMatch(/renderContent\(\s*\{[\s\S]*?siteOrigin/);
        });

        it('no longer imports marked or sanitizeHtml directly (single source of pipeline)', () => {
            expect(pageSrc).not.toMatch(/import\s*\{\s*marked\s*\}/);
            expect(pageSrc).not.toMatch(
                /import\s*\{\s*sanitizeHtml\s*\}\s*from\s*['"]@\/lib\/sanitize-html['"]/
            );
        });

        it('feeds the result to PostContent', () => {
            expect(pageSrc).toContain('safeContentHtml={safeContentHtml}');
        });
    });

    describe('PostDetailHeader renders the new content blocks', () => {
        it('renders a subtitle paragraph when a summary is provided', () => {
            expect(headerSrc).toContain('post-header__summary');
        });

        it('renders an author byline linking to the author profile when a slug exists', () => {
            expect(headerSrc).toContain('post-header__byline');
            expect(headerSrc).toContain('publicaciones/autor/');
        });

        it('renders an "updated on" indicator when updatedAt is meaningfully later than publishedAt', () => {
            expect(headerSrc).toContain('post-header__updated');
            expect(headerSrc).toContain('showUpdated');
        });

        it('renders News and Featured badges when their flags are true', () => {
            expect(headerSrc).toContain('post-header__flag--news');
            expect(headerSrc).toContain('post-header__flag--featured');
            expect(headerSrc).toContain("'blog.detail.badge.news'");
            expect(headerSrc).toContain("'blog.detail.badge.featured'");
        });

        it('renders engagement counters (likes/comments/shares) when any > 0', () => {
            expect(headerSrc).toContain('post-header__engagement');
            expect(headerSrc).toContain("'blog.detail.engagement.likes'");
            expect(headerSrc).toContain("'blog.detail.engagement.comments'");
            expect(headerSrc).toContain("'blog.detail.engagement.shares'");
        });

        it('hides the engagement block in the compact (scrolled) WaveHeader state', () => {
            // Style rule must collapse the engagement bar alongside other meta
            expect(headerSrc).toMatch(
                /\.wave-header--compact[\s\S]*?\.post-header__engagement[\s\S]*?max-height:\s*0/
            );
        });
    });
});
