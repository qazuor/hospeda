/**
 * @file cacheable-pages-are-session-blind.guard.test.ts
 * @description Static guard for HOS-369 WB0-6.
 *
 * Wave B0 de-personalized the public catalog pages so their HTML is identical
 * for every visitor, which is what makes them safe to share from a Cloudflare
 * edge cache. That property is invisible at runtime until it breaks, and it
 * breaks silently: one `Astro.locals.user` read added to a listing page months
 * from now would start baking one visitor's state into HTML served to
 * everyone, with no error and nothing in the logs. The audit that found
 * `currentUserName` threaded into two detail pages found it because a human
 * went looking, and vigilance does not survive three months (spec §6.3 WB0-6).
 *
 * The guard is **fail-closed**: every page under `src/pages` is session-blind
 * by default and an exemption must be added here, by path, with a reason. A
 * new public page is therefore guarded the moment it is created — the opposite
 * of an allowlist, which would silently miss it.
 *
 * ## What this guard does NOT cover
 *
 * Stated explicitly, because a guard whose blind spots are unknown is worse
 * than no guard:
 *
 * 1. **Indirect session reads.** It matches source text. A page that reads the
 *    session through a helper (`page-helpers.ts`, a new `getViewer()` util)
 *    is invisible to it. The guard checks the two mechanisms that exist today:
 *    `Astro.locals.user` and SSR calls to the protected bookmark endpoints.
 *    The one indirect form it DOES catch is a cookie forwarded out of
 *    frontmatter, which is how `suscriptores/checkout` and the old
 *    `NextEventsSection` personalized themselves without touching
 *    `Astro.locals`.
 * 2. **Other personalized APIs.** `userBookmarksApi` is enumerated because it
 *    is what Wave B0 removed. A different protected client (price alerts,
 *    conversations, entitlements) called from a guarded page's frontmatter
 *    would pass.
 * 3. **The rendered response.** It never renders a page, so it cannot know
 *    which component ends up on which page. Server-rendered `.astro`
 *    components are therefore checked as their own guarded set — a component
 *    that personalizes itself poisons every page that renders it, and
 *    `LatestArticlesSection` was doing exactly that on the home page. React
 *    islands (`.tsx`) are excluded: they run in the browser, where resolving
 *    the visitor is the correct behaviour.
 * 4. **The Cloudflare side.** Cache eligibility, cache keys, and the
 *    session-cookie bypass live in a Cache Rule, not in this repo (W1-2).
 *
 * A companion assertion proves the guard is non-vacuous: it runs the same
 * detectors over synthetic sources and requires them to flag the violation, so
 * a future refactor that neuters the predicate fails here instead of going
 * quiet.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = join(__dirname, '../../src/pages');
const COMPONENTS_ROOT = join(__dirname, '../../src/components');

/** Recursively collect every `.astro` file under `dir`. */
function collectAstroFiles(dir: string): ReadonlyArray<string> {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const absolute = join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...collectAstroFiles(absolute));
        } else if (entry.isFile() && entry.name.endsWith('.astro')) {
            found.push(absolute);
        }
    }
    return found;
}

/**
 * Pages allowed to read the visitor's session, by path prefix relative to
 * `src/pages`. Every entry needs a reason: this list is the escape hatch, and
 * an escape hatch nobody justifies is where the fail-open hides.
 */
const SESSION_AWARE_PREFIXES: ReadonlyArray<{
    readonly prefix: string;
    readonly reason: string;
}> = [
    {
        prefix: '[lang]/mi-cuenta/',
        reason: 'The account area IS the personalized surface. Never cacheable.'
    },
    {
        prefix: '[lang]/auth/',
        reason: 'Sign-in / sign-up redirect an already-authenticated visitor.'
    },
    {
        prefix: '[lang]/feedback/',
        reason: 'The feedback form attributes a report to its author.'
    },
    {
        prefix: '[lang]/publicar',
        reason: 'Host/commerce onboarding funnels branch on whether the visitor already has an account.'
    },
    {
        prefix: '[lang]/newsletter/',
        reason: 'Unsubscribe confirms against the signed-in visitor when there is one.'
    },
    {
        prefix: '[lang]/suscriptores/checkout/',
        reason:
            'A payment flow, bound to the paying visitor. It resolves the session itself via ' +
            'parseSessionUser({ cookieHeader }) rather than Astro.locals, which is precisely ' +
            'the indirect read documented as a blind spot above — the cookieHeader detector is ' +
            'what catches it, so this exemption is deliberate rather than an oversight.'
    }
];

