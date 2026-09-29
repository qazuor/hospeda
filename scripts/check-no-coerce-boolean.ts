/**
 * @file check-no-coerce-boolean.ts
 * @description HOS-410 — fails CI when `z.coerce.boolean()` appears in
 * `apps/api/src` or `packages/schemas/src`.
 *
 * ## Why
 *
 * `z.coerce.boolean()` applies `Boolean(value)`, so EVERY non-empty string is
 * `true`, `'false'` included. In this codebase that meant `?dryRun=false` ran a
 * cron as a dry-run, and `?includeDeleted=false` / `?livemode=false` /
 * `?resolved=false` returned the OPPOSITE result set. About thirty shared
 * `HttpQueryFields` factories carried it to every list endpoint.
 *
 * The replacements live in `packages/schemas/src/common/boolean-params.ts`
 * (`createBooleanQueryParam`, `createBooleanQueryParamWithDefault`,
 * `httpBodyBoolean`).
 *
 * ## How it is anchored
 *
 * On the token sequence `z . coerce . boolean`, tolerant of whitespace and line
 * breaks between the tokens (a formatter reflowing `z\n  .coerce\n  .boolean()`
 * must not slip through), after COMMENTS are blanked out so prose that explains
 * the ban does not trip it. String and template literals are respected while
 * blanking, so a `//` inside a URL does not hide code after it.
 *
 * ## Allowlist
 *
 * Environment schemas are out of scope: an env var `"false"` is parsed by
 * dedicated code, not a query string. They are named explicitly below, never by
 * pattern, so adding one is a reviewed line in this file.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Directories scanned, relative to the repo root. */
export const SCAN_ROOTS = ['apps/api/src', 'packages/schemas/src'] as const;

/** Files that may use `z.coerce.boolean()` (environment schemas only). */
export const ALLOWLIST: readonly string[] = ['apps/api/src/utils/env-schema.ts'];

/** Fewer files than this means the scan roots moved: not a clean tree. */
export const MIN_SCANNED_FILES = 500;

const EXTENSIONS = ['.ts', '.tsx'];
const SKIPPED_DIRS = new Set(['dist', ['node', 'modules'].join('_')]);

const PATTERN = /\bz\s*\.\s*coerce\s*\.\s*boolean\b/g;

/** One offending occurrence. */
export interface Violation {
    readonly file: string;
    readonly line: number;
    readonly snippet: string;
}

/**
 * Replaces comments with spaces (newlines kept, so line numbers survive) while
 * honouring string and template literals.
 *
 * @param source - TypeScript source text
 * @returns The same text with every comment blanked out
 */
export function blankComments(source: string): string {
    let out = '';
    let i = 0;
    let quote: string | null = null;
    while (i < source.length) {
        const ch = source[i] as string;
        const next = source[i + 1];
        if (quote) {
            out += ch;
            if (ch === '\\' && next !== undefined) {
                out += next;
                i += 2;
                continue;
            }
            if (ch === quote) quote = null;
            i += 1;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            out += ch;
            i += 1;
            continue;
        }
        if (ch === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') {
                out += ' ';
                i += 1;
            }
            continue;
        }
        if (ch === '/' && next === '*') {
            const end = source.indexOf('*/', i + 2);
            const stop = end === -1 ? source.length : end + 2;
            for (; i < stop; i += 1) out += source[i] === '\n' ? '\n' : ' ';
            continue;
        }
        out += ch;
        i += 1;
    }
    return out;
}

/**
 * Finds `z.coerce.boolean` occurrences in one file's source.
 *
 * @param input.file - Path used in the report
 * @param input.source - File contents
 * @returns Every occurrence outside comments
 */
export function findCoerceBoolean(input: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    const code = blankComments(input.source);
    const lines = input.source.split('\n');
    const found: Violation[] = [];
    for (const match of code.matchAll(PATTERN)) {
        const line = code.slice(0, match.index).split('\n').length;
        found.push({ file: input.file, line, snippet: (lines[line - 1] ?? '').trim() });
    }
    return found;
}

function walk(dir: string, acc: string[]): void {
    for (const name of readdirSync(dir)) {
        if (SKIPPED_DIRS.has(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, acc);
        else if (EXTENSIONS.some((ext) => name.endsWith(ext))) acc.push(full);
    }
}

/**
 * Scans the configured roots.
 *
 * @param input.root - Repo root (defaults to cwd)
 * @param input.roots - Directories to scan, relative to `root`
 * @param input.allowlist - Repo-relative files exempt from the ban
 * @returns Violations and the number of files scanned
 */
export function scanRepo(
    input: {
        readonly root?: string;
        readonly roots?: readonly string[];
        readonly allowlist?: readonly string[];
    } = {}
): { readonly violations: readonly Violation[]; readonly scannedFiles: number } {
    const root = input.root ?? process.cwd();
    const allow = new Set(input.allowlist ?? ALLOWLIST);
    const files: string[] = [];
    for (const dir of input.roots ?? SCAN_ROOTS) {
        try {
            walk(join(root, dir), files);
        } catch {
            // A missing root shows up as a low scannedFiles count.
        }
    }
    const violations: Violation[] = [];
    for (const abs of files) {
        const rel = relative(root, abs);
        if (allow.has(rel)) continue;
        violations.push(...findCoerceBoolean({ file: rel, source: readFileSync(abs, 'utf8') }));
    }
    return { violations, scannedFiles: files.length };
}

/**
 * CLI entry.
 *
 * @returns Process exit code
 */
export function run(): number {
    const result = scanRepo();
    if (result.scannedFiles < MIN_SCANNED_FILES) {
        console.error(
            `check-no-coerce-boolean: only ${result.scannedFiles} file(s) scanned under ` +
                `${SCAN_ROOTS.join(', ')}, expected at least ${MIN_SCANNED_FILES}. The scan ` +
                'roots moved or the cwd is wrong. This is not a clean tree.'
        );
        return 1;
    }
    if (result.violations.length > 0) {
        console.error('=== z.coerce.boolean() found (HOS-410) ===\n');
        for (const v of result.violations) {
            console.error(`  ${v.file}:${v.line}\n      ${v.snippet}\n`);
        }
        console.error(
            "z.coerce.boolean() is Boolean(value): the string 'false' becomes true, so a filter\n" +
                'inverts its result set and a flag like dryRun runs the wrong mode.\n\n' +
                'Use, from @repo/schemas:\n' +
                "  createBooleanQueryParam('description')                    query, 'true'|'false' only\n" +
                "  createBooleanQueryParamWithDefault('description', true)   default only when absent\n" +
                '  httpBodyBoolean()                                         request bodies\n'
        );
        return 1;
    }
    console.log(
        `check-no-coerce-boolean: OK, ${result.scannedFiles} file(s) scanned, no z.coerce.boolean().`
    );
    return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(run());
}
