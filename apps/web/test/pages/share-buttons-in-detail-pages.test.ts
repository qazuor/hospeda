/**
 * @file share-buttons-in-detail-pages.test.ts
 * @description Source-based assertions for sharing on event, post, and accommodation detail pages.
 *
 * Verifies that sharing receives canonical metadata and is hydrated via the
 * standalone island or the accommodation gallery.
 *
 * Astro components cannot be rendered in Vitest — we assert against source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src/pages/[lang]');

function readPage(relativePath: string): string {
    return readFileSync(resolve(SRC_DIR, relativePath), 'utf8');
}

describe('T-050 — ShareButtons in detail pages', () => {
    describe('alojamientos/[slug].astro — gallery overlays (T-022)', () => {
        const src = readPage('alojamientos/[slug].astro');
        const gallery = src.match(/<ImageGallery\b[\s\S]*?\/>/)?.[0];

        it('hydrates the detail gallery with the page locale', () => {
            expect(gallery).toMatch(/\bvariant="detail"/);
            expect(gallery).toMatch(/\blocale=\{locale\}/);
            expect(gallery).toMatch(/\sclient:load\s/);
        });

        it('wires canonical URL, accommodation title, and Favorite identity through mobile props', () => {
            const mobile = gallery?.match(/\bmobile\s*=\s*\{\{([\s\S]*?)\}\s*\}/)?.[1];

            expect(src).toMatch(
                /const siteOrigin\s*=\s*Astro\.site\?\.href[^\n]*Astro\.url\.origin/
            );
            expect(mobile).toMatch(
                /\bshare:\s*\{\s*url:\s*`\$\{siteOrigin\}\$\{Astro\.url\.pathname\}`\s*,\s*title:\s*accommodation\.name\b/
            );
            expect(mobile).toMatch(
                /\bfavorite:\s*\{\s*entityId:\s*accommodation\.id\s*,\s*entityType:\s*'ACCOMMODATION'\s*,\s*variant:\s*'standalone'/
            );
        });
    });

    describe('eventos/[slug].astro', () => {
        const src = readPage('eventos/[slug].astro');

        it('imports ShareButtons', () => {
            expect(src).toContain('ShareButtons');
            expect(src).toContain('ShareButtons.client');
        });

        it('renders ShareButtons with client:visible', () => {
            expect(src).toContain('client:visible');
        });

        it('passes url prop with canonical URL', () => {
            expect(src).toContain('url={canonical}');
        });

        it('passes title prop with event name', () => {
            expect(src).toContain('title={name}');
        });

        it('passes locale prop', () => {
            expect(src).toContain('locale={locale}');
        });

        it('defines canonical variable', () => {
            expect(src).toContain('const canonical');
        });

        it('no longer has the share buttons TODO comment', () => {
            // The events page had a map placeholder TODO but no share TODO before
            // After T-050 the ShareButtons island is present
            expect(src).not.toContain('<!-- TODO: Share buttons');
        });
    });

    describe('publicaciones/[slug].astro', () => {
        const src = readPage('publicaciones/[slug].astro');

        it('imports ShareButtons', () => {
            expect(src).toContain('ShareButtons');
            expect(src).toContain('ShareButtons.client');
        });

        it('renders ShareButtons with client:visible', () => {
            expect(src).toContain('client:visible');
        });

        it('passes url with Astro.site origin and pathname', () => {
            expect(src).toContain('Astro.site');
            expect(src).toContain('Astro.url.pathname');
        });

        it('passes title prop with post title', () => {
            expect(src).toContain('title={title}');
        });

        it('passes locale prop', () => {
            expect(src).toContain('locale={locale}');
        });

        it('no longer has the share buttons TODO placeholder comment', () => {
            expect(src).not.toContain('TODO: Share buttons component');
        });
    });

    describe('publicaciones/[slug].astro — author link (T-044 re-enable)', () => {
        const src = readPage('publicaciones/[slug].astro');

        it('extracts the author slug from the API author object and forwards it to UI components', () => {
            // After the post-details enrichment the slug travels via
            // `authorForCard.slug` (consumed by PostAuthorCard and PostDetailHeader byline)
            // instead of a standalone `authorSlug` constant.
            expect(src).toContain('authorObj.slug');
            expect(src).toContain('slug: authorObj.slug');
        });
    });

    describe('PostAuthorCard.astro — author link rendering (T-044, B3.4)', () => {
        const authorCardSrc = readFileSync(
            resolve(__dirname, '../../src/components/post/PostAuthorCard.astro'),
            'utf8'
        );

        it('renders author as a link when slug is available', () => {
            expect(authorCardSrc).toContain('post-author-card__name--link');
            // HOS-375 moved the author page to `/autores/`. Linked directly, so
            // this must NOT fall back to the old path and lean on the redirect.
            expect(authorCardSrc).toContain(`autores/\${author.slug}`);
            expect(authorCardSrc).not.toContain('publicaciones/autor/');
        });
    });
});
