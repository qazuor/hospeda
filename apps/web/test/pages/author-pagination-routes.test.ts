/**
 * @file author-pagination-routes.test.ts
 * @description Guards for the two author pagination rewrite routes (HOS-375
 * T-021/T-022) and for the `/eventos/` base they depend on.
 *
 * These three files render nothing — they validate a page number and hand off
 * to `autores/[slug]/index.astro`. So the contract worth pinning is not markup
 * but the HANDOFF: which query key each route writes, that page 1 is a redirect
 * rather than a second entry point, and that the parent reads back exactly the
 * keys they write. The last part is executable: the same `buildUrlWithParams`
 * the routes call is imported here and its output is parsed with the parent's
 * own reader.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildUrl, buildUrlWithParams } from '../../src/lib/urls';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]/autores/[slug]');

const POSTS_ROUTE = resolve(PAGES_DIR, 'page/[page].astro');
const EVENTS_ROUTE = resolve(PAGES_DIR, 'eventos/page/[page].astro');
const EVENTS_BASE = resolve(PAGES_DIR, 'eventos/index.astro');
const PARENT = resolve(PAGES_DIR, 'index.astro');

const postsSrc = readFileSync(POSTS_ROUTE, 'utf8');
const eventsSrc = readFileSync(EVENTS_ROUTE, 'utf8');
const parentSrc = readFileSync(PARENT, 'utf8');

// Read tolerantly: deleting this file is the exact regression the suite is here
// to catch, and a throw at import time would fail every test in the file with a
// stack trace instead of the one assertion that names the problem.
const eventsBaseSrc = existsSync(EVENTS_BASE) ? readFileSync(EVENTS_BASE, 'utf8') : '';

/** The routes both use this slug; keeping it in one place keeps them comparable. */
const SLUG = 'juan-perez';

describe('author pagination routes — the handoff the parent reads back', () => {
    // The parent's own reader, copied from `index.astro`. If the parent changes
    // how it parses the page number, this copy diverging is the point: the
    // assertions below are about the URL SHAPE the routes emit, and they must
    // keep matching what the parent is written to accept.
    function readPageParam(url: string, key: string): number {
        const raw = new URL(url, 'https://hospeda.com.ar').searchParams.get(key) ?? '1';
        return Math.max(1, Number.parseInt(raw, 10) || 1);
    }

    it('emits a posts URL the parent reads as `page`, leaving `eventsPage` at 1', () => {
        const url = buildUrlWithParams({
            locale: 'es',
            path: `autores/${SLUG}`,
            params: { page: '3' }
        });

        expect(url).toBe(`/es/autores/${SLUG}/?page=3`);
        expect(readPageParam(url, 'page')).toBe(3);
        expect(readPageParam(url, 'eventsPage')).toBe(1);
    });

    it('emits an events URL the parent reads as `eventsPage`, leaving `page` at 1', () => {
        const url = buildUrlWithParams({
            locale: 'es',
            path: `autores/${SLUG}`,
            params: { eventsPage: '3' }
        });

        expect(url).toBe(`/es/autores/${SLUG}/?eventsPage=3`);
        expect(readPageParam(url, 'eventsPage')).toBe(3);
        // Posts must read as page 1, or `isPostsPaginated` would win and the
        // events rewrite would render the posts block instead.
        expect(readPageParam(url, 'page')).toBe(1);
    });

    it('targets the parent route, not a sibling that does not exist', () => {
        // Both rewrites land on `autores/[slug]/index.astro`; an events rewrite
        // aimed at `autores/[slug]/eventos/` would hit the redirect and loop.
        expect(buildUrl({ locale: 'es', path: `autores/${SLUG}` })).toBe(`/es/autores/${SLUG}/`);
    });

    it('the parent still reads both keys', () => {
        // Non-vacuity guard for the two assertions above.
        expect(parentSrc).toContain("readPageParam('page')");
        expect(parentSrc).toContain("readPageParam('eventsPage')");
    });
});

describe('author pagination routes — posts (T-021)', () => {
    it('rewrites with the posts key and never the events one', () => {
        expect(postsSrc).toContain('params: { page: String(page) }');
        expect(postsSrc).not.toContain('eventsPage');
    });

    it('404s a page number that is not a positive integer', () => {
        expect(postsSrc).toContain('!Number.isInteger(page) || page < 1');
        expect(postsSrc).toContain('status: 404');
    });

    it('redirects page 1 to the profile with a 301', () => {
        expect(postsSrc).toContain('if (page === 1)');
        expect(postsSrc).toContain('Astro.redirect(buildUrl({ locale, path: authorPath }), 301)');
    });

    it('builds both URLs through the builders', () => {
        expect(postsSrc).toContain('Astro.rewrite(');
        expect(postsSrc).toContain('buildUrlWithParams({ locale, path: authorPath');
    });
});

