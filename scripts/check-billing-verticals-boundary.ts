/**
 * @file check-billing-verticals-boundary.ts
 * @description GUARD:G14 (HOS-1352 program, built by V1 / HOS-1432, AC:V1:7,
 * TEST:V1:11): one half of the program (billing, verticals) does not import
 * the other outside the contract package `@repo/billing-verticals-contract`.
 *
 * ## The halves are a table, here
 *
 * {@link HALVES} lists the folders of each half, repo-relative. Today:
 * - billing: `packages/payments`;
 * - verticals: `packages/verticals` (`@repo/verticals`), registered by V2.1
 *   (HOS-1434), the first leaf that brought verticals code. Were the half ever
 *   empty again, the guard says so in its output on every run.
 *
 * {@link EXEMPT_PATHS} are never part of a half, whatever folder a half
 * declares: the contract package (importing it is never crossing), the shared
 * test package of the adjustable clock `packages/test-clock` (it belongs to
 * neither half), and the composition root of `apps/api` (`src/app.ts`), the
 * one place that joins the two halves.
 *
 * ## The predicate (what a red proves, and nothing more)
 *
 * A code file of one half (`.ts .tsx .mts .cts .js .jsx .mjs .cjs`, tests
 * included) fails when an import-creating statement (`import`, `export … from`,
 * `import()`, `require()`, `vi.mock()`) names the OTHER half:
 * - by package name: the specifier is, or starts with `<name>/`, the `name` of
 *   a `package.json` at the root of one of that half's folders;
 * - by relative path: the specifier starts with `.` and resolves into one of
 *   that half's folders.
 * And the `package.json` at the root of a half's folder fails when one of its
 * four dependency blocks declares a package of the other half.
 * The red names the file (and line) and the half imported.
 *
 * The statement may span lines: the keyword, the parenthesis and the specifier
 * can each sit on their own line (`import(\n'x'\n)`, `vi.mock(\n'x',`,
 * `from\n'x'`), and the red reports the specifier's line. Comments are blanked
 * out first, so a specifier in prose is not an import.
 *
 * NOT seen, on purpose (contract §4.2): one half reading the other's TABLES
 * through `@repo/db`, which no import reveals; a specifier that is not a
 * string literal (built at runtime, or a variable); a comment BETWEEN the
 * keyword and the specifier (`import(/* x *\/ 'y')`); a template literal with
 * `${}` holding a backtick; the admin app, which joins neither half (it reads
 * both through the API).
 *
 * ## Fails loud
 *
 * An empty billing half, a declared folder that holds no file, or fewer than
 * {@link MIN_SCANNED_FILES} code files in the halves is a moved package or a
 * wrong cwd, never a clean tree.
 *
 * ## Positive control
 *
 * `run({ root, roots, minScannedFiles })` takes any tree and any halves:
 * `scripts/__tests__/check-billing-verticals-boundary.test.ts` breaks it on
 * purpose over throwaway git trees and sees it red.
 *
 * Exit codes: 0 = clean; 1 = a crossing import, or a guard that cannot be enforced.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, join, posix, resolve } from 'node:path';

/** A half of the program. */
export type Half = 'billing' | 'verticals';

/** The folders of each half, repo-relative. */
export type HalfRoots = Readonly<Record<Half, readonly string[]>>;

/** The halves, as of today. A new verticals folder is registered here. */
export const HALVES: HalfRoots = {
    billing: ['packages/payments'],
    verticals: ['packages/verticals']
};

/** Never part of a half: the contract, the shared clock test package, the composition root. */
export const EXEMPT_PATHS = [
    'packages/billing-verticals-contract',
    'packages/test-clock',
    'apps/api/src/app.ts'
] as const;

/** Fewer code files than this in the halves means the scan is broken. */
export const MIN_SCANNED_FILES = 15;

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

const DEPENDENCY_BLOCKS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
] as const;

/**
 * A module specifier in an import-creating form. Matched over the whole
 * (comment-free) source: the whitespace between the keyword, the parenthesis
 * and the specifier may include newlines.
 */
