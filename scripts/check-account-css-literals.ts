#!/usr/bin/env tsx
/**
 * check-account-css-literals.ts — HOS-2470 (HOS-2413 T-009)
 *
 * No literal font size, radius, shadow or color in Mi Cuenta CSS: the account
 * styles go through `@repo/design-tokens`.
 *
 * ---------------------------------------------------------------------------
 * THE RULE (spec §6.7), one category per row
 * ---------------------------------------------------------------------------
 *
 *   font-size  `font-size` other than `var(--token)`, `inherit`, `initial`,
 *              `unset`, `0`, `1em` or `100%`; and a `font` shorthand that
 *              carries a literal size (any number) or a size keyword.
 *   radius     `border-radius` and its longhands (`border-top-left-radius`,
 *              `border-start-end-radius`, …) other than `var(--token)`, `0`,
 *              `50%`, `inherit`.
 *   shadow     `box-shadow` other than `var(--token)`, `none`, `inherit`.
 *   color      any color literal in any declaration: `#hex`, `rgb[a]()`,
 *              `hsl[a]()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`
 *              (relative syntax included) and `color()`. Named colors count
 *              too (except `transparent` / `currentColor`), on color-bearing
 *              properties and on custom properties. Defining a component-local
 *              custom property with a literal color is a violation.
 *
 * A literal `var()` FALLBACK counts as a literal: `var(--x, 16px)` in a
 * `font-size` is a font-size hit, `var(--x, #fff)` is a color hit. Hits are
 * counted once per declaration and category.
 *
 * Scope and zones come from `scripts/lib/account-css-scope.ts`: zero hits in
 * the strict zone, and a FROZEN exceptions list for the legacy zone (OD-9),
 * count-pinned per file and per category in
 * `scripts/guards/account-css-literals-exceptions.json`. The list behaves like
 * the breakpoint guard's: new or raised counts fail, stale counts fail, an
 * entry under the strict zone fails, and the list may never exceed
 * `EXCEPTIONS_CEILING` (lower it when you shrink the list). `--print-baseline`
 * prints the current legacy-zone counts and exits 0.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD DOES NOT SEE — read before trusting its green
 * ---------------------------------------------------------------------------
 *
 *   - Computed styles and values built at runtime: a `style={{ color }}` from a
 *     variable, a `${…}` template, `element.style.setProperty(...)`, a class
 *     name chosen in JS.
 *   - CSS-in-JS assembled from variables, and CSS inside plain `.ts` strings.
 *   - Named colors on properties outside the color-bearing list (for example a
 *     grid area that happens to be called `red`) and colors inside `url(...)`.
 *   - Literals in `outline`, `border`, `gap`, `padding` and other lengths:
 *     only font size, radius and shadow lengths are in this rule.
 *   - Files outside the scope: see `scripts/lib/account-css-scope.ts`.
 *
 * @module scripts/check-account-css-literals
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    cleanSource,
    compareWithExceptions,
    findCssRegions,
    findDeclarations,
    findStyleObjects,
    isInStrictZone,
    lineAt,
    listAccountScopeFiles,
    type RuleCounts
} from './lib/account-css-scope.js';

/** Repo-relative path of the frozen exceptions list. */
export const EXCEPTIONS_PATH = 'scripts/guards/account-css-literals-exceptions.json';

/** Frozen maximum size of the exceptions list (entries = file × category pairs). */
export const EXCEPTIONS_CEILING = { entries: 258, total: 1088 } as const;

/** A scan below this many files means the scope moved or the cwd is wrong. */
export const MIN_SCANNED_FILES = 300;

/** The four literal categories. */
export type LiteralCategory = 'font-size' | 'radius' | 'shadow' | 'color';

/** One literal hit. */
export interface LiteralHit {
    readonly file: string;
    readonly line: number;
    readonly category: LiteralCategory;
    readonly snippet: string;
}

/** CSS named colors (CSS Color 4), minus `transparent` and `currentcolor`. */
const NAMED_COLORS = new Set(
    (
        'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
        'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
        'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
        'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
        'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
        'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
        'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
        'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
        'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
        'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
        'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
        'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
        'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
        'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
        'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
        'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
        'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
    ).split(' ')
);

/** Properties where a bare word can be a color. */
const COLOR_BEARING =
    /^(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(?:-color)?|column-rule(?:-color)?|stop-color|flood-color|lighting-color|scrollbar-color)$/;

const RADIUS_PROPERTY =
    /^border(?:-(?:top|bottom)-(?:left|right)|-(?:start|end)-(?:start|end))?-radius$/;

const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const SIZE_KEYWORD =
    /\b(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)\b/;

/**
 * Rewrites `var(--name)` to a space and `var(--name, fallback)` to its
 * fallback, innermost first, so a literal fallback stays visible.
 */
