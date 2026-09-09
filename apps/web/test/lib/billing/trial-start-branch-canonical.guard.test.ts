/**
 * @file trial-start-branch-canonical.guard.test.ts
 * @description HOS-1233 AC-11 / F-6 — the web-side twin of the API's
 * `publish-eligibility-canonical-predicate.guard.test.ts`.
 *
 * The API already forbids comparing a verdict literal inline: any such
 * expression must go through the canonical predicate, so two surfaces cannot
 * drift into disagreeing about the same question. That guard scans
 * `apps/api/src` and **does not cover `apps/web`** — which is where HOS-1233
 * does most of its work, so the protection HOS-1183 relies on did not extend
 * here by default. This file is that extension.
 *
 * Two deliberate differences from the API twin, both of which would make this
 * guard vacuous if copied across unchanged:
 *
 * 1. **It scans `.astro` as well as `.ts`/`.tsx`.** The API twin's
 *    `SCANNED_EXTENSIONS` is `['.ts', '.tsx']`, which is correct there and
 *    blind here: `PricingCardsGrid.astro` is precisely the file where a
 *    second branch decision would be written. `it('reaches .astro files at
 *    all')` below asserts the scan actually reaches them rather than trusting
 *    the extension list.
 * 2. **The branch names carry a `trial_` prefix.** `'checkout'` unprefixed is
 *    already a common literal in this app — `ctaMode` alone is
 *    `'checkout' | 'link'` on every pricing grid — so a guard anchored on the
 *    bare word would fire constantly on unrelated code, and a guard that cries
 *    wolf gets switched off. Renaming a branch means updating
 *    {@link BRANCH_LITERAL} in the same commit.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');

/**
 * The one module allowed to turn a trial reading into a branch, relative to
 * `src`. Everything else must call `resolveTrialStartBranch` and switch on its
 * result via the exported type, never re-derive the decision from the clock.
 */
const CANONICAL_MODULE = 'lib/billing/trial-start-branch.ts';

/** Every branch literal, in either quote style. */
const BRANCH_LITERAL = /['"](?:trial_create_form|trial_warn_then_checkout|trial_checkout)['"]/g;

/** Decision constructs — same set as the API twin, for the same reasons. */
const DECISION_CONSTRUCT =
    /(===|!==|==|!=|\bcase\b|\.includes\s*\(|\.has\s*\(|new Set\s*\(|\bswitch\b)/g;

/** How close a literal may sit to a decision construct before they are one expression. */
const DECISION_WINDOW = 60;

/**
 * Files allowed to compare a branch literal inline, each with its reason.
 *
 * Empty by design. A file that trips the scan and is not listed here fails CI;
 * adding an entry is a deliberate, reviewable act, which is the whole point.
 */
const DECISION_SCAN_EXCLUSIONS: ReadonlyArray<{
    readonly file: string;
    readonly why: string;
}> = [] as const;

const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.astro'];

/**
 * Strips comments so the guard never fails on prose explaining the rule.
 *
 * Handles HTML comments too: an `.astro` file's markup half uses `<!-- -->`,
 * and a design note there naming a branch would otherwise fail the scan.
 */
function stripComments(source: string): string {
    return source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
}

/** Branch literals in live code sitting next to a decision construct. */
function findInlineBranchDecisions(source: string): string[] {
    const liveCode = stripComments(source);
    const decisions = [...liveCode.matchAll(DECISION_CONSTRUCT)].map((m) => m.index ?? -1);
    const found: string[] = [];

    for (const literal of liveCode.matchAll(BRANCH_LITERAL)) {
        const at = literal.index ?? -1;
        if (decisions.some((d) => Math.abs(d - at) <= DECISION_WINDOW)) {
            found.push(
                liveCode
                    .slice(Math.max(0, at - DECISION_WINDOW), at + DECISION_WINDOW)
                    .replace(/\s+/g, ' ')
                    .trim()
            );
        }
    }
    return found;
}

/** Recursively collect source files under a directory, relative to `base`. */
function collectSourceFiles(dir: string, base: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full, base));
        } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
            found.push(full.slice(base.length + 1));
        }
    }
    return found;
}

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

const SCANNED_FILES = collectSourceFiles(SRC_ROOT, SRC_ROOT);

