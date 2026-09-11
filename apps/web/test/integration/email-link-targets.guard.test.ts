/**
 * @file email-link-targets.guard.test.ts
 * @description Every URL an email template builds must resolve to a route this
 * app actually serves.
 *
 * ## Why this exists
 *
 * Six subscription templates shipped seven CTAs pointing at
 * `/es/precios/propietarios`, `/es/cuenta/alojamientos` and
 * `/es/cuenta/facturacion` — paths that never existed, since there is no
 * `precios` and no `cuenta` directory under `src/pages/[lang]`. They were not
 * dormant templates: the dunning cron and the MercadoPago webhook send them, so
 * a customer whose payment had just failed opened an email whose only button
 * dead-ended.
 *
 * It had happened before, on a different template — see the docblock of
 * `packages/notifications/src/templates/utils/addon-links.ts`, where an addon
 * email pointed at the subscription page instead of the addons page. Twice is a
 * pattern, and the pattern has a shape: a template holds a string that only a
 * human clicking it in production can falsify. Nothing in either package can
 * see the other, so neither typecheck nor either test suite can fail.
 *
 * ## Why the guard lives HERE and not in `packages/notifications`
 *
 * Because the fact being asserted is owned by this app: which routes exist. A
 * copy of the route list kept next to the templates would be one more thing to
 * forget to update, which is the failure being prevented. Reading the templates
 * from here costs one relative path and always reads the real, current routes —
 * the same direction `test/pages/beneficios-index.test.ts` already reads the
 * i18n package.
 *
 * It runs in CI through `turbo run test`; it needs no Guards-job step of its
 * own, unlike a `scripts/check-*.sh` guard.
 *
 * ## What it does NOT assert
 *
 * That the destination is the RIGHT page for that button — no static check can
 * know that. Only that a recipient who clicks does not get a 404. A protected
 * route counts as resolving: `/mi-cuenta/*` redirects to login and comes back
 * via `returnUrl`, which is correct for a personalised billing email.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TEMPLATES_DIR = resolve(__dirname, '../../../../packages/notifications/src/templates');
const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

/**
 * Every `${baseUrl}/…` path literal in a template, with the file it came from.
 *
 * Scoped to `templates/` on purpose: `src/transports/` builds
 * `${this.client.baseUrl}/smtp/email`, which is Brevo's REST API and not a page
 * on this site.
 *
 * Comment lines are dropped before matching. `addon-links.ts` documents the
 * wrong destination inside a JSDoc block — in backticks, closing its literal
 * exactly like a real link — and a guard that failed on the comment warning
 * against this very bug would be absurd. (That is not a guess: the first
 * version of this file claimed the backtick alone was enough to separate them,
 * and this suite failed on that comment the first time it ran.)
 *
 * The filter drops LINES rather than deleting comment RANGES, deliberately. A
 * range-deleting version has to find where a comment ends, and a `/*` sequence
 * appearing inside a line comment or a string then swallows everything up to
 * the next `*` + `/` — silently shrinking what the guard sees, which is the one
 * failure a guard may never have.
 */
const LINK_PATTERN = /\$\{baseUrl\}(\/[^`"'\s]*)`/g;

/** Is this line comment prose rather than code? */
function isCommentLine(line: string): boolean {
    const trimmed = line.trimStart();
    return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
}

/** Recursively collect every `.ts`/`.tsx` file under a directory. */
function collectSourceFiles(dir: string): ReadonlyArray<string> {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
}

interface EmailLink {
    readonly file: string;
    readonly raw: string;
    /** Path with the locale segment and any query string removed. */
    readonly routePath: string;
}

/**
 * Strip the locale segment and anything after `?` or `#`.
 *
 * The locale is either the `es` literal most templates hardcode or a
 * `${resolvedLocale}` interpolation. Both map to the same `[lang]` route
 * directory, so both are dropped rather than resolved.
 */
function toRoutePath(raw: string): string {
    const withoutQuery = raw.split(/[?#]/)[0] ?? raw;
    const segments = withoutQuery.split('/').filter((segment) => segment.length > 0);
    const [first, ...rest] = segments;
    const isLocaleSegment =
        first === 'es' || first === 'en' || first === 'pt' || first?.includes('${');

    return (isLocaleSegment ? rest : segments).join('/');
}

const links: ReadonlyArray<EmailLink> = collectSourceFiles(TEMPLATES_DIR).flatMap((file) => {
    const source = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !isCommentLine(line))
        .join('\n');

    return [...source.matchAll(LINK_PATTERN)].map((match) => ({
        file: file.slice(TEMPLATES_DIR.length + 1),
        raw: match[1] as string,
        routePath: toRoutePath(match[1] as string)
    }));
});

/**
 * Does `routePath` correspond to a page this app serves?
 *
 * Astro's file routing gives a path two possible files, and both count:
 * `foo/bar/index.astro` and `foo/bar.astro`. The empty path is the locale root
 * (`[lang]/index.astro`).
 */
function routeExists(routePath: string): boolean {
    if (routePath.length === 0) return existsSync(join(PAGES_DIR, 'index.astro'));

    const asIndex = join(PAGES_DIR, routePath, 'index.astro');
    const asFile = join(PAGES_DIR, `${routePath}.astro`);

    return existsSync(asIndex) || existsSync(asFile);
}

describe('email templates link at routes this app serves', () => {
    it('finds links to check', () => {
        // A renamed templates directory, or a pattern that stopped matching,
        // would otherwise make every assertion below pass on an empty list.
        expect(links.length).toBeGreaterThan(10);
    });

    it('every link resolves to a real page', () => {
        const dead = links
            .filter((link) => !routeExists(link.routePath))
            .map(
                (link) =>
                    `${link.file}: ${link.raw} → no page at src/pages/[lang]/${link.routePath}`
            );

        expect(dead, dead.join('\n')).toEqual([]);
    });

    it('every link ends in a trailing slash', () => {
        // The middleware 301s a path without one, so a slashless link costs the
        // recipient a redirect before their page loads. Cheap to keep right,
        // invisible when it is wrong.
        const missing = links
            .filter((link) => !link.raw.split(/[?#]/)[0]?.endsWith('/'))
            .map((link) => `${link.file}: ${link.raw}`);

        expect(missing, missing.join('\n')).toEqual([]);
    });

    it('would actually catch a dead link — the predicate is live', () => {
        // Without this, both assertions above pass just as happily on a
        // `routeExists` that returns true for everything.
        expect(routeExists('precios/propietarios')).toBe(false);
        expect(routeExists('cuenta/facturacion')).toBe(false);
        expect(routeExists('mi-cuenta/suscripcion')).toBe(true);
        // The `.astro`-file form, not just the directory form.
        expect(routeExists('mi-cuenta/newsletter')).toBe(true);
    });
});
