/**
 * @file busqueda.test.ts
 * @description Source-based assertions for the search page SSR shell.
 * Verifies that the page uses searchApi, passes initialResults to the island,
 * includes noindex meta, and mounts SearchResultsLive with client:load.
 *
 * Astro components cannot be rendered in Vitest — we assert against source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');

function readPage(relativePath: string): string {
    return readFileSync(resolve(SRC_DIR, 'pages/[lang]', relativePath), 'utf8');
}

const src = readPage('busqueda/index.astro');

describe('busqueda/index.astro', () => {
    describe('SSR rendering strategy', () => {
        it('does NOT set prerender = true (it is SSR)', () => {
            expect(src).not.toContain('prerender = true');
        });

        it('reads q from URL searchParams', () => {
            expect(src).toContain("searchParams.get('q')");
        });
    });

    describe('API integration', () => {
        it('imports searchApi', () => {
            expect(src).toContain('searchApi');
        });

        it('calls searchApi.search when q.length >= 2', () => {
            expect(src).toContain('searchApi.search({ q');
        });

        it('passes initialResults to the island', () => {
            expect(src).toContain('initialResults={initialResults}');
        });
    });

    describe('Island mounting', () => {
        it('imports SearchResultsLive', () => {
            expect(src).toContain('SearchResultsLive');
        });

        it('hydrates SearchResultsLive with client:load', () => {
            expect(src).toContain('client:load');
        });

        it('passes initialQuery to island', () => {
            expect(src).toContain('initialQuery={q}');
        });

        it('passes locale to island', () => {
            expect(src).toContain('locale={locale}');
        });
    });

    describe('SEO', () => {
        it('sets noindex=true on the layout', () => {
            expect(src).toContain('noindex={true}');
        });
    });

    describe('Popular tags', () => {
        it('defines a list of popular tags', () => {
            expect(src).toContain('popularTags');
            expect(src).toContain('Cabañas');
        });

        it('passes popularTags to the island', () => {
            expect(src).toContain('popularTags={');
        });
    });
});
