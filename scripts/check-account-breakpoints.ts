#!/usr/bin/env tsx
/**
 * check-account-breakpoints.ts — HOS-2469 (HOS-2413 T-008)
 *
 * D6 «breakpoints cerrados», enforced on the Mi Cuenta surface.
 *
 * ---------------------------------------------------------------------------
 * THE RULE (spec §6.7)
 * ---------------------------------------------------------------------------
 *
 *   - `@media` width features: only `(min-width: 30rem|48rem|64rem|80rem)` and
 *     the range form `(width >= …)` / `(… <= width)` with the same four values.
 *     Anything else that names a width (a `max-width`, px, another rem value,
 *     a bounded range) is a violation. Non-width features are free:
 *     `prefers-*`, `hover`, `pointer`, `forced-colors`, `print`, `orientation`.
 *   - `matchMedia('…')` and Astro `client:media="…"`: the same allowed forms,
 *     plus their complement for the four values only: `(max-width: 63.99rem)`
 *     or `(width < 64rem)`.
 *   - `@container`: any value, but every length in a size feature must be in
 *     `rem`.
 *
 * Scope and zones come from `scripts/lib/account-css-scope.ts`: zero hits in
 * the strict zone (the kit, `AccountShell.astro`, `AccountHeader.astro`), and a
 * FROZEN exceptions list for the legacy zone (OD-9), count-pinned per file and
 * per rule in `scripts/guards/account-breakpoints-exceptions.json`:
 *
 *   - a hit above its pinned count fails (new violation);
 *   - a hit below its pinned count fails (stale entry: lower or remove it, so
 *     each file that migrates in phases 3-5 leaves the list in its own PR);
 *   - an entry under the strict zone fails, whatever its count;
 *   - the list may never grow: `EXCEPTIONS_CEILING` is the size it was born
 *     with, and the guard fails when the list exceeds it. Lower the ceiling
 *     when you shrink the list. Raising it is an owner decision, never a fix.
 *
 * `--print-baseline` prints the current legacy-zone counts as JSON (it is how
 * the initial list was produced) and exits 0.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD DOES NOT SEE — read before trusting its green
 * ---------------------------------------------------------------------------
 *
 *   - Computed styles and anything built at runtime: a `matchMedia(query)` with
 *     a variable or a `${…}` template, a class toggled by a resize listener,
 *     `window.innerWidth` comparisons.
 *   - CSS-in-JS assembled from variables, and media queries inside `.ts`
 *     strings that are not a `matchMedia` call.
 *   - Files outside the scope (global stylesheets, the public site, children
 *     an account page reaches only transitively): see the scope header.
 *   - A `//` inside a string not preceded by `:` is blanked as a comment.
 *
 * @module scripts/check-account-breakpoints
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    cleanSource,
    compareWithExceptions,
    findCssRegions,
    isInStrictZone,
    lineAt,
    listAccountScopeFiles,
    type RuleCounts
} from './lib/account-css-scope.js';

/** The four allowed breakpoint values, in rem (D6). */
const ALLOWED_REM = ['30', '48', '64', '80'] as const;

/** Their complements for `matchMedia` / `client:media` (the 0.01rem step). */
const COMPLEMENT_REM = ['29.99', '47.99', '63.99', '79.99'] as const;

/** Repo-relative path of the frozen exceptions list. */
export const EXCEPTIONS_PATH = 'scripts/guards/account-breakpoints-exceptions.json';

/** Frozen maximum size of the exceptions list (entries = file × rule pairs). */
export const EXCEPTIONS_CEILING = { entries: 27, total: 38 } as const;

/** A scan below this many files means the scope moved or the cwd is wrong. */
export const MIN_SCANNED_FILES = 300;

/** The rule a hit breaks. */
export type BreakpointRule = 'media' | 'container' | 'match-media' | 'client-media';

/** One breakpoint violation. */
export interface BreakpointHit {
    readonly file: string;
    readonly line: number;
    readonly rule: BreakpointRule;
    readonly snippet: string;
}

const ALT = (values: readonly string[]): string =>
    values.map((v) => v.replace('.', '\\.')).join('|');
