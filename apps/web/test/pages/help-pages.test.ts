/**
 * @file help-pages.test.ts
 * @description Source-level guards for the help center pages and the «?»
 * wiring (HOS-2410 `docs/web-ui.md` §2, §4, §5, §6, §8).
 *
 * SCOPE, stated plainly: Vitest cannot render `.astro`, so these assertions
 * prove what the pages DECLARE. Everything they compute is tested for real in
 * `test/lib/help/*` and the islands in `test/components/account/help/*`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { HELP_INDEX } from '@repo/help';
import {
    EDITOR_NON_SECTION_PAGE_SLUGS,
    EDITOR_SECTION_SLUGS,
    EDITOR_SECTION_TEMPLATE_BY_VERTICAL,
    PORTAL_ROUTE_TEMPLATES
} from '@repo/portal-routes';
import { describe, expect, it } from 'vitest';
import { findHelpEntry, pageHelpAnchor } from '../../src/lib/help/help-entry';

const SRC = resolve(__dirname, '../../src');
const PAGES = resolve(SRC, 'pages/[lang]');
const read = (path: string): string => readFileSync(resolve(SRC, path), 'utf8');

const LANDING = read('pages/[lang]/mi-cuenta/ayuda/index.astro');
const ARTICLE = read('pages/[lang]/mi-cuenta/ayuda/[id].astro');
const HEADER = read('components/account/AccountPageHeader.astro');
const SHELL = read('layouts/EditorShellLayout.astro');
const HELP_LINK = read('components/account/help/HelpLink.astro');
const LAYOUT = read('layouts/AccountLayout.astro');
const ACCOUNT_HEADER = read('layouts/AccountHeader.astro');
const PAGE_HELP_LINK = read('components/account/help/PageHelpLink.astro');
const OWNER_DASHBOARD = read('components/account/dashboard/OwnerDashboardPage.astro');

/**
 * What gives a page the «?» of ITS OWN article (HOS-2546): the title row of
 * `AccountPageHeader`, directly or through an editor layout, or the kit
 * `PageHeader` with `<PageHelpLink slot="help">` (or the owner dashboard
 * template, which carries one). Since `PageHelpRow` is gone, the account layout
 * alone is not enough.
 */
const PAGE_HELP_PATH =
    /<AccountPageHeader\b|<PageHelpLink\b[^>]*slot="help"|<OwnerDashboardPage\b|<EditorSectionLayout\b|<ListingEditorSectionLayout\b/;

/** What gives a page at least the general «?»: a page «?», or the account header's. */
const HELP_PATH = new RegExp(`${PAGE_HELP_PATH.source}|<AccountLayout\\b|<OwnerDashboardPage\\b`);

/**
 * Onboarding gates the middleware sends a user to before the account itself:
 * they render the site chrome (`BaseLayout`), so they have neither «?». No
 * article claims their anchors; a test below fails if one ever does, because
 * such a page would then need a «?» wired next to its title.
 */
const ONBOARDING_GATE_PAGES = [
    'agregar-contrasena/index.astro',
    'cambiar-contrasena/index.astro',
    'completar-perfil/index.astro'
];

/**
 * Account pages with no user surface: they redirect before rendering, so they
 * need no «?» (web-ui §6, `comercio/nuevo` is a 301 to /publicar).
 */
const REDIRECT_ONLY_PAGES = ['comercio/nuevo/[vertical].astro', 'comercio/nuevo/index.astro'];

/** Every `.astro` page under `/mi-cuenta`, relative to that folder. */
function accountPages(): string[] {
    const root = resolve(PAGES, 'mi-cuenta');
    const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const path = resolve(dir, entry.name);
            if (entry.isDirectory()) return walk(path);
            return entry.name.endsWith('.astro') ? [relative(root, path)] : [];
        });
    return walk(root).sort();
}

