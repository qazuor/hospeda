/**
 * @file check-reason-is-copy.ts
 * @description GUARD:G9 (HOS-1352 program, built by B1 / HOS-1508, AC:B1:5,
 * TEST:B1:5, INV:D9): the `reason` sent to the provider is copy for the
 * customer, never an internal identifier. The provider puts it in the subject
 * and the header of the emails it sends the customer (EX-19, DEC-MAIL-001).
 *
 * ## A declared heuristic
 *
 * Whether a value is "copy" is not decidable from source. This guard flags the
 * shapes an identifier takes, in the places an authorization is built, and
 * nothing else.
 *
 * ### Where it looks: an authorization being built
 *
 * In every production code file under `apps/` and `packages/`
 * (`.ts .tsx .mts .cts .js .jsx .mjs .cjs .astro`, tests excluded, comments
 * ignored), the `reason:` properties (bare or quoted key, any depth) inside:
 *
 * 1. the parentheses of an `authorize(…)` call (`provider.authorize({ … })`,
 *    `authorize?.(…)`);
 * 2. the object literal declared in the same file as `const|let|var X = { … }`
 *    when the call passes a bare identifier (`provider.authorize(X)`);
 * 3. an object literal typed as an authorization: `: AuthorizeInput = { … }`,
 *    `{ … } satisfies AuthorizeInput`, `{ … } as AuthorizeInput`.
 *
 * ### What it flags: an identifier-shaped value
 *
 * The value (split on top-level `+ ?? || && ? :`, and unwrapped from
 * parentheses, `String(…)`, `.toString()`, `!`, `as …`) has an operand that is:
 *
 * - a reference whose last name is `id`, `uuid`, `slug` or `reference`, or ends
 *   in `Id`, `ID`, `Uuid`, `UUID`, `Slug`, `Reference` or `_id`, `_uuid`,
 *   `_slug`, `_reference` (`subscription.id`, `subscriptionId`, `plan.slug`,
 *   `input.reference`, `row['plan_id']`);
 * - a string literal shaped like a UUID, a slug (`lowercase-words` or
 *   `snake_case`, at least two parts) or a number;
 * - a template literal with such a reference or literal in a `${…}`.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - An identifier under any other name (`const label = sub.id; reason: label`),
 *   or returned by a call (`reason: describe(sub)`, `reason: t('…', { id })`).
 * - A `reason` set outside the three shapes above (an object built elsewhere
 *   and passed through, a property assigned after the literal, a spread).
 * - A shorthand `{ reason }`: the guard does not follow the variable.
 * - Copy that is wrong for the customer but is not identifier-shaped.
 *
 * ## Scope and positive control
 *
 * The files git sees in the tree. A scan of fewer than `MIN_SCANNED_FILES` files
 * is a moved root or a wrong cwd, not a clean tree. `run({ root, minScannedFiles })`
 * takes any tree; `scripts/__tests__/check-reason-is-copy.test.ts` runs it over
 * throwaway git trees that send an identifier as the reason.
 *
 * Exit codes: 0 = clean; 1 = a violation, or a scan too small to trust.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    lineOf,
    listProductionFiles,
    maskSource,
    matchingClose,
    matchingOpen
} from './payments-guard-scan.js';

/** Fewer files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 1000;

/** One offending occurrence. */
export interface Violation {
    readonly rule: 'G9';
    readonly file: string;
    readonly line: number;
    readonly detail: string;
}

/** What the predicate means. */
export const RULE_MESSAGE =
    'GUARD:G9: an authorization being built (an authorize(…) argument, or an object typed AuthorizeInput) ' +
    'sets `reason` to an identifier-shaped value (a name ending in id/slug/uuid/reference, or a UUID-, ' +
    'slug- or number-shaped literal). The reason is customer-facing copy, never an internal identifier ' +
    '(INV:D9, EX-19).';

/** A camelCase identifier suffix; case-sensitive, so `paid` or `void` is not `…Id`. */
const ID_SUFFIX_CASED = /(?:Id|ID|Uuid|UUID|Slug|Reference)$/;
/** An identifier name on its own, or a snake_case suffix. */
const ID_EXACT_OR_SNAKE = /^(?:id|uuid|slug|reference)$|_(?:id|uuid|slug|reference)$/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/;
const NUMBER = /^\d+$/;

