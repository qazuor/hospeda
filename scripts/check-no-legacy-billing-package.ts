/**
 * @file check-no-legacy-billing-package.ts
 * @description GUARD:HOS-1626 (AC:1626:3): the retired package stays absent
 * from the workspace, manifests, production imports and TypeScript paths.
 *
 * ## Predicates
 *
 * (a) `packages/billing` does not exist.
 * (b) No tracked package manifest declares the package or points to its path;
 *     unreadable JSON fails closed.
 * (c) Production code has no quoted module string naming the package. Tests
 *     are intentionally skipped: a test that imports it fails on its own,
 *     because the package and its aliases no longer exist.
 * (d) TypeScript config JSON has no quoted path naming the package.
 *
 * Strings are assembled from parts so this guard scans itself without an
 * exception. The scan uses files Git sees, excluding generated/vendor trees,
 * `.specs/`, `.qtm/`, and `pnpm-lock.yaml`. Fewer than 1000 production code
 * files is an untrustworthy scan and fails closed.
 *
 * Exit codes: 0 = clean; 1 = a violation or an untrustworthy scan.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LEGACY_PACKAGE = ['@repo', 'billing'].join('/');
const CODE_EXTENSIONS = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;
const TEST_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;
const MIN_SCANNED_FILES = 1000;
const DEPENDENCY_BLOCKS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
] as const;
const PACKAGE_PATH = /(^|[:/])packages\/billing(\/|$)/;

interface Violation {
    readonly predicate: 'a' | 'b' | 'c' | 'd';
    readonly file: string;
    readonly line?: number;
    readonly detail: string;
}

interface ScanResult {
    readonly violations: readonly Violation[];
    readonly scannedCodeFiles: number;
}

/** List files Git tracks or sees as untracked, excluding generated/vendor trees. */
function listFiles({ root }: { readonly root: string }): readonly string[] {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024
    });
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => file !== 'pnpm-lock.yaml')
        .filter((file) => !file.startsWith('.specs/') && !file.startsWith('.qtm/'))
        .filter((file) => !/(^|\/)(?:node_modules|dist)\//.test(file))
        .filter((file) => {
            try {
                return statSync(join(root, file)).isFile();
            } catch {
                return false;
            }
        });
}

/** Split a source line into quoted string values while ignoring comments. */
function quotedStrings({
    source
}: {
    readonly source: string;
}): readonly { value: string; line: number }[] {
    const found: { value: string; line: number }[] = [];
    let inBlockComment = false;
    const lines = source.split('\n');
    for (const [lineIndex, line] of lines.entries()) {
        let quote: string | null = null;
        let value = '';
        for (let index = 0; index < line.length; index += 1) {
            const char = line[index] as string;
            const next = line[index + 1];
            if (inBlockComment) {
                if (char === '*' && next === '/') {
                    inBlockComment = false;
                    index += 1;
                }
                continue;
            }
            if (quote !== null) {
                if (char === '\\' && index + 1 < line.length) {
                    value += line[index + 1];
                    index += 1;
                } else if (char === quote) {
                    found.push({ value, line: lineIndex + 1 });
                    quote = null;
                } else {
                    value += char;
                }
                continue;
            }
            if (char === '/' && next === '/') break;
            if (char === '/' && next === '*') {
                inBlockComment = true;
                index += 1;
                continue;
            }
            if (char === '"' || char === "'" || char === '`') {
                quote = char;
                value = '';
            }
        }
    }
    return found;
}

/** A quoted value exactly names the package or one of its subpaths. */
function namesPackage({ value }: { readonly value: string }): boolean {
    return value === LEGACY_PACKAGE || value.startsWith(`${LEGACY_PACKAGE}/`);
}

