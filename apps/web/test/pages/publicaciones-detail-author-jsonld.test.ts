/**
 * @file publicaciones-detail-author-jsonld.test.ts
 * @description HOS-375 §5.6 / §6.9 — the post detail page must give the Article
 * structured data a link to its author's page.
 *
 * `ArticleJsonLd` has accepted `author.url` since it was written, but the post
 * page only ever passed `{ name }`, so the emitted Article named an author that
 * search engines had no way to identify as an entity.
 *
 * Astro components cannot be rendered in Vitest (see apps/web/CLAUDE.md), so
 * these assert on the raw source of the page and the component — the page for
 * building the URL, the component for emitting it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/[slug].astro'),
    'utf8'
);

const componentSrc = readFileSync(
    resolve(__dirname, '../../src/components/seo/ArticleJsonLd.astro'),
    'utf8'
);

describe('publicaciones/[slug].astro — Article JSON-LD author.url', () => {
    it('builds the author URL from the slug, pointing at the HOS-375 author page', () => {
        expect(pageSrc).toMatch(/const articleAuthorUrl =/);
        expect(pageSrc).toContain('autores/${authorForCard.slug}');
        // The retired post-only URL must not come back: a canonical entity
        // reference should never resolve through a redirect.
        expect(pageSrc).not.toContain('publicaciones/autor/');
    });

    it('makes it absolute — schema.org entity URLs cannot be path-relative', () => {
        expect(pageSrc).toMatch(/\$\{siteBase\}\$\{buildUrl\(\{ locale, path: `autores\//);
    });

    it('requires BOTH a real author name and a slug before emitting a URL', () => {
        // `articleAuthorName` falls back to the literal 'Hospeda' — the site
        // itself, not a person — and a slug-less author has no page at all.
        // Either case must leave `author.url` off rather than point somewhere
        // wrong.
        expect(pageSrc).toMatch(/articleAuthorName && authorForCard\?\.slug/);
        expect(pageSrc).toMatch(/:\s*undefined;/);
    });

    it('spreads the URL into the author object passed to ArticleJsonLd', () => {
        // Building it and not passing it is the exact shape of the bug this
        // fixes, so the wiring is asserted separately from the computation.
        expect(pageSrc).toContain('...(articleAuthorUrl && { url: articleAuthorUrl })');
        expect(pageSrc).toContain('author={articleAuthor}');
    });
});

describe('ArticleJsonLd.astro — author.url emission', () => {
    it('declares the optional url on the author prop', () => {
        expect(componentSrc).toContain('readonly url?: string;');
    });

    it('emits url only when the caller supplies one', () => {
        // An `url: undefined` key in the JSON-LD is not merely noise — it
        // serializes away, but the conditional spread is what guarantees it.
        expect(componentSrc).toContain('...(author.url && { url: author.url })');
    });
});
