/**
 * @file payments-guard-scan.ts
 * @description What GUARD:G9, G10 and G11 (HOS-1352 program, B1 / HOS-1508)
 * share: which files they read, and a lexical view of a file that tells code
 * from comments and strings. Not a guard itself.
 *
 * ## The masked view
 *
 * `maskSource` returns the file with the same length and the same line breaks,
 * where comments are blanked, the CONTENT of every string literal is blanked
 * (its quotes stay), and the static text of a template literal is blanked while
 * its `${…}` expressions stay as code. So a regex over the masked text sees code
 * only, and an offset in it is an offset in the original. The string literals
 * are returned apart, with their offsets and contents.
 *
 * It is a lexer, not a parser: a regular expression literal that contains a
 * quote or a backtick (`/['"]/`) is read as the start of a string. A string
 * literal is closed at the end of its line at the latest, so the damage of that
 * misreading stays on one line.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Extensions read as code. */
export const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;

/** Test files: a test is not code that talks to the provider or to a customer. */
export const TEST_FILE =
    /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;

/** Where production code lives. */
export const SCAN_ROOT = /^(?:apps|packages)\//;

/** The payments package. */
export const PAYMENTS_DIR = 'packages/payments/';

/** The in-memory fake: the measured lies (M9, M10) are legitimate there. */
export const PAYMENTS_FAKE_DIR = 'packages/payments/src/fake/';

/** The provider adapters: the only code that speaks the provider's own fields. */
export const PAYMENTS_ADAPTERS_DIR = 'packages/payments/src/adapters/';

/** One string literal of a file: its content and the offset of its opening quote. */
export interface StringLiteral {
    readonly start: number;
    readonly end: number;
    readonly value: string;
}

/** A file seen lexically. */
export interface MaskedSource {
    /** Same length as the source: comments and string contents blanked. */
    readonly code: string;
    /** Every quoted string, and every template literal without `${…}`. */
    readonly strings: readonly StringLiteral[];
}

/**
 * Masks comments and string contents out of a source file.
 *
 * @param args.source - The file text
 * @returns The masked code and the string literals
 */
export function maskSource({ source }: { readonly source: string }): MaskedSource {
    const out = source.split('');
    const strings: StringLiteral[] = [];
    /** Open `${` expressions: brace depth inside each. */
    const templateDepth: number[] = [];
    const n = source.length;
    const blank = (from: number, to: number) => {
        for (let k = from; k < to && k < n; k += 1) if (out[k] !== '\n') out[k] = ' ';
    };
    /** Reads template text from `j`; returns where code resumes. */
    const readTemplate = (j: number, opening: number | null): number => {
        let k = j;
        while (k < n) {
            const c = source[k];
            if (c === '\\') {
                k += 2;
                continue;
            }
            if (c === '`') {
                blank(j, k);
                if (opening !== null)
                    strings.push({ start: opening, end: k + 1, value: source.slice(j, k) });
                return k + 1;
            }
            if (c === '$' && source[k + 1] === '{') {
                blank(j, k);
                templateDepth.push(0);
                return k + 2;
            }
            k += 1;
        }
        blank(j, n);
        return n;
    };

    let i = 0;
    while (i < n) {
        const ch = source[i];
        const next = source[i + 1];
        if (ch === '/' && next === '/') {
            const end = source.indexOf('\n', i);
            const stop = end === -1 ? n : end;
            blank(i, stop);
            i = stop;
            continue;
        }
        if (ch === '/' && next === '*') {
            const end = source.indexOf('*/', i + 2);
            const stop = end === -1 ? n : end + 2;
            blank(i, stop);
            i = stop;
            continue;
        }
        if (ch === '"' || ch === "'") {
            let j = i + 1;
            while (j < n && source[j] !== ch && source[j] !== '\n') {
                j += source[j] === '\\' ? 2 : 1;
            }
            const close = Math.min(j, n);
            strings.push({ start: i, end: close + 1, value: source.slice(i + 1, close) });
            blank(i + 1, close);
            i = close + 1;
            continue;
        }
        if (ch === '`') {
            i = readTemplate(i + 1, i);
            continue;
        }
        const depth = templateDepth.length;
        if (depth > 0 && ch === '{') templateDepth[depth - 1] = (templateDepth[depth - 1] ?? 0) + 1;
        if (depth > 0 && ch === '}') {
            if ((templateDepth[depth - 1] ?? 0) === 0) {
                templateDepth.pop();
                i = readTemplate(i + 1, null);
                continue;
            }
            templateDepth[depth - 1] = (templateDepth[depth - 1] ?? 0) - 1;
        }
        i += 1;
    }
    return { code: out.join(''), strings };
}

/** The 1-based line of an offset. */
export function lineOf({
    source,
    offset
}: {
    readonly source: string;
    readonly offset: number;
}): number {
    let line = 1;
    for (let k = 0; k < offset && k < source.length; k += 1) if (source[k] === '\n') line += 1;
    return line;
}

const OPEN_TO_CLOSE: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };

/**
 * The offset of the bracket closing the one at `open`, over masked code (where
 * brackets inside strings and comments are gone). `-1` when unbalanced.
 */
export function matchingClose({
    code,
    open
}: {
    readonly code: string;
    readonly open: number;
}): number {
    const stack: string[] = [];
    for (let k = open; k < code.length; k += 1) {
        const c = code[k] as string;
        const closer = OPEN_TO_CLOSE[c];
        if (closer) stack.push(closer);
        else if (c === ')' || c === ']' || c === '}') {
            if (stack.pop() !== c) return -1;
            if (stack.length === 0) return k;
        }
    }
    return -1;
}

/**
 * The offset of the bracket opening the one closing at `close`, scanning
 * backwards over masked code. `-1` when unbalanced.
 */
export function matchingOpen({
    code,
    close
}: {
    readonly code: string;
    readonly close: number;
}): number {
    const CLOSE_TO_OPEN: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' };
    const stack: string[] = [];
    for (let k = close; k >= 0; k -= 1) {
        const c = code[k] as string;
        const opener = CLOSE_TO_OPEN[c];
        if (opener) stack.push(opener);
        else if (c === '(' || c === '[' || c === '{') {
            if (stack.pop() !== c) return -1;
            if (stack.length === 0) return k;
        }
    }
    return -1;
}

/** Lowercase, without `_` and `-`: `free_trial`, `freeTrial` and `FREE-TRIAL` read the same. */
export function normalizeName({ name }: { readonly name: string }): string {
    return name.toLowerCase().replace(/[_-]/g, '');
}

/**
 * The production code files a guard reads: under `apps/` or `packages/`, code
 * extensions, tests excluded, minus the given prefixes.
 *
 * @param args.root - Repository root
 * @param args.excludePrefixes - Repo-relative prefixes the guard does not read
 * @returns Repo-relative paths
 */
export function listProductionFiles({
    root,
    excludePrefixes
}: {
    readonly root: string;
    readonly excludePrefixes: readonly string[];
}): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024
    });
    return (
        out
            .split('\0')
            .filter(Boolean)
            .filter((file) => SCAN_ROOT.test(file) && CODE_FILE.test(file) && !TEST_FILE.test(file))
            .filter((file) => !/(^|\/)(node_modules|dist)\//.test(file))
            .filter((file) => !excludePrefixes.some((prefix) => file.startsWith(prefix)))
            // `-c` also lists a tracked file deleted from the working tree.
            .filter((file) => existsSync(join(root, file)))
    );
}