/**
 * The two pages Wave B0 deliberately left personalized, to be de-personalized
 * in WB0-7. They are listed individually — not by prefix — so the exemption
 * cannot silently widen to their siblings, and so this list visibly shrinks to
 * empty when WB0-7 lands.
 */
const PENDING_WB0_7: ReadonlyArray<string> = [
    '[lang]/alojamientos/[slug].astro',
    '[lang]/destinos/[...path].astro'
];

/** Read every `.astro` page, keyed by its path relative to `src/pages`. */
function readPages(): ReadonlyArray<{ readonly path: string; readonly source: string }> {
    const files = collectAstroFiles(PAGES_ROOT);
    return files.map((absolute) => ({
        path: relative(PAGES_ROOT, absolute).split(sep).join('/'),
        source: readFileSync(absolute, 'utf8')
    }));
}

/**
 * Whether a page is expected to be session-blind: not exempt by prefix, and
 * not one of the two files WB0-7 still owns.
 */
function isGuarded(path: string): boolean {
    if (PENDING_WB0_7.includes(path)) return false;
    return !SESSION_AWARE_PREFIXES.some((entry) => path.startsWith(entry.prefix));
}

/**
 * Strip comments before matching.
 *
 * Without this the guard reads prose as code, and it is wrong in BOTH
 * directions: a file that merely documents "on Cloudflare-cached pages
 * `Astro.locals.user` is always null" is reported as a violation
 * (`MobileMenuIsland`, `DiscoveryDoorHub` — both clean), and conversely a
 * comment could be used to argue a real read away. The line-comment pattern
 * requires the `//` not to follow a `:` so URLs survive.
 */
function stripComments(source: string): string {
    return source
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}

/**
 * Session reads a guarded page must not contain.
 *
 * Both forms of the `Astro.locals` read are matched: the direct property access
 * and the destructuring one, because writing `const { user } = Astro.locals`
 * is the obvious way to sidestep a predicate that only looked for the former.
 */
function findSessionReads(rawSource: string): ReadonlyArray<string> {
    const source = stripComments(rawSource);
    const hits: string[] = [];
    if (/Astro\.locals\.user/.test(source)) hits.push('Astro.locals.user');
    if (/const\s*\{[^}]*\buser\b[^}]*\}\s*=\s*Astro\.locals/.test(source)) {
        hits.push('destructured user from Astro.locals');
    }
    return hits;
}

/**
 * Per-visitor API calls a guarded page must not make server-side. The bookmark
 * endpoints are the ones Wave B0 removed; `cookieHeader` is included because
 * forwarding the visitor's cookie to ANY API from page frontmatter is the
 * mechanism by which a response becomes personalized.
 */
function findPersonalizedFetches(rawSource: string): ReadonlyArray<string> {
    const source = stripComments(rawSource);
    const hits: string[] = [];
    if (/userBookmarksApi\s*\.\s*(checkBulk|checkStatus)/.test(source)) {
        hits.push('SSR userBookmarksApi check');
    }
    if (/cookieHeader/.test(source)) hits.push('cookieHeader forwarded from frontmatter');
    return hits;
}