const MIN_FORM = new RegExp(`^min-width\\s*:\\s*(?:${ALT(ALLOWED_REM)})rem$`);
const RANGE_GE = new RegExp(`^width\\s*>=\\s*(?:${ALT(ALLOWED_REM)})rem$`);
const RANGE_LE = new RegExp(`^(?:${ALT(ALLOWED_REM)})rem\\s*<=\\s*width$`);
const MAX_COMPLEMENT = new RegExp(`^max-width\\s*:\\s*(?:${ALT(COMPLEMENT_REM)})rem$`);
const RANGE_LT = new RegExp(`^width\\s*<\\s*(?:${ALT(ALLOWED_REM)})rem$`);

/** A parenthesised feature that names a width. */
const WIDTH_FEATURE = /(?:^|[\s(:<>=])(?:min-|max-)?(?:device-)?width\b/;

/** Size features inside `@container` (width, height, inline/block size, aspect excluded). */
const SIZE_FEATURE = /\b(?:min-|max-)?(?:width|height|inline-size|block-size)\b/;

/** The innermost `( … )` groups of a prelude, normalised. */
function features(prelude: string): string[] {
    return [...prelude.matchAll(/\(([^()]*)\)/g)].map((m) =>
        (m[1] ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
    );
}

/**
 * Tells whether a media prelude or query string respects D6.
 *
 * @param input.query - The prelude (`@media` part after the keyword) or query.
 * @param input.allowComplement - Accept the `max-width` complement forms
 *   (`matchMedia` and `client:media` only).
 * @returns `true` when every width feature is an allowed form.
 */
export function isAllowedMediaQuery({
    query,
    allowComplement
}: {
    readonly query: string;
    readonly allowComplement: boolean;
}): boolean {
    for (const feature of features(query)) {
        if (!WIDTH_FEATURE.test(feature)) continue;
        if (MIN_FORM.test(feature) || RANGE_GE.test(feature) || RANGE_LE.test(feature)) continue;
        if (allowComplement && (MAX_COMPLEMENT.test(feature) || RANGE_LT.test(feature))) continue;
        return false;
    }
    return true;
}

/**
 * Tells whether a `@container` prelude uses only rem lengths in size features.
 *
 * @param input.prelude - Text after `@container`.
 * @returns `true` when every length is in rem.
 */
export function isAllowedContainerQuery({ prelude }: { readonly prelude: string }): boolean {
    for (const feature of features(prelude)) {
        if (!SIZE_FEATURE.test(feature)) continue;
        for (const m of feature.matchAll(/(\d*\.?\d+)([a-z%]*)/g)) {
            const unit = m[2] ?? '';
            if (unit !== 'rem' && !(unit === '' && Number(m[1]) === 0)) return false;
        }
    }
    return true;
}

/**
 * Finds every breakpoint violation in one file.
 *
 * @param input.file - Repo-relative path (decides the file type).
 * @param input.source - Raw file content.
 * @returns The hits, in file order.
 */
export function findBreakpointHits({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): BreakpointHit[] {
    const clean = cleanSource({ source, file });
    const hits: BreakpointHit[] = [];
    const push = (rule: BreakpointRule, offset: number, snippet: string) => {
        hits.push({
            file,
            line: lineAt({ source, offset }),
            rule,
            snippet: snippet.trim().replace(/\s+/g, ' ')
        });
    };

    for (const region of findCssRegions({ source: clean, file })) {
        if (region.kind !== 'css') continue;
        for (const m of region.text.matchAll(/@media\b([^{;]*)/g)) {
            const prelude = m[1] ?? '';
            if (!isAllowedMediaQuery({ query: prelude, allowComplement: false })) {
                push('media', region.offset + (m.index ?? 0), m[0]);
            }
        }
        for (const m of region.text.matchAll(/@container\b([^{;]*)/g)) {
            if (!isAllowedContainerQuery({ prelude: m[1] ?? '' })) {
                push('container', region.offset + (m.index ?? 0), m[0]);
            }
        }
    }

    if (!file.endsWith('.css')) {
        for (const m of clean.matchAll(/matchMedia\s*\(\s*(['"`])([^'"`]*?)\1/g)) {
            const query = m[2] ?? '';
            if (query.includes('${')) continue;
            if (!isAllowedMediaQuery({ query, allowComplement: true })) {
                push('match-media', m.index ?? 0, m[0]);
            }
        }
        for (const m of clean.matchAll(/client:media\s*=\s*\{?\s*(['"`])([^'"`]*?)\1/g)) {
            if (!isAllowedMediaQuery({ query: m[2] ?? '', allowComplement: true })) {
                push('client-media', m.index ?? 0, m[0]);
            }
        }
    }
    return hits;
}

/** Groups hits into per-file, per-rule counts. */
export function countHits({ hits }: { readonly hits: readonly BreakpointHit[] }): RuleCounts {
    const counts: Record<string, Record<string, number>> = {};
    for (const hit of hits) {
        const rules = counts[hit.file] ?? {};
        rules[hit.rule] = (rules[hit.rule] ?? 0) + 1;
        counts[hit.file] = rules;
    }
    return counts;
}

/**
 * Scans the account surface.
 *
 * @param input.root - Repo root (defaults to the cwd).
 * @returns Every hit and how many files were read.
 */
export function scanAccountBreakpoints({ root = process.cwd() }: { readonly root?: string } = {}): {
    readonly hits: readonly BreakpointHit[];
    readonly scannedFiles: number;
} {
    const files = listAccountScopeFiles({ root });
    const hits = files.flatMap((file) =>
        findBreakpointHits({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    return { hits, scannedFiles: files.length };
}

/** Reads the committed exceptions list. */
export function readExceptions({
    root = process.cwd()
}: {
    readonly root?: string;
} = {}): RuleCounts {
    return JSON.parse(readFileSync(join(root, EXCEPTIONS_PATH), 'utf8')) as RuleCounts;
}

/** Legacy-zone counts, sorted, as `--print-baseline` prints them. */
export function legacyBaseline({ counts }: { readonly counts: RuleCounts }): RuleCounts {
    const out: Record<string, Readonly<Record<string, number>>> = {};
    for (const file of Object.keys(counts).sort()) {
        if (isInStrictZone({ file })) continue;
        const rules = counts[file] ?? {};
        out[file] = Object.fromEntries(
            Object.entries(rules).sort(([a], [b]) => a.localeCompare(b))
        );
    }
    return out;
}

/**
 * CLI entry.
 *
 * @returns Process exit code.
 */
export function run({
    argv = process.argv.slice(2)
}: {
    readonly argv?: readonly string[];
} = {}): number {
    const { hits, scannedFiles } = scanAccountBreakpoints();
    const observed = countHits({ hits });
    if (argv.includes('--print-baseline')) {
        console.log(JSON.stringify(legacyBaseline({ counts: observed }), null, 4));
        return 0;
    }
    if (scannedFiles < MIN_SCANNED_FILES) {
        console.error(
            `check-account-breakpoints: only ${scannedFiles} file(s) in the account scope, expected at least ${MIN_SCANNED_FILES}. The scope moved or the cwd is wrong. This is not a clean tree.`
        );
        return 1;
    }
    const result = compareWithExceptions({
        observed,
        exceptions: readExceptions(),
        ceiling: EXCEPTIONS_CEILING
    });
    const failed =
        result.strictHits.length +
            result.strictEntries.length +
            result.raised.length +
            result.stale.length >
            0 || result.ceilingBreach !== null;
    if (!failed) {
        console.log(
            `check-account-breakpoints: OK, ${scannedFiles} account file(s) scanned; legacy exceptions match ${EXCEPTIONS_PATH} exactly.`
        );
        return 0;
    }
    console.error('=== Account breakpoints (D6 «breakpoints cerrados», HOS-2469) ===\n');
    const strictFiles = new Set(result.strictHits);
    for (const hit of hits.filter((h) => strictFiles.has(h.file))) {
        console.error(`  STRICT ZONE  ${hit.file}:${hit.line} [${hit.rule}]  ${hit.snippet}`);
    }
    for (const file of result.strictEntries) {
        console.error(`  REFUSED ENTRY  ${file}: the strict zone takes no exceptions`);
    }
    const raisedFiles = new Set(result.raised.map((r) => r.split(' › ')[0]));
    for (const line of result.raised) console.error(`  NEW  ${line}`);
    for (const hit of hits.filter((h) => raisedFiles.has(h.file) && !strictFiles.has(h.file))) {
        console.error(`       ${hit.file}:${hit.line} [${hit.rule}]  ${hit.snippet}`);
    }
    for (const line of result.stale) console.error(`  STALE  ${line} — lower or remove the entry`);
    if (result.ceilingBreach) console.error(`  LIST GREW  ${result.ceilingBreach}`);
    console.error(
        '\nUse only (min-width: 30rem|48rem|64rem|80rem) or (width >= …) in @media;' +
            ' the max-width complement (63.99rem) only in matchMedia / client:media;' +
            ' rem lengths in @container. The exceptions list only shrinks (OD-9).'
    );
    return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(run());
}