const REFERENCE_CHAIN =
    /^[A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*|\s*(?:\?\.\s*)?\[[^[\]]*\])*$/;

/** Whether a name reads as an identifier (case of the suffix matters: `paid` is not `…Id`). */
function isIdName({ name }: { readonly name: string }): boolean {
    return ID_EXACT_OR_SNAKE.test(name) || ID_SUFFIX_CASED.test(name);
}

/** Why a literal's content is identifier-shaped, or null. */
function literalShape({ value }: { readonly value: string }): string | null {
    if (UUID.test(value)) return 'a UUID-shaped literal';
    if (SLUG.test(value)) return 'a slug-shaped literal';
    if (NUMBER.test(value)) return 'a number-shaped literal';
    return null;
}

/** Top-level operand spans of an expression (over masked code). */
function operands({ code }: { readonly code: string }): readonly (readonly [number, number])[] {
    const spans: [number, number][] = [];
    let depth = 0;
    let from = 0;
    for (let k = 0; k < code.length; k += 1) {
        const c = code[k] as string;
        const next = code[k + 1];
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') depth -= 1;
        if (depth !== 0) continue;
        let width = 0;
        if (
            (c === '?' && next === '?') ||
            (c === '|' && next === '|') ||
            (c === '&' && next === '&')
        )
            width = 2;
        else if (c === '+' && next !== '+' && next !== '=' && code[k - 1] !== '+') width = 1;
        else if (c === '?' && next !== '.') width = 1;
        else if (c === ':') width = 1;
        if (width === 0) continue;
        spans.push([from, k]);
        from = k + width;
        k += width - 1;
    }
    spans.push([from, code.length]);
    return spans;
}

/**
 * Why an expression is identifier-shaped, or null.
 *
 * @param args.text - The expression as written
 * @param args.code - The same span, masked (same length)
 */