export function unwrapVars({ value }: { readonly value: string }): string {
    let out = value;
    for (let i = 0; i < 10 && /var\(/.test(out); i++) {
        out = out.replace(
            /var\(\s*--[\w-]+\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g,
            (_m, fb?: string) => (fb === undefined ? ' ' : ` ${fb} `)
        );
    }
    return out;
}

/** Drops quoted strings and `url(...)` bodies, which hold no CSS color. */
function dropStringsAndUrls(value: string): string {
    return value.replace(/(['"])[^'"]*\1/g, ' ').replace(/url\([^)]*\)/gi, ' ');
}

/** Removes allowed keywords; whatever is left decides. */
function leftover(value: string, allowed: readonly string[]): string {
    let out = ` ${value} `;
    for (const word of allowed) {
        out = out.replace(
            new RegExp(
                `(?<![\\w.-])${word.replace(/[\\^$.*+?()[\]{}|%-]/g, '\\$&')}(?![\\w.%-])`,
                'gi'
            ),
            ' '
        );
    }
    return out.trim();
}

/**
 * Classifies one declaration.
 *
 * @param input.property - Property name.
 * @param input.value - Value text.
 * @returns The categories it breaks (each at most once).
 */
export function classifyDeclaration({
    property,
    value
}: {
    readonly property: string;
    readonly value: string;
}): LiteralCategory[] {
    const out: LiteralCategory[] = [];
    const resolved = dropStringsAndUrls(unwrapVars({ value }));
    const prop = property.startsWith('--') ? property : property.toLowerCase();

    if (prop === 'font-size') {
        const rest = leftover(resolved, [
            'inherit',
            'initial',
            'unset',
            'revert',
            '0',
            '1em',
            '100%'
        ]);
        if (/\d/.test(rest) || SIZE_KEYWORD.test(rest)) out.push('font-size');
    } else if (prop === 'font') {
        const rest = leftover(resolved, ['inherit', 'initial', 'unset', 'revert']);
        if (/\d/.test(rest) || SIZE_KEYWORD.test(rest)) out.push('font-size');
    } else if (RADIUS_PROPERTY.test(prop)) {
        const rest = leftover(resolved, ['inherit', 'initial', 'unset', 'revert', '0', '50%']);
        if (/\d/.test(rest)) out.push('radius');
    } else if (prop === 'box-shadow') {
        const rest = leftover(resolved, ['none', 'inherit', 'initial', 'unset', 'revert']);
        if (rest.replace(/[\s,]/g, '') !== '') out.push('shadow');
    }

    let color = COLOR_FUNCTION.test(resolved) || HEX_COLOR.test(resolved);
    if (!color && (prop.startsWith('--') || COLOR_BEARING.test(prop))) {
        color = (resolved.toLowerCase().match(/[a-z]+/g) ?? []).some((word) =>
            NAMED_COLORS.has(word)
        );
    }
    if (color) out.push('color');
    return out;
}

/**
 * Finds every literal hit in one file.
 *
 * @param input.file - Repo-relative path (decides the file type).
 * @param input.source - Raw file content.
 * @returns The hits, in file order.
 */
export function findLiteralHits({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): LiteralHit[] {
    const clean = cleanSource({ source, file });
    const hits: LiteralHit[] = [];
    const record = (property: string, value: string, offset: number) => {
        for (const category of classifyDeclaration({ property, value })) {
            hits.push({
                file,
                line: lineAt({ source, offset }),
                category,
                snippet: `${property}: ${value}`.replace(/\s+/g, ' ').slice(0, 160)
            });
        }
    };
    for (const region of findCssRegions({ source: clean, file })) {
        for (const decl of findDeclarations({ region }))
            record(decl.property, decl.value, decl.offset);
    }
    if (!file.endsWith('.css')) {
        for (const entry of findStyleObjects({ source: clean })) {
            record(entry.property, entry.value, entry.offset);
        }
    }
    return hits.sort((a, b) => a.line - b.line);
}

/** Groups hits into per-file, per-category counts. */
export function countHits({ hits }: { readonly hits: readonly LiteralHit[] }): RuleCounts {
    const counts: Record<string, Record<string, number>> = {};
    for (const hit of hits) {
        const rules = counts[hit.file] ?? {};
        rules[hit.category] = (rules[hit.category] ?? 0) + 1;
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
export function scanAccountLiterals({ root = process.cwd() }: { readonly root?: string } = {}): {
    readonly hits: readonly LiteralHit[];
    readonly scannedFiles: number;
} {
    const files = listAccountScopeFiles({ root });
    const hits = files.flatMap((file) =>
        findLiteralHits({ file, source: readFileSync(join(root, file), 'utf8') })
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
    const { hits, scannedFiles } = scanAccountLiterals();
    const observed = countHits({ hits });
    if (argv.includes('--print-baseline')) {
        console.log(JSON.stringify(legacyBaseline({ counts: observed }), null, 4));
        return 0;
    }
    if (scannedFiles < MIN_SCANNED_FILES) {
        console.error(
            `check-account-css-literals: only ${scannedFiles} file(s) in the account scope, expected at least ${MIN_SCANNED_FILES}. The scope moved or the cwd is wrong. This is not a clean tree.`
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
            `check-account-css-literals: OK, ${scannedFiles} account file(s) scanned; legacy exceptions match ${EXCEPTIONS_PATH} exactly.`
        );
        return 0;
    }
    console.error('=== Account CSS literals (HOS-2470) ===\n');
    const strictFiles = new Set(result.strictHits);
    for (const hit of hits.filter((h) => strictFiles.has(h.file))) {
        console.error(`  STRICT ZONE  ${hit.file}:${hit.line} [${hit.category}]  ${hit.snippet}`);
    }
    for (const file of result.strictEntries) {
        console.error(`  REFUSED ENTRY  ${file}: the strict zone takes no exceptions`);
    }
    const raisedFiles = new Set(result.raised.map((r) => r.split(' › ')[0]));
    for (const line of result.raised) console.error(`  NEW  ${line}`);
    for (const hit of hits.filter((h) => raisedFiles.has(h.file) && !strictFiles.has(h.file))) {
        console.error(`       ${hit.file}:${hit.line} [${hit.category}]  ${hit.snippet}`);
    }
    for (const line of result.stale) console.error(`  STALE  ${line} — lower or remove the entry`);
    if (result.ceilingBreach) console.error(`  LIST GREW  ${result.ceilingBreach}`);
    console.error(
        '\nUse a design token: var(--app-*) for type, var(--radius-*) for radius, var(--shadow-*)' +
            ' for shadows, and a color token for every color. The exceptions list only shrinks (OD-9).'
    );
    return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(run());
}