/** Read one package manifest and fail closed when its JSON is malformed. */
function manifestViolations({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(source);
    } catch {
        return [
            {
                predicate: 'b',
                file,
                detail: 'is not valid JSON; the package declaration cannot be checked'
            }
        ];
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return [
            {
                predicate: 'b',
                file,
                detail: 'is not a JSON object; the package declaration cannot be checked'
            }
        ];
    }
    const manifest = parsed as Record<string, unknown>;
    const hits: Violation[] = [];
    const checkMap = (map: unknown, label: string): void => {
        if (!map || typeof map !== 'object' || Array.isArray(map)) return;
        for (const [key, value] of Object.entries(map)) {
            if (key === LEGACY_PACKAGE) {
                hits.push({ predicate: 'b', file, detail: `${label} declares ${LEGACY_PACKAGE}` });
            }
            if (typeof value === 'string' && PACKAGE_PATH.test(value)) {
                hits.push({ predicate: 'b', file, detail: `${label} value points to ${value}` });
            }
        }
    };
    for (const block of DEPENDENCY_BLOCKS) checkMap(manifest[block], block);
    const pnpm = manifest.pnpm;
    if (pnpm && typeof pnpm === 'object' && !Array.isArray(pnpm)) {
        checkMap((pnpm as Record<string, unknown>).overrides, 'pnpm.overrides');
    }
    checkMap(manifest.overrides, 'overrides');
    checkMap(manifest.resolutions, 'resolutions');
    return hits;
}

/** Scan one tree for the four retirement predicates. */
function scan({ root }: { readonly root: string }): ScanResult {
    const files = listFiles({ root });
    const violations: Violation[] = [];
    if (existsSync(join(root, 'packages/billing'))) {
        violations.push({ predicate: 'a', file: 'packages/billing', detail: 'directory exists' });
    }
    let scannedCodeFiles = 0;
    for (const file of files) {
        const source = readFileSync(join(root, file), 'utf8');
        if (file === 'package.json' || file.endsWith('/package.json')) {
            violations.push(...manifestViolations({ file, source }));
        }
        if (CODE_EXTENSIONS.test(file)) {
            if (TEST_FILE.test(file)) continue;
            scannedCodeFiles += 1;
            for (const item of quotedStrings({ source })) {
                if (namesPackage({ value: item.value })) {
                    violations.push({
                        predicate: 'c',
                        file,
                        line: item.line,
                        detail: 'production code contains a quoted package specifier'
                    });
                }
            }
        }
        const isTypeScriptConfig = /(^|\/)tsconfig[^/]*\.json$/.test(file);
        const isTypeScriptConfigPackageJson =
            file.startsWith('packages/typescript-config/') && file.endsWith('.json');
        if (isTypeScriptConfig || isTypeScriptConfigPackageJson) {
            for (const item of quotedStrings({ source })) {
                if (namesPackage({ value: item.value })) {
                    violations.push({
                        predicate: 'd',
                        file,
                        line: item.line,
                        detail: 'TypeScript config contains a quoted package path'
                    });
                }
            }
        }
    }
    return { violations, scannedCodeFiles };
}

/** Run the retirement guard. */
export function run({
    root,
    minScannedFiles
}: {
    readonly root?: string;
    readonly minScannedFiles?: number;
} = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const repoRoot = root ?? resolve(import.meta.dirname, '..');
    const floor = minScannedFiles ?? MIN_SCANNED_FILES;
    const result = scan({ root: repoRoot });
    const lines = ['=== GUARD:HOS-1626 — the legacy billing package stays retired ==='];
    if (result.scannedCodeFiles < floor) {
        lines.push(
            `ERROR: only ${result.scannedCodeFiles} code file(s) scanned; expected at least ${floor}. The scan is broken.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    for (const predicate of ['a', 'b', 'c', 'd'] as const) {
        const matches = result.violations.filter((item) => item.predicate === predicate);
        if (matches.length === 0) continue;
        lines.push('', `FAIL predicate (${predicate}):`);
        for (const item of matches) {
            lines.push(
                `  ${item.file}${item.line === undefined ? '' : `:${item.line}`} — ${item.detail}`
            );
        }
    }
    if (result.violations.length > 0) return { exitCode: 1, output: lines.join('\n') };
    lines.push(
        '',
        `OK: ${result.scannedCodeFiles} code file(s) scanned; no legacy billing package references found.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
