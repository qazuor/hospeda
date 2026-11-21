/**
 * @file help-pages.test.ts
 * @description Source-level guards for the help center pages and the «?»
 * wiring (HOS-2410 `docs/web-ui.md` §2, §4, §5, §6, §8).
 *
 * SCOPE, stated plainly: Vitest cannot render `.astro`, so these assertions
 * prove what the pages DECLARE. Everything they compute is tested for real in
 * `test/lib/help/*` and the islands in `test/components/account/help/*`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HELP_INDEX } from '@repo/help';
import { describe, expect, it } from 'vitest';
import { pageHelpAnchor } from '../../src/lib/help/help-entry';

const SRC = resolve(__dirname, '../../src');
const PAGES = resolve(SRC, 'pages/[lang]');
const read = (path: string): string => readFileSync(resolve(SRC, path), 'utf8');

const LANDING = read('pages/[lang]/mi-cuenta/ayuda/index.astro');
const ARTICLE = read('pages/[lang]/mi-cuenta/ayuda/[id].astro');
const HEADER = read('components/account/AccountPageHeader.astro');
const SHELL = read('layouts/EditorShellLayout.astro');
const HELP_LINK = read('components/account/help/HelpLink.astro');

/** The source of the page a `page:mi-cuenta/...` anchor names. */
function pageSource(anchor: string): string | undefined {
    const route = anchor.replace(/^page:/, '');
    for (const file of [`${route}.astro`, `${route}/index.astro`]) {
        const path = resolve(PAGES, file);
        if (existsSync(path)) {
            return readFileSync(path, 'utf8');
        }
    }
    return undefined;
}

describe('help landing (web-ui §2)', () => {
    it('redirects a guest to sign-in and reads no other per-user value (D-H4)', () => {
        expect(LANDING).toMatch(
            /if \(!user\) \{\s*return Astro\.redirect\(buildUrl\(\{ locale, path: 'auth\/signin' \}\)\);/
        );
        expect(LANDING).not.toMatch(/user\.[a-zA-Z]/);
    });

    it('marks the nav entry active and hydrates both islands lazily', () => {
        expect(LANDING).toContain('activeSection="ayuda"');
        expect(LANDING).toMatch(/<HelpSearch\s+client:idle/);
        expect(LANDING).toContain('<HelpAudiencePreselect client:idle />');
    });

    it('ships the tablist hidden, so without JS every panel shows with its h2 (AC-4)', () => {
        expect(LANDING).toMatch(/role="tablist"[^>]*hidden/);
        expect(LANDING).toMatch(/<h2 class="help-tabs__heading"/);
        expect(LANDING).toContain('initHelpTabs');
    });

    it('selects the tab from ?para= only, never from the session (AC-3)', () => {
        expect(LANDING).toContain("searchParams.get('para')");
        expect(LANDING).toContain('{para === undefined && <HelpAudiencePreselect');
    });
});

describe('help article (web-ui §4)', () => {
    it('answers 404 for an unknown id (AC-10)', () => {
        expect(ARTICLE).toMatch(
            /if \(found === undefined\) \{\s*return new Response\(null, \{ status: 404 \}\);/
        );
    });

    it('wraps the content in its content locale, with the fallback notice (AC-11)', () => {
        expect(ARTICLE).toContain('<article class="help-article" lang={contentLocale}>');
        expect(ARTICLE).toContain('{isFallback && <p class="help-article__notice"');
    });

    it('loads the limit island only when the article has a limit token', () => {
        expect(ARTICLE).toContain('{limitVerticals.length > 0 && <HelpLimitValues client:idle');
    });

    it('renders a side index and a mobile details index', () => {
        expect(ARTICLE).toContain('<details class="help-article__toc-mobile">');
        expect(ARTICLE.match(/data-help-toc/g)?.length).toBeGreaterThanOrEqual(2);
    });
});

describe('«?» wiring (web-ui §6, AC-21, AC-22)', () => {
    it('the header derives the page anchor from the route and renders HelpLink', () => {
        expect(HEADER).toContain('pageHelpAnchor({ routePattern: Astro.routePattern })');
        expect(HEADER).toContain('<HelpLink anchor={anchor} locale={locale} />');
    });

    it('the editor shell passes the section anchor of its vertical', () => {
        expect(SHELL).toContain(
            'sectionHelpAnchor({ vertical: registry.id, slug: currentSectionSlug })'
        );
        expect(SHELL).toContain('helpAnchor={helpAnchor}');
    });

    it('HelpLink renders nothing without an entry and opens in a new tab', () => {
        expect(HELP_LINK).toContain('{entry !== undefined && (');
        expect(HELP_LINK).toContain('target="_blank"');
        expect(HELP_LINK).toContain('rel="noopener"');
    });

    it.each(
        HELP_INDEX.locales.es
            .flatMap((article) => article.entryFor)
            .filter((anchor) => anchor.startsWith('page:mi-cuenta'))
    )('the page claimed by %s renders the header that carries the «?»', (anchor) => {
        // Arrange
        const source = pageSource(anchor);

        // Assert
        expect(source, `${anchor} names no page`).toBeDefined();
        expect(source).toMatch(
            /<AccountPageHeader\b|<EditorSectionLayout\b|<ListingEditorSectionLayout\b/
        );
        expect(source).not.toMatch(/helpAnchor=\{null\}/);
    });

    it('claims outside /mi-cuenta get no «?» from the account header (AC-21)', () => {
        const outside = HELP_INDEX.locales.es
            .flatMap((article) => article.entryFor)
            .filter((anchor) => anchor.startsWith('page:') && !anchor.startsWith('page:mi-cuenta'));
        for (const anchor of outside) {
            const route = `/[lang]/${anchor.replace(/^page:/, '')}`;
            expect(pageHelpAnchor({ routePattern: route })).toBeUndefined();
        }
    });
});
