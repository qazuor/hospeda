/**
 * @file cacheable-pages-are-session-blind.guard.test.ts
 * @description Static guard for HOS-369 WB0-6, extended by WB0-7.
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
 * 5. **The shell.** A page can be perfectly session-blind and still ship the
 *    visitor's name in the header its layout renders, and this sweep cannot see
 *    that. Covered by a SEPARATE guard on a different invariant — see the note
 *    above the non-vacuity block below.
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
 * Pages Wave B0 deliberately left personalized, to be de-personalized in WB0-7.
 *
 * WB0-7 landed and this list is now EMPTY, which is the point: the two detail
 * pages moved into the guarded set rather than into a permanent exemption. It
 * is kept (rather than deleted along with its last entry) so that the assertion
 * below — "this list is empty" — keeps failing if anyone reaches for it as a
 * convenient way to unblock a future personalized page.
 */
const PENDING_WB0_7: ReadonlyArray<string> = [];

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
 * Three forms of the `Astro.locals` read are matched, because each is a way to
 * sidestep a predicate that only knew about the previous one:
 * - the direct property access, `Astro.locals.user`;
 * - the destructuring one, `const { user } = Astro.locals`;
 * - the ALIASED one, `const locals = Astro.locals as { user?: … }`, which
 *   `Footer.astro` used to work around an incomplete `App.Locals` type and
 *   which the first two predicates were blind to (found while extending this
 *   guard to the shell in WB0-7). The pattern requires the WHOLE `Astro.locals`
 *   object to be captured — `Astro.locals.locale as SupportedLocale` is a
 *   property cast every page does and is deliberately not matched.
 */
function findSessionReads(rawSource: string): ReadonlyArray<string> {
    const source = stripComments(rawSource);
    const hits: string[] = [];
    if (/Astro\.locals\.user/.test(source)) hits.push('Astro.locals.user');
    if (/const\s*\{[^}]*\buser\b[^}]*\}\s*=\s*Astro\.locals/.test(source)) {
        hits.push('destructured user from Astro.locals');
    }
    if (/=\s*Astro\.locals\s*(?:as\b|;)/.test(source)) {
        hits.push('aliased Astro.locals');
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

    it('has no page left pending WB0-7', () => {
        // Inverted from Wave B0's version, which asserted the two detail pages
        // STILL read the session. They no longer do, so the assertion that
        // matters now is that nothing was quietly added back to the list.
        expect(PENDING_WB0_7).toEqual([]);
    });

    it('guards the two detail pages WB0-7 de-personalized', () => {
        // The pages the pending list used to hold. Named explicitly: dropping
        // them from the list only helps if they actually entered the guarded
        // set, and a rename would otherwise take them out of both silently.
        const formerlyPending = [
            '[lang]/alojamientos/[slug].astro',
            '[lang]/destinos/[...path].astro'
        ];
        for (const path of formerlyPending) {
            const page = pages.find((candidate) => candidate.path === path);
            expect(page).toBeDefined();
            expect(isGuarded(path)).toBe(true);
            expect(findSessionReads(page?.source ?? '')).toEqual([]);
            expect(findPersonalizedFetches(page?.source ?? '')).toEqual([]);
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
 *
 * Empty since WB0-7. Its three Wave B0 entries turned out never to have
 * violated either detector — they took favorite state as PROPS from the two
 * detail pages rather than resolving it themselves — so the list was granting
 * an exemption nothing needed, which is the shape a fail-open hides in. The
 * honesty assertion below was tightened to require that an exempt component
 * actually violates, so a future inert entry fails instead of accumulating.
 */
const SESSION_AWARE_COMPONENTS: ReadonlyArray<{
    readonly path: string;
    readonly reason: string;
}> = [];

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
        const byPath = new Map(components.map((component) => [component.path, component.source]));
        for (const entry of SESSION_AWARE_COMPONENTS) {
            expect(byPath.has(entry.path)).toBe(true);
            expect(entry.reason.length).toBeGreaterThan(20);
            // An exemption for a component that does not actually violate is
            // worse than no exemption: it reads as "this one is allowed to"
            // while protecting nothing, and it survives every refactor that
            // makes it obsolete. Require the escape hatch to be load-bearing.
            const hits = [
                ...findSessionReads(byPath.get(entry.path) ?? ''),
                ...findPersonalizedFetches(byPath.get(entry.path) ?? '')
            ];
            expect(hits.length).toBeGreaterThan(0);
        }
    });
});

/**
 * The shell — `BaseLayout`, `Header`, `Footer` — reads the visitor too, and
 * this guard cannot see it: it sweeps `src/pages` and `src/components`, and a
 * layout wraps every page regardless of what the page itself does.
 *
 * That is deliberate, and the fix is NOT to extend this sweep to `src/layouts`.
 * The shell MUST read the visitor on `/mi-cuenta` and `/auth`; the layouts are
 * not the defect. What matters is whether `Astro.locals.user` is POPULATED on a
 * cacheable route at all, which is decided upstream by
 * `SESSION_OPTIONAL_SEGMENTS` — a set membership question, not a source-text
 * one. It is asserted in
 * `test/lib/cacheable-routes-parse-no-session.guard.test.ts` (HOS-369 W1-2a).
 *
 * Recorded here because the two guards are only meaningful together: this one
 * proves a page bakes nothing, that one proves there was nothing to bake.
 */

describe('HOS-369 WB0-6 — the guard is non-vacuous', () => {
    it('flags a direct Astro.locals.user read', () => {
        expect(findSessionReads('const isAuthenticated = Boolean(Astro.locals.user);')).toEqual([
            'Astro.locals.user'
        ]);
    });

    it('flags an aliased Astro.locals read', () => {
        // The form Footer.astro used, invisible to both other predicates.
        expect(
            findSessionReads('const locals = Astro.locals as { user?: { id: string } | null };')
        ).toContain('aliased Astro.locals');
    });

    it('does not flag a property-level cast as an aliased read', () => {
        // Every page writes this; matching it would make the detector useless.
        expect(findSessionReads('const locale = Astro.locals.locale as SupportedLocale;')).toEqual(
            []
        );
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