/** The `Astro.routePattern` of a page file under `/mi-cuenta`. */
function routePatternOf(file: string): string {
    const route = file.replace(/\.astro$/, '').replace(/(^|\/)index$/, '');
    return `/[lang]/mi-cuenta${route === '' ? '' : `/${route}`}`;
}

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
            /if \(!user\) \{\s*return Astro\.redirect\(\s*buildLoginRedirect\(\{ locale, currentUrl: Astro\.url\.pathname \+ Astro\.url\.search \}\),?\s*\);/
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

    it('keeps the tabs on one scrollable row instead of wrapping (HOS-2552)', () => {
        expect(LANDING).toMatch(
            /\.help-tabs__list \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/
        );
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

    it("breadcrumbs the reader's tab from ?para= only, never the first audience (HOS-2552)", () => {
        expect(ARTICLE).toContain(
            'const crumbAudience = helpCrumbAudience({ para, audiences: article.audiences });'
        );
        expect(ARTICLE).not.toContain('article.audiences[0]');
        expect(ARTICLE).not.toMatch(/user\.[a-zA-Z]/);
    });

    it('searches with the same placeholder and button as the landing (HOS-2552)', () => {
        expect(ARTICLE).toContain("placeholder={t('account.help.search.placeholder')}");
        expect(ARTICLE).toContain("{t('account.help.search.submit')}");
    });

    it('adds no literal scroll-margin on top of the global scroll-padding (HOS-2552)', () => {
        // Only the mobile account-bar offset and its 64rem reset are allowed.
        expect(ARTICLE).not.toMatch(/scroll-margin-top:\s*[1-9]/);
        expect(ARTICLE).toMatch(/@media \(min-width: 64rem\) \{[^@]*scroll-margin-top: 0;/);
    });

    it('on mobile, headings clear the sticky account nav bar too (HOS-2552)', () => {
        // Mobile-first (closed breakpoint list, HOS-2469): the offset is the
        // base rule, before any @media block resets it.
        const base = ARTICLE.slice(
            0,
            ARTICLE.indexOf('@media (min-width: 64rem) {\n\t\t.help-article__h2')
        );
        expect(base).toMatch(
            /\.help-article__h2,\s*\.help-article__prose :global\(h3\) \{\s*scroll-margin-top: var\(--help-account-bar-height\);/
        );
        expect(LAYOUT).toMatch(
            /@media \(max-width: 768px\)[\s\S]*\.account-page__nav \{\s*position: sticky;/
        );
    });

    it('reserves exactly the rendered height of the account bar (HOS-2563)', () => {
        const barCss = read('components/account/ui/AccountBar.module.css');
        const barHeight = barCss.match(/\.bar\s*{[^}]*block-size: ([\d.]+rem);/)?.[1];
        expect(barHeight).toBeDefined();
        expect(ARTICLE).toContain(`--help-account-bar-height: ${barHeight};`);
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

    it('HelpLink renders nothing without an entry and puts helpLinkAttributes on its <a>', () => {
        // The new-tab rule itself is tested as behaviour in help-entry.test.ts
        // (helpLinkAttributes); here only that the component uses all of it.
        expect(HELP_LINK).toContain('{entry !== undefined && link !== undefined && (');
        expect(HELP_LINK).toContain('helpLinkAttributes({ anchor:');
        for (const attribute of [
            'href={link.href}',
            'target={link.target}',
            'rel={link.rel}',
            'aria-label={link.ariaLabel}'
        ]) {
            expect(HELP_LINK).toContain(attribute);
        }
        expect(HELP_LINK).not.toMatch(/target="|rel="|helpLinkOpensNewTab\(/);
    });

    it.each(
        HELP_INDEX.locales.es.flatMap((article) =>
            article.entryFor
                .filter((anchor) => anchor.startsWith('page:mi-cuenta'))
                .map((anchor) => [anchor, article.id] as const)
        )
    )('%s resolves to a «?» that opens %s (web-ui §8)', (anchor, id) => {
        // Arrange
        const source = pageSource(anchor);
        const file = accountPages().find(
            (page) => pageHelpAnchor({ routePattern: routePatternOf(page) }) === anchor
        );

        // Assert: the page exists, has a «?» path, derives this anchor, and it finds the article
        expect(source, `${anchor} names no page`).toBeDefined();
        expect(source).toMatch(PAGE_HELP_PATH);
        expect(source).not.toMatch(/helpAnchor=\{null\}/);
        expect(file, `no page derives ${anchor}`).toBeDefined();
        expect(findHelpEntry({ anchor, locale: 'es' })?.id).toBe(id);
    });

    it.each(
        HELP_INDEX.locales.es.flatMap((article) =>
            article.entryFor.filter((anchor) => anchor.startsWith('section:'))
        )
    )('%s names a real editor slug of its vertical, with a page', (anchor) => {
        // Arrange
        const [vertical = '', slug = ''] = anchor.replace(/^section:/, '').split('.');
        const slugs = [
            ...Object.values(
                EDITOR_SECTION_SLUGS[vertical as keyof typeof EDITOR_SECTION_SLUGS] ?? {}
            ),
            ...Object.values(
                EDITOR_NON_SECTION_PAGE_SLUGS[
                    vertical as keyof typeof EDITOR_NON_SECTION_PAGE_SLUGS
                ] ?? {}
            )
        ];
        const templateKey =
            EDITOR_SECTION_TEMPLATE_BY_VERTICAL[
                vertical as keyof typeof EDITOR_SECTION_TEMPLATE_BY_VERTICAL
            ];
        const template = templateKey === undefined ? '' : PORTAL_ROUTE_TEMPLATES[templateKey];
        const page = template.replace('[section]', slug);

        // Assert
        expect(slugs, `${anchor}: no such slug in ${vertical}`).toContain(slug);
        expect(
            existsSync(resolve(PAGES, `${page}.astro`)) ||
                existsSync(resolve(PAGES, page, 'index.astro')),
            `${anchor}: no page at ${page}`
        ).toBe(true);
        expect(findHelpEntry({ anchor, locale: 'es' })).toBeDefined();
    });

    it('every /mi-cuenta page has a «?» path, except the redirect-only ones', () => {
        // Act
        const missing = accountPages().filter(
            (page) =>
                !REDIRECT_ONLY_PAGES.includes(page) &&
                !ONBOARDING_GATE_PAGES.includes(page) &&
                !HELP_PATH.test(readFileSync(resolve(PAGES, 'mi-cuenta', page), 'utf8'))
        );

        // Assert
        expect(missing).toEqual([]);
        for (const page of REDIRECT_ONLY_PAGES) {
            expect(readFileSync(resolve(PAGES, 'mi-cuenta', page), 'utf8')).toContain('redirect(');
        }
    });

    it('PageHelpRow and its fallback CSS no longer exist (HOS-2546)', () => {
        expect(existsSync(resolve(SRC, 'components/account/help/PageHelpRow.astro'))).toBe(false);
        expect(LAYOUT).not.toContain('PageHelpRow');
        expect(LAYOUT).not.toContain('data-help-fallback');
        for (const page of accountPages()) {
            const source = readFileSync(resolve(PAGES, 'mi-cuenta', page), 'utf8');
            expect(source, page).not.toContain('PageHelpRow');
        }
    });

    it('the onboarding gates have no article, so they need no «?»', () => {
        for (const page of ONBOARDING_GATE_PAGES) {
            const anchor = pageHelpAnchor({ routePattern: routePatternOf(page) });
            expect(anchor).toBeDefined();
            expect(findHelpEntry({ anchor, locale: 'es' }), anchor).toBeUndefined();
        }
    });

    it('the account header gives every account page the general «?» (HOS-2550)', () => {
        expect(ACCOUNT_HEADER).toContain('href={actions.help.href}');
        expect(ACCOUNT_HEADER).toContain("ariaLabel={t('account.ui.chrome.helpCenter')}");
    });

    it('a page with an article gets its «?»; a page without one renders none', () => {
        // The article «?» resolves for a registered page…
        const claimed = HELP_INDEX.locales.es.find((article) =>
            article.entryFor.includes('page:mi-cuenta/complementos')
        );
        expect(claimed).toBeDefined();
        expect(findHelpEntry({ anchor: 'page:mi-cuenta/complementos', locale: 'es' })?.id).toBe(
            claimed?.id
        );
        // …and HelpLink renders nothing when no article claims the anchor.
        expect(findHelpEntry({ anchor: 'page:mi-cuenta/favoritos', locale: 'es' })).toBeUndefined();
        expect(HELP_LINK).toContain('{entry !== undefined && link !== undefined && (');
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

describe('kit PageHeader «?» (HOS-2546 after the kit migration)', () => {
    it('PageHelpLink derives the page anchor from the route and renders HelpLink', () => {
        expect(PAGE_HELP_LINK).toContain('pageHelpAnchor({ routePattern: Astro.routePattern })');
        expect(PAGE_HELP_LINK).toContain('<HelpLink anchor={resolved} locale={locale} />');
    });

    it('the owner dashboard template puts a PageHelpLink in its header', () => {
        expect(OWNER_DASHBOARD).toMatch(/<PageHelpLink slot="help"/);
    });
});
