/**
 * @file author-page.test.ts
 * @description Source guard for `/[lang]/autores/[slug]/index.astro` (HOS-375
 * T-020). Vitest cannot render `.astro`, so the wiring this page must not lose
 * is asserted against its source.
 *
 * Every prohibition is checked against the TEMPLATE half only. The frontmatter
 * docblock legitimately names what the page forbids ("`noindex` is NEVER a
 * literal here"), so scanning the whole file would let a docblock sentence
 * satisfy — or falsely fail — a rule about the markup.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/autores/[slug]/index.astro');
const src = readFileSync(PAGE_PATH, 'utf8');

/**
 * The markup half of an `.astro` file — everything after the closing `---`.
 *
 * Fences are matched as whole lines rather than with `indexOf('---')`: this
 * page's docblock contains a markdown table whose separator row holds `---`,
 * and an index-based search would cut the file in the middle of a comment.
 */
function templateOf(source: string): string {
    const lines = source.split('\n');
    const fences: number[] = [];
    lines.forEach((line, index) => {
        if (line.trim() === '---') fences.push(index);
    });
    if (fences.length < 2) throw new Error('author page lost its frontmatter fences');
    return lines.slice(fences[1] + 1).join('\n');
}

const template = templateOf(src);

describe('author page — the templateOf helper itself', () => {
    it('cuts at the frontmatter fence, not at the table separator in the docblock', () => {
        // Non-vacuity guard for every assertion below: if this split were wrong,
        // the `not.toContain` checks would be scanning the wrong text and would
        // pass for the wrong reason.
        expect(src).toContain('|---');
        expect(template).not.toContain('import ListingLayout');
        expect(template).toContain('<ListingLayout');
    });
});

describe('author page — indexability wiring (§6.5, AC-3/AC-4/AC-13)', () => {
    it('derives noindex from the shared predicate', () => {
        expect(src).toContain('evaluateAuthorIndexability');
        expect(template).toContain('noindex={!isIndexable}');
    });

    it('never hardcodes the robots decision', () => {
        // The old page shipped `noindex={true}` unconditionally. Restoring a
        // literal would silently decouple the page from the sitemap, which
        // decides with the same helper.
        expect(template).not.toContain('noindex={true}');
        expect(template).not.toContain('noindex={false}');
    });

    it('feeds the predicate the system-account flag, not a role', () => {
        // A role check would flip an author's indexability on promotion (R-9).
        expect(src).toContain('isSystemAccount: author.isSystemAccount');
        expect(src).not.toContain('RoleEnum');
    });

    it('feeds the predicate the real published counts and the page number', () => {
        expect(src).toContain('publishedPostsCount: totalPosts');
        expect(src).toContain('publishedEventsCount: totalEvents');
        expect(src).toContain('page: paginatedPage');
    });
});

describe('author page — JSON-LD (§6.8, AC-8)', () => {
    it('mounts ProfilePageJsonLd only when the page is indexable', () => {
        // Structured data on a noindex page is noise.
        expect(template).toContain('{isIndexable && (');
        expect(template).toContain('<ProfilePageJsonLd');
    });

    it('passes an absolute URL, not a path', () => {
        expect(src).toContain('const authorUrl = new URL(authorPath, getSiteUrl()).href');
        expect(template).toContain('url={authorUrl}');
    });

    it('emits it into the head, where a script tag belongs', () => {
        expect(template).toContain('slot="head-extra"');
    });
});

describe('author page — the two content blocks (§6.3)', () => {
    it('renders posts and events as two separately labelled blocks', () => {
        expect(template).toContain("t('authors.posts.heading'");
        expect(template).toContain("t('authors.events.heading'");
    });

    it('puts publicaciones before eventos', () => {
        // Order is part of the spec, not incidental.
        expect(template.indexOf("t('authors.posts.heading'")).toBeLessThan(
            template.indexOf("t('authors.events.heading'")
        );
    });

    it('gives each block its own card component', () => {
        expect(template).toContain('<ArticleCard');
        expect(template).toContain('<EventCardHorizontal');
    });

    it('paginates events on their own sub-route, never on the posts tail', () => {
        expect(src).toMatch(/autores\/\$\{slug\}\/eventos/);
    });

    it('fetches both blocks in one Promise.all, not sequentially', () => {
        expect(src).toContain('await Promise.all([');
        expect(src).toContain('eventsApi.getByAuthor');
        expect(src).toContain('postsApi.list');
    });

    it('logs a failed fetch instead of degrading silently', () => {
        // A broken endpoint and an empty list render identically — correctly so,
        // for the visitor. But that identity is exactly how a 500 on the events
        // endpoint hid while this page shipped no events block for an author who
        // had 52. The log is the only signal the markup cannot carry.
        expect(src).toContain("webLogger.warn('[autores] posts fetch failed");
        expect(src).toContain("webLogger.warn('[autores] events fetch failed");
    });
});

describe('author page — empty profile stays empty (§8)', () => {
    it('renders the avatar only when there is one', () => {
        expect(template).toContain('{avatar && (');
    });

    it('renders the bio only when there is one', () => {
        expect(template).toContain('{bio && <p');
    });

    it('ships no placeholder silhouette or filler copy', () => {
        expect(template).not.toContain('placeholder-avatar');
        expect(template).not.toContain('avatar-fallback');
    });

    it('delegates the social block to the opt-in-aware helper', () => {
        // Passing a default `{}` here would defeat the owner's opt-in.
        expect(src).toContain(
            'resolveAuthorSocialLinks({ socialNetworks: author.socialNetworks })'
        );
        expect(src).not.toContain('socialNetworks: author.socialNetworks ?? {}');
    });
});

describe('author page — URLs (NG-4)', () => {
    it('builds every internal URL through buildUrl', () => {
        expect(src).toContain('buildUrl({ locale');
    });

    it('never hand-concatenates the locale into an author path', () => {
        // `autores` is a fixed segment in all three locales; `buildUrl` is the
        // only thing that prefixes the locale.
        expect(template).not.toMatch(/\/\$\{locale\}\/autores/);
    });

    it('carries no reference to the old author path', () => {
        // AC-9: the whole subtree moved.
        expect(src).not.toContain('publicaciones/autor');
    });
});