describe('author pagination routes — events (T-022)', () => {
    it('rewrites with the events key and never the posts one', () => {
        expect(eventsSrc).toContain('params: { eventsPage: String(page) }');
        // `page` appears as the local variable name; what must not appear is the
        // posts query key being written.
        expect(eventsSrc).not.toContain('params: { page:');
    });

    it('404s a page number that is not a positive integer', () => {
        expect(eventsSrc).toContain('!Number.isInteger(page) || page < 1');
        expect(eventsSrc).toContain('status: 404');
    });

    it('redirects page 1 to the profile, not to the events base', () => {
        // `/eventos/` is itself a redirect to the profile; pointing here would
        // cost a second hop for no gain.
        expect(eventsSrc).toContain('Astro.redirect(buildUrl({ locale, path: authorPath }), 301)');
        expect(eventsSrc).not.toContain('autores/${slug}/eventos');
    });
});

describe('author pagination routes — the /eventos/ base (T-022)', () => {
    it('exists, because the "Anterior" control on page 2 points at it', () => {
        // `Pagination` renders page 1 as the bare base URL. On
        // `/eventos/page/2/` that is `/autores/<slug>/eventos/` — a real href in
        // shipped markup, so a missing file here is a 404 for every author with
        // more than one page of events.
        expect(existsSync(EVENTS_BASE)).toBe(true);
    });

    it('is a 301 to the profile, not a second copy of it', () => {
        expect(eventsBaseSrc).toContain('Astro.redirect(');
        expect(eventsBaseSrc).toContain('301');
        expect(eventsBaseSrc).toContain('path: `autores/${slug}`');
    });

    it('renders no markup of its own', () => {
        // A template half would mean a duplicate of the profile at a second URL.
        const fences = eventsBaseSrc.split('\n').filter((line) => line.trim() === '---');
        expect(fences).toHaveLength(2);
        expect(eventsBaseSrc.trimEnd().endsWith('---')).toBe(true);
    });

    it('is the URL the events Pagination base resolves to', () => {
        // The parent passes this exact base to `Pagination`; page 1's href is
        // the base with a trailing slash.
        const base = buildUrl({ locale: 'es', path: `autores/${SLUG}/eventos` });
        expect(base).toBe(`/es/autores/${SLUG}/eventos/`);
        expect(parentSrc).toContain('path: `autores/${slug}/eventos`');
    });
});

describe('author pagination routes — URLs and indexability (NG-4, §6.5)', () => {
    /**
     * The file with its comments removed.
     *
     * Every prohibition below is checked against code only. These routes are
     * pure frontmatter, and their docblocks legitimately NAME what they forbid
     * ("carries no reference to the old author path", "makes these URLs
     * `noindex` without a literal") — scanning the raw source would let a
     * sentence about the rule fail the rule.
     */
    function codeOf(source: string): string {
        return source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter((line) => !line.trim().startsWith('//'))
            .join('\n');
    }

    const routes = [
        ['posts', codeOf(postsSrc)],
        ['events', codeOf(eventsSrc)],
        ['events base', codeOf(eventsBaseSrc)]
    ] as const;

    it('codeOf strips the docblock without eating the code', () => {
        // Non-vacuity guard: if this stripped everything, the three rules below
        // would pass on an empty string.
        expect(codeOf(postsSrc)).not.toContain('@file');
        expect(codeOf(postsSrc)).toContain('Astro.rewrite(');
        expect(codeOf(eventsBaseSrc)).toContain('Astro.redirect(');
    });

    for (const [name, code] of routes) {
        it(`${name}: never hand-concatenates the locale`, () => {
            expect(code).not.toContain('Astro.params.lang');
            expect(code).not.toMatch(/`\/\$\{locale\}\//);
        });

        it(`${name}: carries no reference to the old author path`, () => {
            expect(code).not.toContain('publicaciones/autor');
        });

        it(`${name}: decides nothing about robots itself`, () => {
            // `noindex` for pages 2+ comes from the parent feeding the page
            // number to `evaluateAuthorIndexability`. A literal here would be a
            // second, drifting source of the same decision.
            expect(code).not.toContain('noindex');
        });
    }

    it('the parent is what makes the rewritten pages noindex', () => {
        // Non-vacuity guard for the rule above.
        expect(parentSrc).toContain('page: paginatedPage');
        expect(parentSrc).toContain('noindex={!isIndexable}');
    });
});