const IMPORT_SPECIFIER =
    /(?:\bfrom|\bimport|\brequire|\bvi\.(?:mock|doMock|importActual))\s*\(?\s*(['"`])([^'"`]+)\1/g;

/** One crossing found. */
export interface Violation {
    readonly file: string;
    readonly line?: number;
    readonly importedHalf: Half;
    readonly detail: string;
}

const otherHalf = (half: Half): Half => (half === 'billing' ? 'verticals' : 'billing');

const isUnder = ({ path, folder }: { readonly path: string; readonly folder: string }): boolean =>
    path === folder || path.startsWith(`${folder}/`);

/** The half a repo-relative path belongs to, or `null` (exempt, or in neither). */
export function halfOf(args: { readonly path: string; readonly roots: HalfRoots }): Half | null {
    if (EXEMPT_PATHS.some((folder) => isUnder({ path: args.path, folder }))) return null;
    for (const half of ['billing', 'verticals'] as const) {
        if (args.roots[half].some((folder) => isUnder({ path: args.path, folder }))) return half;
    }
    return null;
}

/**
 * The source with every comment blanked out (each comment character becomes a
 * space, newlines kept), so a specifier in prose is not an import and offsets
 * still map to the same lines. A `'` or `"` string ends at its line's end even
 * when unclosed (they cannot span lines), so a stray quote, e.g. inside a
 * regex literal, cannot swallow the rest of the file.
 */
export function withoutComments(source: string): string {
    let out = '';
    let state: 'code' | 'line' | 'block' | "'" | '"' | '`' = 'code';
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i] as string;
        const next = source[i + 1];
        if (state === 'line') {
            if (ch === '\n') {
                state = 'code';
                out += ch;
            } else out += ' ';
        } else if (state === 'block') {
            if (ch === '*' && next === '/') {
                state = 'code';
                out += '  ';
                i += 1;
            } else out += ch === '\n' ? ch : ' ';
        } else if (state === 'code') {
            if (ch === '/' && next === '/') {
                state = 'line';
                out += '  ';
                i += 1;
            } else if (ch === '/' && next === '*') {
                state = 'block';
                out += '  ';
                i += 1;
            } else {
                if (ch === "'" || ch === '"' || ch === '`') state = ch;
                out += ch;
            }
        } else {
            out += ch;
            if (ch === '\\' && i + 1 < source.length) {
                out += source[i + 1];
                i += 1;
            } else if (ch === state || (ch === '\n' && state !== '`')) {
                state = 'code';
            }
        }
    }
    return out;
}

/** The files git sees under `root`. */
function listFiles({ root }: { readonly root: string }): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024
    });
    return out
        .split('\0')
        .filter((file) => file !== '' && !/(^|\/)(node_modules|dist)\//.test(file));
}

/** The package names declared at the root of each half's folders. */
function packageNamesOf(args: {
    readonly root: string;
    readonly files: ReadonlySet<string>;
    readonly roots: HalfRoots;
}): Readonly<Record<Half, readonly string[]>> {
    const namesOf = (half: Half) =>
        args.roots[half].flatMap((folder) => {
            const manifest = `${folder}/package.json`;
            if (!args.files.has(manifest)) return [];
            const parsed: unknown = JSON.parse(readFileSync(join(args.root, manifest), 'utf8'));
            const name = (parsed as { name?: unknown }).name;
            return typeof name === 'string' && name !== '' ? [name] : [];
        });
    return { billing: namesOf('billing'), verticals: namesOf('verticals') };
}

/**
 * The crossings of one code file of a half.
 *
 * @returns One violation per import naming the other half
 */
export function findCrossingImports(args: {
    readonly file: string;
    readonly source: string;
    readonly half: Half;
    readonly roots: HalfRoots;
    readonly packageNames: Readonly<Record<Half, readonly string[]>>;
}): readonly Violation[] {
    const target = otherHalf(args.half);
    const fileDir = posix.dirname(args.file);
    const code = withoutComments(args.source);
    // Over the whole source, not line by line: `\s*` spans newlines, so
    // `import(\n'x'\n)` and `vi.mock(\n'x',` (how Biome wraps a long call)
    // are seen. The reported line is the specifier's.
    return [...code.matchAll(IMPORT_SPECIFIER)].flatMap((match) => {
        const specifier = match[2] ?? '';
        const byName = args.packageNames[target].some(
            (name) => specifier === name || specifier.startsWith(`${name}/`)
        );
        const resolved = specifier.startsWith('.') ? posix.join(fileDir, specifier) : null;
        const byPath =
            resolved !== null && halfOf({ path: resolved, roots: args.roots }) === target;
        if (!byName && !byPath) return [];
        const specifierAt = (match.index ?? 0) + match[0].lastIndexOf(specifier);
        return [
            {
                file: args.file,
                line: code.slice(0, specifierAt).split('\n').length,
                importedHalf: target,
                detail: `imports '${specifier}'`
            }
        ];
    });
}

/**
 * The crossings of a half's root manifest: a dependency on the other half.
 *
 * @returns One violation per declaring entry
 */
