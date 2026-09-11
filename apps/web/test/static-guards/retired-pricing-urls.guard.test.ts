/**
 * @file retired-pricing-urls.guard.test.ts
 * @description No source file in the repo may name one of the pricing URLs
 * HOS-1032 turned into 301s (AC-51).
 *
 * ## Why a guard and not a careful pass
 *
 * There was a careful pass. It repointed eighteen call sites and missed
 * fourteen, and the misses were not random — they clustered exactly where a
 * pass looks least:
 *
 * - **Outside `apps/web`.** `apps/api/src/services/trial.service.ts` and
 *   `packages/notifications/.../plan-downgrade-limit-warning.tsx` were never in
 *   scope, because the change was a web change. The email one is the worst
 *   possible place to leave a stale link: it cannot be re-followed once sent,
 *   and several corporate link scanners do not follow 3xx at all.
 * - **In four copies of one literal.** The compare family
 *   (`CompareButton`, `CompareCardSelect`, `ComparisonMatrix`,
 *   `CompareModeToggle`) each spelled the tourist URL by hand.
 *
 * And no test could catch them, because a link to a redirect is not broken. It
 * works in a browser, it returns 200 after one extra round trip, and the only
 * visible cost is a slice of ranking signal plus — for `trial.service.ts` — a
 * DROPPED QUERY STRING, which turned an `?interval=annual` nudge into a page
 * showing monthly prices.
 *
 * ## What it does not claim
 *
 * It matches source text, so it cannot catch a URL assembled from fragments or
 * one that arrives from the database. It catches the shape that actually
 * occurred fourteen times: the path written out as a literal.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../../..');

/**
 * The paths HOS-1032 retired. Every one of these answers a 301 now.
 *
 * Written without a leading slash so the entry matches both a `buildUrl({ path })`
 * argument and an absolute href.
 */
const RETIRED_PATHS: readonly string[] = [
    'suscriptores/planes/anfitriones',
    'suscriptores/planes/turistas',
    'suscriptores/planes/comparar',
    'suscriptores/turistas/comparar',
    'suscriptores/propietarios',
    'publicar-restaurante',
    'publicar-experiencia'
];

/**
 * Files allowed to name a retired path, and why.
 *
 * Deliberately short and specific. Every entry is a file whose JOB is to know
 * the old URL: the redirect page that serves it, the sitemap's exclusion map
 * that classifies it as retired, and the tests that assert both. A new entry
 * here is a claim that some other file legitimately needs to name a URL that
 * redirects — which is nearly always false.
 */
const ALLOWED: readonly RegExp[] = [
    // The redirect pages themselves — they exist to answer these URLs.
    /^apps\/web\/src\/pages\/\[lang\]\/suscriptores\//,
    /^apps\/web\/src\/pages\/\[lang\]\/publicar-(restaurante|experiencia)\//,
    // The sitemap's exclusion map, which classifies each retired URL so the
    // "every parameter-free page is classified" guard stays satisfied.
    /^apps\/web\/src\/lib\/seo\/static-sitemap-pages\.ts$/,
    // Tests, including this one: asserting a retired URL is how they guard it.
    /\.test\.(ts|tsx)$/,
    /^apps\/web\/test\//
];

/**
 * Lines that are prose about the old URL rather than a link to it.
 *
 * A retired URL is allowed to be DISCUSSED — every redirect page, and several
 * of the modules that moved, explain in their docblock which URL they replaced,
 * and that history is the most useful thing in those files. What is not allowed
 * is naming one where a browser would follow it.
 *
 * Matching the comment marker at the start of the line is enough because the
 * repo formats with Biome: a block comment's continuation lines always start
 * with `*`, and nothing puts a live href on a line that begins that way.
 */
const COMMENT_LINE = /^\s*(\*|\/\/|\/\*|#|-{2,})/;

/**
 * Every tracked source file naming `path` on a NON-COMMENT line, via `git grep`
 * so the repo's own ignore rules apply and `node_modules` is never walked.
 */
function filesNaming(path: string): readonly string[] {
    let out: string;
    try {
        out = execFileSync(
            'git',
            [
                'grep',
                '-n',
                '--fixed-strings',
                path,
                '--',
                // CODE only. Markdown is excluded on purpose: a doc naming a
                // retired URL is a doc to update, not a link a browser follows,
                // and putting prose under this guard would make it fire on the
                // migration notes that explain the move.
                'apps/**/*.ts',
                'apps/**/*.tsx',
                'apps/**/*.astro',
                'apps/**/*.json',
                'packages/**/*.ts',
                'packages/**/*.tsx',
                'packages/**/*.astro',
                'packages/**/*.json',
                'scripts/**/*.ts',
                'scripts/**/*.sh'
            ],
            { cwd: REPO_ROOT, encoding: 'utf8' }
        );
    } catch (error) {
        // `git grep` exits 1 with no output when nothing matches — the good case.
        const status = (error as { status?: number }).status;
        if (status === 1) return [];
        throw error;
    }

    const files = new Set<string>();
    for (const line of out.split('\n')) {
        if (!line) continue;
        // `git grep -n` emits `path:lineno:content`; the content may itself
        // contain colons, so split only the first two.
        const firstColon = line.indexOf(':');
        const secondColon = line.indexOf(':', firstColon + 1);
        if (firstColon === -1 || secondColon === -1) continue;
        const file = line.slice(0, firstColon);
        const content = line.slice(secondColon + 1);
        if (COMMENT_LINE.test(content)) continue;
        files.add(file);
    }
    return [...files].sort();
}

/** Strip the files whose job is to name the old URL. */
function offenders(files: readonly string[]): readonly string[] {
    return files.filter((file) => !ALLOWED.some((pattern) => pattern.test(file)));
}

describe('retired pricing URLs (HOS-1032 AC-51)', () => {
    it.each(RETIRED_PATHS)('no source file outside the allowlist names %s', (path) => {
        const found = offenders(filesNaming(path));
        expect(
            found,
            `These files link to a URL that 301s. Read the path from ` +
                `PRICING_PAGE_PATH_BY_AUDIENCE (apps/web) or spell the new one ` +
                `(apps/api, packages/*):\n  ${found.join('\n  ')}`
        ).toEqual([]);
    });

    it('actually searches the repo — a known-present path is found', () => {
        // Without this, a `git grep` that silently returned nothing (wrong cwd,
        // wrong pathspec, a changed exit convention) would make every case above
        // pass over an empty result set. That is the failure mode where a guard
        // reports green because it checked nothing.
        const found = filesNaming('planes/anfitriones/precios');
        expect(found.length).toBeGreaterThan(0);
    });
});