export function identifierShape(args: {
    readonly text: string;
    readonly code: string;
}): string | null {
    const start = args.code.search(/\S/);
    if (start === -1) return null;
    const end = args.code.length - (args.code.length - args.code.trimEnd().length);
    const text = args.text.slice(start, end);
    const code = args.code.slice(start, end);
    const recurse = (from: number, to: number) =>
        identifierShape({ text: text.slice(from, to), code: code.slice(from, to) });

    const parts = operands({ code });
    if (parts.length > 1) {
        for (const [from, to] of parts) {
            const shape = recurse(from, to);
            if (shape) return shape;
        }
        return null;
    }
    if (code.startsWith('(') && matchingClose({ code, open: 0 }) === code.length - 1)
        return recurse(1, code.length - 1);
    const call = /^String\s*\(/.exec(code);
    if (call && matchingClose({ code, open: call[0].length - 1 }) === code.length - 1)
        return recurse(call[0].length, code.length - 1);
    const toStringCall = /\.\s*toString\s*\(\s*\)$/.exec(code);
    if (toStringCall) return recurse(0, toStringCall.index);
    if (code.endsWith('!')) return recurse(0, code.length - 1);
    const cast = /\s(?:as|satisfies)\s[\w$.<>[\]\s|]+$/.exec(code);
    if (cast) return recurse(0, cast.index);

    const quote = code[0];
    if ((quote === "'" || quote === '"') && code.endsWith(quote) && code.length >= 2)
        return literalShape({ value: text.slice(1, -1) });
    if (quote === '`' && code.endsWith('`') && code.length >= 2) {
        const interpolations = [...code.matchAll(/\$\{/g)];
        if (interpolations.length === 0) return literalShape({ value: text.slice(1, -1) });
        for (const match of interpolations) {
            const close = matchingClose({ code, open: match.index + 1 });
            const shape = recurse(match.index + 2, close === -1 ? code.length - 1 : close);
            if (shape) return shape;
        }
        return null;
    }
    if (REFERENCE_CHAIN.test(code)) {
        const bracket = /\[([^\]]*)\]$/.exec(text);
        const last = bracket
            ? (bracket[1] ?? '').trim().replace(/^['"`]|['"`]$/g, '')
            : (/[A-Za-z_$][\w$]*$/.exec(code)?.[0] ?? '');
        return isIdName({ name: last }) ? `'${text}' (an identifier-shaped name)` : null;
    }
    return null;
}

/** The `[open, close]` offsets of every object an authorization is built from. */
function authorizationRanges({
    code
}: {
    readonly code: string;
}): readonly (readonly [number, number])[] {
    const ranges: [number, number][] = [];
    const objectAt = (open: number) => {
        const close = matchingClose({ code, open });
        if (close !== -1) ranges.push([open, close]);
    };
    for (const call of code.matchAll(/\bauthorize\s*(?:\?\.)?\s*\(/g)) {
        const open = call.index + call[0].length - 1;
        const close = matchingClose({ code, open });
        if (close === -1) continue;
        const argument = code.slice(open + 1, close).trim();
        if (/^[A-Za-z_$][\w$]*$/.test(argument)) {
            const declaration = new RegExp(
                `\\b(?:const|let|var)\\s+${argument.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?::[^=]+)?=\\s*\\{`,
                'g'
            );
            for (const match of code.matchAll(declaration))
                objectAt(match.index + match[0].length - 1);
        } else {
            ranges.push([open, close]);
        }
    }
    for (const typed of code.matchAll(/:\s*AuthorizeInput\s*=\s*\{/g)) {
        objectAt(typed.index + typed[0].length - 1);
    }
    for (const cast of code.matchAll(/\}\s*(?:satisfies|as)\s+AuthorizeInput\b/g)) {
        const open = matchingOpen({ code, close: cast.index });
        if (open !== -1) ranges.push([open, cast.index]);
    }
    return ranges;
}

/** The end of the property value starting at `from`: the next top-level `,` or the range's close. */
function valueEnd({
    code,
    from,
    limit
}: {
    readonly code: string;
    readonly from: number;
    readonly limit: number;
}): number {
    let depth = 0;
    for (let k = from; k < limit; k += 1) {
        const c = code[k];
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') {
            if (depth === 0) return k;
            depth -= 1;
        } else if (c === ',' && depth === 0) return k;
    }
    return limit;
}

/**
 * The predicate over one file.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The file text
 * @returns One violation per identifier-shaped `reason`
 */
export function findIdentifierReasons(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    const { code, strings } = maskSource({ source: args.source });
    const keys = [
        ...[...code.matchAll(/(?<![\w$.])reason\s*:/g)].map((match) => ({
            key: match.index,
            colon: match.index + match[0].length
        })),
        ...strings
            .filter((literal) => literal.value === 'reason')
            .flatMap((literal) => {
                const colon = /^\s*:/.exec(code.slice(literal.end));
                return colon ? [{ key: literal.start, colon: literal.end + colon[0].length }] : [];
            })
    ];
    const seen = new Set<number>();
    const violations: Violation[] = [];
    for (const [open, close] of authorizationRanges({ code })) {
        for (const { key, colon } of keys) {
            if (key <= open || key >= close || seen.has(key)) continue;
            const end = valueEnd({ code, from: colon, limit: close });
            const shape = identifierShape({
                text: args.source.slice(colon, end),
                code: code.slice(colon, end)
            });
            if (!shape) continue;
            seen.add(key);
            violations.push({
                rule: 'G9',
                file: args.file,
                line: lineOf({ source: args.source, offset: key }),
                detail: `reason is ${shape}`
            });
        }
    }
    return violations.sort((a, b) => a.line - b.line);
}

/**
 * Runs GUARD:G9.
 *
 * @param args.root - Repository root; defaults to this repo
 * @param args.minScannedFiles - Scan floor; defaults to {@link MIN_SCANNED_FILES}
 * @returns The exit code and the report
 */
export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const lines = ['=== GUARD:G9 - the reason sent to the provider is copy, not an identifier ==='];
    const files = listProductionFiles({ root, excludePrefixes: [] });
    if (files.length < minScannedFiles) {
        lines.push(
            `ERROR: only ${files.length} file(s) scanned under ${root}, expected at least ` +
                `${minScannedFiles}. The cwd is wrong or the scan is broken; this is not a clean tree.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    const violations = files.flatMap((file) =>
        findIdentifierReasons({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    if (violations.length > 0) {
        lines.push('', `FAIL ${RULE_MESSAGE}`);
        for (const v of violations) lines.push(`  ${v.file}:${v.line}  ${v.detail}`);
        return { exitCode: 1, output: lines.join('\n') };
    }
    lines.push(
        `OK: ${files.length} production file(s) scanned; no authorization being built sets an ` +
            'identifier-shaped reason.'
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