describe('HOS-369 WB0-6 — cacheable pages are session-blind', () => {
    const pages = readPages();

    it('finds pages to check at all', () => {
        // Non-vacuity, first line: a broken glob would make every assertion
        // below pass over an empty set.
        expect(pages.length).toBeGreaterThan(50);
    });

    it('guards a substantial number of public pages', () => {
        const guarded = pages.filter((page) => isGuarded(page.path));

        // Non-vacuity, second line: an over-broad exemption prefix (say,
        // `[lang]/`) would empty the guarded set while every other assertion
        // still reported success.
        expect(guarded.length).toBeGreaterThan(25);
    });

    it('guards the pages Wave B0 de-personalized', () => {
        // Named explicitly so a renamed or moved page cannot fall out of the
        // guarded set unnoticed.
        const mustBeGuarded = [
            '[lang]/alojamientos/index.astro',
            '[lang]/alojamientos/mapa.astro',
            '[lang]/destinos/index.astro',
            '[lang]/eventos/index.astro',
            '[lang]/eventos/[slug].astro',
            '[lang]/experiencias/index.astro',
            '[lang]/gastronomia/index.astro',
            '[lang]/publicaciones/index.astro',
            '[lang]/publicaciones/[slug].astro'
        ];

        for (const path of mustBeGuarded) {
            expect(pages.map((page) => page.path)).toContain(path);
            expect(isGuarded(path)).toBe(true);
        }
    });

    it('no guarded page reads the visitor session', () => {
        const violations = pages
            .filter((page) => isGuarded(page.path))
            .map((page) => ({ path: page.path, hits: findSessionReads(page.source) }))
            .filter((entry) => entry.hits.length > 0);

        expect(violations).toEqual([]);
    });

    it('no guarded page issues a per-visitor API call server-side', () => {
        const violations = pages
            .filter((page) => isGuarded(page.path))
            .map((page) => ({ path: page.path, hits: findPersonalizedFetches(page.source) }))
            .filter((entry) => entry.hits.length > 0);

        expect(violations).toEqual([]);
    });

    it('keeps the WB0-7 exemption honest', () => {
        // Every pending entry must still exist. When WB0-7 lands, these two
        // files stop reading the session and the entries are deleted — this
        // assertion is what makes leaving a stale exemption behind visible.
        const paths = pages.map((page) => page.path);
        for (const pending of PENDING_WB0_7) {
            expect(paths).toContain(pending);
            const page = pages.find((candidate) => candidate.path === pending);
            expect(page).toBeDefined();
            expect(findSessionReads(page?.source ?? '').length).toBeGreaterThan(0);
        }
    });

    it('every exemption prefix carries a reason and matches real pages', () => {
        const paths = pages.map((page) => page.path);
        for (const entry of SESSION_AWARE_PREFIXES) {
            expect(entry.reason.length).toBeGreaterThan(20);
            // A prefix matching nothing is dead weight that hides its own
            // over-breadth; require each to cover at least one real page.
            expect(paths.some((path) => path.startsWith(entry.prefix))).toBe(true);
        }
    });
});

/**
 * Server-rendered `.astro` components that may still resolve the visitor,
 * because they only ever appear on a page that is itself exempt. Listed
 * individually so the exemption cannot widen silently.
 */
const SESSION_AWARE_COMPONENTS: ReadonlyArray<{
    readonly path: string;
    readonly reason: string;
}> = [
    {
        path: 'accommodation/DetailHeader.astro',
        reason: 'Rendered only by alojamientos/[slug].astro, which WB0-7 owns.'
    },
    {
        path: 'destination/DestinationDetailHeader.astro',
        reason: 'Rendered only by destinos/[...path].astro, which WB0-7 owns.'
    },
    {
        path: 'destination/DestinationNearbySection.astro',
        reason: 'Rendered only by destinos/[...path].astro, which WB0-7 owns.'
    }
];