export function findCrossingDependencies(args: {
    readonly file: string;
    readonly source: string;
    readonly half: Half;
    readonly packageNames: Readonly<Record<Half, readonly string[]>>;
}): readonly Violation[] {
    const target = otherHalf(args.half);
    const manifest = JSON.parse(args.source) as Record<string, unknown>;
    return DEPENDENCY_BLOCKS.flatMap((block) =>
        Object.keys((manifest[block] ?? {}) as Record<string, unknown>)
            .filter((name) => args.packageNames[target].includes(name))
            .map((name) => ({
                file: args.file,
                importedHalf: target,
                detail: `${block} declares ${name}`
            }))
    );
}

/**
 * Runs the guard and renders its report.
 *
 * @param args.root - Repo root (defaults to the cwd)
 * @param args.roots - The halves (defaults to {@link HALVES})
 * @param args.minScannedFiles - Floor of code files in the halves (defaults to {@link MIN_SCANNED_FILES})
 * @returns The exit code and the report text
 */
export function run(
    args: {
        readonly root?: string;
        readonly roots?: HalfRoots;
        readonly minScannedFiles?: number;
    } = {}
): { readonly exitCode: 0 | 1; readonly output: string } {
    const root = resolve(args.root ?? process.cwd());
    const roots = args.roots ?? HALVES;
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const lines = ['=== GUARD:G14 — one half does not import the other outside the contract ==='];
    const fail = (message: string) => {
        lines.push(`ERROR: ${message}`);
        return { exitCode: 1 as const, output: lines.join('\n') };
    };

    if (roots.billing.length === 0) {
        return fail(
            'the billing half declares no folder (HALVES.billing is empty); G14 cannot be enforced.'
        );
    }
    const files = listFiles({ root });
    const fileSet = new Set(files);
    for (const half of ['billing', 'verticals'] as const) {
        for (const folder of roots[half]) {
            if (isAbsolute(folder) || !files.some((file) => isUnder({ path: file, folder }))) {
                return fail(
                    `the ${half} half declares '${folder}', which holds no file under ${root}. ` +
                        'Fix HALVES or the cwd; a missing half is not a clean tree.'
                );
            }
        }
    }

    const packageNames = packageNamesOf({ root, files: fileSet, roots });
    const violations: Violation[] = [];
    let scanned = 0;
    for (const file of files) {
        const half = halfOf({ path: file, roots });
        if (half === null) continue;
        if (roots[half].some((folder) => file === `${folder}/package.json`)) {
            violations.push(
                ...findCrossingDependencies({
                    file,
                    source: readFileSync(join(root, file), 'utf8'),
                    half,
                    packageNames
                })
            );
            continue;
        }
        if (!CODE_FILE.test(file)) continue;
        scanned += 1;
        violations.push(
            ...findCrossingImports({
                file,
                source: readFileSync(join(root, file), 'utf8'),
                half,
                roots,
                packageNames
            })
        );
    }

    if (scanned < minScannedFiles) {
        return fail(
            `only ${scanned} code file(s) in the halves under ${root}, expected at least ${minScannedFiles}. ` +
                'The cwd is wrong or a half moved; this is not a clean tree.'
        );
    }

    lines.push(
        `billing half: ${roots.billing.join(', ')}`,
        `verticals half: ${roots.verticals.length > 0 ? roots.verticals.join(', ') : '(none registered)'}`
    );
    if (roots.verticals.length === 0) {
        lines.push(
            'NOTE: the verticals half has no folder registered yet, so no code is verticals code to G14 and ' +
                'no import can cross in either direction. The first leaf that brings verticals code registers ' +
                'its folder in HALVES (scripts/check-billing-verticals-boundary.ts).'
        );
    }

    if (violations.length > 0) {
        for (const half of ['billing', 'verticals'] as const) {
            const crossing = violations.filter((violation) => violation.importedHalf === half);
            if (crossing.length === 0) continue;
            lines.push(
                '',
                `FAIL GUARD:G14: code of the ${otherHalf(half)} half imports the ${half} half ` +
                    '(by package name or relative path, or declares it as a dependency) outside ' +
                    '@repo/billing-verticals-contract. Go through the contract package instead.'
            );
            for (const v of crossing) {
                lines.push(
                    `  ${v.file}${v.line ? `:${v.line}` : ''}  ${v.detail} (the ${half} half)`
                );
            }
        }
        return { exitCode: 1, output: lines.join('\n') };
    }

    lines.push(
        `OK: ${scanned} code file(s) in the halves scanned; none imports the other half by package ` +
            'name or relative path, and no half manifest declares the other.'
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