describe('HOS-1233 AC-11 guard: the scan actually covers what it claims', () => {
    it('scans a substantial number of files', () => {
        // Non-vacuity. An empty or tiny file list satisfies the offender
        // assertion below trivially, which is exactly how a guard reports
        // "clean" while looking at nothing.
        expect(SCANNED_FILES.length).toBeGreaterThan(200);
    });

    it('reaches .astro files at all', () => {
        // The difference from the API twin, asserted rather than assumed.
        // `PricingCardsGrid.astro` is where a second branch decision would
        // most plausibly be written, and dropping '.astro' from
        // SCANNED_EXTENSIONS would leave this guard green and blind.
        const astroFiles = SCANNED_FILES.filter((file) => file.endsWith('.astro'));
        expect(astroFiles.length).toBeGreaterThan(50);
    });

    it('reaches the pricing pages specifically', () => {
        // The five pages this spec changes must be inside the scanned set, not
        // merely "some .astro files somewhere".
        const pricingPages = SCANNED_FILES.filter(
            (file) => file.includes('planes/') && file.includes('precios/')
        );
        expect(pricingPages.length).toBeGreaterThanOrEqual(5);
    });

    it('reaches the canonical module itself', () => {
        expect(SCANNED_FILES).toContain(CANONICAL_MODULE);
    });
});

describe('HOS-1233 AC-11 guard: one module decides the branch', () => {
    it('the canonical module exists and exports the resolver', () => {
        expect(
            readSrc(CANONICAL_MODULE),
            `${CANONICAL_MODULE} no longer exports resolveTrialStartBranch. If the ` +
                'decision moved, point CANONICAL_MODULE at its new home — do not delete ' +
                'this guard.'
        ).toMatch(/export function resolveTrialStartBranch\s*\(/);
    });

    it('no other file under src/ decides the branch inline', () => {
        const allowed = new Set<string>([
            CANONICAL_MODULE,
            ...DECISION_SCAN_EXCLUSIONS.map((e) => e.file)
        ]);

        const offenders = SCANNED_FILES.filter((file) => !allowed.has(file)).flatMap((file) =>
            findInlineBranchDecisions(readSrc(file)).map((hit) => `${file}: ${hit}`)
        );

        expect(
            offenders,
            'These expressions decide the Empezar branch by comparing a branch literal ' +
                `inline:\n${offenders.map((f) => `  - ${f}`).join('\n')}\n\n` +
                'Call resolveTrialStartBranch and switch on the returned TrialStartBranch, ' +
                'or add the file to DECISION_SCAN_EXCLUSIONS with the reason it is ' +
                'deliberate. A second place deriving this verdict is R-1.'
        ).toEqual([]);
    });

    it('detects an inline comparison — including a SECOND one', () => {
        // Mutation-verification baked in, per the spec's test plan: a guard
        // anchored on one syntactic form has escapes, and one that only ever
        // reports the first offender lets the second through unnoticed.
        const oneCallSite = "if (branch === 'trial_warn_then_checkout') { openDialog(); }";
        const twoCallSites = `${oneCallSite}\nconst go = branch !== 'trial_checkout';`;

        expect(findInlineBranchDecisions(oneCallSite)).toHaveLength(1);
        expect(findInlineBranchDecisions(twoCallSites)).toHaveLength(2);
    });

    it('detects a switch/case comparison, not only ===', () => {
        const withCase = "switch (branch) { case 'trial_create_form': navigate(); }";
        expect(findInlineBranchDecisions(withCase)).toHaveLength(1);
    });

    it('detects a comparison inside .astro markup logic', () => {
        // An `.astro` frontmatter decision looks like ordinary TS, but the file
        // would never be read at all without '.astro' in SCANNED_EXTENSIONS.
        const astroFrontmatter = "---\nconst warn = branch === 'trial_warn_then_checkout';\n---";
        expect(findInlineBranchDecisions(astroFrontmatter)).toHaveLength(1);
    });

    it('ignores a branch name mentioned in prose', () => {
        // Both comment styles, because an .astro file uses each in a different
        // half. Failing on documentation would make the guard hostile to the
        // very explanations that keep the rule understood.
        const inLineComment = "// returns 'trial_checkout' when nothing is left to protect";
        const inBlockComment = "/* compare against 'trial_checkout' — never inline */";
        const inHtmlComment = "<!-- the 'trial_checkout' branch renders no dialog -->";

        expect(findInlineBranchDecisions(inLineComment)).toEqual([]);
        expect(findInlineBranchDecisions(inBlockComment)).toEqual([]);
        expect(findInlineBranchDecisions(inHtmlComment)).toEqual([]);
    });

    it('ignores a branch literal far from any decision construct', () => {
        // Passing a branch name as data — a translation key, a test fixture —
        // is not a second derivation and must not fail the build.
        const asData = "const label = t('plans.branch.trial_checkout');";
        expect(findInlineBranchDecisions(asData)).toEqual([]);
    });
});