describe('HOS-369 WB0-6 — server-rendered components are session-blind', () => {
    /** Every `.astro` component, keyed by path relative to `src/components`. */
    const components = collectAstroFiles(COMPONENTS_ROOT).map((absolute) => ({
        path: relative(COMPONENTS_ROOT, absolute).split(sep).join('/'),
        source: readFileSync(absolute, 'utf8')
    }));

    const exempt = new Set(SESSION_AWARE_COMPONENTS.map((entry) => entry.path));

    it('finds components to check at all', () => {
        expect(components.length).toBeGreaterThan(30);
    });

    it('no server-rendered component resolves the visitor itself', () => {
        // A personalized component poisons every page that renders it, and the
        // page-level guard cannot see that — it does not resolve the component
        // tree. `LatestArticlesSection` read `Astro.locals.user` on the home
        // page for exactly this reason.
        const violations = components
            .filter((component) => !exempt.has(component.path))
            .map((component) => ({
                path: component.path,
                hits: [
                    ...findSessionReads(component.source),
                    ...findPersonalizedFetches(component.source)
                ]
            }))
            .filter((entry) => entry.hits.length > 0);

        expect(violations).toEqual([]);
    });

    it('keeps the component exemptions honest', () => {
        const paths = components.map((component) => component.path);
        for (const entry of SESSION_AWARE_COMPONENTS) {
            expect(paths).toContain(entry.path);
            expect(entry.reason.length).toBeGreaterThan(20);
        }
    });
});

describe('HOS-369 WB0-6 — the guard is non-vacuous', () => {
    it('flags a direct Astro.locals.user read', () => {
        expect(findSessionReads('const isAuthenticated = Boolean(Astro.locals.user);')).toEqual([
            'Astro.locals.user'
        ]);
    });

    it('flags a destructured session read', () => {
        expect(findSessionReads('const { user, locale } = Astro.locals;')).toContain(
            'destructured user from Astro.locals'
        );
    });

    it('flags an SSR bookmark check', () => {
        expect(
            findPersonalizedFetches('const r = await userBookmarksApi.checkBulk({ entityIds });')
        ).toContain('SSR userBookmarksApi check');
    });

    it('flags a cookie forwarded from frontmatter', () => {
        expect(
            findPersonalizedFetches("const cookieHeader = Astro.request.headers.get('cookie');")
        ).toContain('cookieHeader forwarded from frontmatter');
    });

    it('passes a page that reads only the locale', () => {
        const clean = 'const locale = Astro.locals.locale;\nconst url = Astro.url;';
        expect(findSessionReads(clean)).toEqual([]);
        expect(findPersonalizedFetches(clean)).toEqual([]);
    });

    it('does not read prose as code', () => {
        // Both directions of the comment bug: documenting the pattern is not
        // using it, and a comment must not be able to explain a real read away.
        const documented =
            '/**\n * On Cloudflare-cached pages `Astro.locals.user` is always null.\n */\nconst locale = Astro.locals.locale;';
        expect(findSessionReads(documented)).toEqual([]);

        const excused = '// harmless, honest\nconst viewer = Astro.locals.user;';
        expect(findSessionReads(excused)).toContain('Astro.locals.user');

        // `.astro` templates carry a third comment form, and `MobileMenuIsland`
        // explains the cached-page behaviour inside one.
        const htmlComment = '<!-- on cached pages Astro.locals.user is null -->\n<div />';
        expect(findSessionReads(htmlComment)).toEqual([]);
    });

    it('keeps a protocol-relative URL out of the line-comment stripper', () => {
        // `https://…` must not be mistaken for a comment, or everything after
        // a URL on that line would vanish from the guard's view.
        const withUrl = "const href = 'https://hospeda.com.ar/x'; const v = Astro.locals.user;";
        expect(findSessionReads(withUrl)).toContain('Astro.locals.user');
    });

    it('reports the real page that would break if a guarded page regressed', () => {
        // Reversion check: take a page that IS guarded today, inject the read
        // the guard exists to catch, and confirm it would be reported.
        const guardedPage = readPages().find(
            (page) => page.path === '[lang]/alojamientos/index.astro'
        );
        expect(guardedPage).toBeDefined();
        expect(findSessionReads(guardedPage?.source ?? '')).toEqual([]);

        const regressed = `${guardedPage?.source ?? ''}\nconst viewer = Astro.locals.user;`;
        expect(findSessionReads(regressed)).toContain('Astro.locals.user');
    });
});
