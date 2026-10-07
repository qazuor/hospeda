/**
 * @file check-sdk-outside-adapter.ts
 * @description GUARD:G12 (HOS-1352 program, built by B1 / HOS-1509, AC:B1:8,
 * TEST:B1:8, DEC-ARCH-004 condition A): the payment gateway's SDK is imported
 * ONLY inside the adapter. It is what turns "do not do it" into "it cannot be
 * done": the day a second unit imports the SDK, changing gateway stops being a
 * change to the adapter.
 *
 * ## The predicate
 *
 * The SDK is a CLOSED list of module specifiers: `mercadopago` (and any subpath,
 * `mercadopago/…`) and any `@mercadopago/*` package. A violation is:
 *
 * - **in code** (`.ts .tsx .mts .cts .js .jsx .mjs .cjs .astro`, tests included,
 *   comments and plain strings ignored): the specifier in an import position,
 *   that is `import … from '…'`, a side-effect `import '…'`, `export … from '…'`,
 *   a dynamic `import('…')`, `require('…')`, `require.resolve('…')` or TS
 *   `import x = require('…')`, in any file NOT under
 *   `packages/payments/src/adapters/`;
 * - **in a manifest**: any `package.json` other than
 *   `packages/payments/package.json` that declares the SDK in
 *   `dependencies`, `devDependencies`, `peerDependencies` or
 *   `optionalDependencies`, by name or through an npm alias
 *   (`"mp": "npm:mercadopago@2"`).
 *
 * `packages/payments/src/fake/` is NOT exempt: the fake implements the
 * interface without the gateway, by definition. The payments package's own
 * `package.json` is the ONE manifest that may declare the SDK: pnpm installs
 * packages only from `packages/*`, so the adapter can get the SDK from nowhere
 * else, and the code half still keeps every import of it under
 * `packages/payments/src/adapters/`.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - A specifier built at run time (`require(name)`, `import(\`${x}\`)`).
 * - The SDK pulled under another package name that is not an npm alias of it
 *   (a fork, a vendored copy), or through `pnpm-workspace.yaml` catalogs or
 *   override maps, which are not dependency declarations.
 * - `.specs/`, `node_modules/` and `dist/` (prose and build output).
 *
 * ## Scope and positive control
 *
 * The files git sees in the tree. A scan of fewer than `MIN_SCANNED_FILES` code
 * files is a moved root or a wrong cwd, not a clean tree.
 * `run({ root, minScannedFiles })` takes any tree;
 * `scripts/__tests__/check-sdk-outside-adapter.test.ts` runs it over throwaway
 * git trees that violate the predicate.
 *
 * Exit codes: 0 = clean; 1 = a violation, or a scan too small to trust.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_FILE, lineOf, maskSource, PAYMENTS_ADAPTERS_DIR } from './payments-guard-scan.js';

/** Fewer code files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 1000;

/** The gateway SDK: the closed list of specifiers G12 forbids outside the adapter. */
export const SDK_SPECIFIER = /^(?:mercadopago(?:\/.*)?|@mercadopago\/.+)$/;

/** An npm alias to the SDK, as a dependency value. */
const SDK_ALIAS = /^npm:(?:mercadopago|@mercadopago\/[^@]+)(?:@|$)/;

/** The manifest blocks that declare a dependency. */
const DEPENDENCY_BLOCKS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
] as const;

/** The only manifest allowed to declare the SDK: the payments package's own. */
export const PAYMENTS_MANIFEST = 'packages/payments/package.json';

/** One offending occurrence. */
export interface Violation {
    readonly rule: 'G12';
    readonly file: string;
    readonly line?: number;
    readonly detail: string;
}

/** What the predicate means. */
export const RULE_MESSAGE =
    "GUARD:G12: the payment gateway's SDK (mercadopago, @mercadopago/*) is imported outside " +
    'packages/payments/src/adapters/, or declared in a package.json other than ' +
    'packages/payments/package.json. Only the adapter speaks to the gateway; everything else ' +
    'goes through the PaymentProvider interface (DEC-ARCH-004, condition A).';

/** One module specifier in an import position. */
export interface ImportedSpecifier {
    readonly specifier: string;
    readonly offset: number;
}

/**
 * What the code just before a string literal must look like for the literal to
 * be a module specifier (over masked code, so comments are gone).
 */
const IMPORT_POSITION =
    /(?:\bfrom|(?:^|[^.\w$])(?:import\s*\(?|require(?:\s*\.\s*resolve)?\s*\())\s*$/;

/**
 * Every module specifier a file names in an import position.
 *
 * @param args.source - The file text
 * @returns Each specifier with the offset of its opening quote
 */
export function importedSpecifiers({
    source
}: {
    readonly source: string;
}): readonly ImportedSpecifier[] {
    const { code, strings } = maskSource({ source });
    return strings
        .filter((literal) =>
            IMPORT_POSITION.test(code.slice(Math.max(0, literal.start - 200), literal.start))
        )
        .map((literal) => ({ specifier: literal.value, offset: literal.start }));
}

/**
 * The code half of the predicate over one file.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The file text
 * @returns One violation per SDK specifier in an import position
 */
export function findSdkImports(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    return importedSpecifiers({ source: args.source })
        .filter(({ specifier }) => SDK_SPECIFIER.test(specifier))
        .map(({ specifier, offset }) => ({
            rule: 'G12' as const,
            file: args.file,
            line: lineOf({ source: args.source, offset }),
            detail: `imports '${specifier}'`
        }));
}

/**
 * The manifest half of the predicate over one `package.json`.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The manifest text
 * @returns One violation per declaring entry; one if the manifest is not JSON
 */
export function findSdkDeclarations(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    let manifest: unknown;
    try {
        manifest = JSON.parse(args.source);
    } catch {
        return [{ rule: 'G12', file: args.file, detail: 'is not valid JSON; cannot be checked' }];
    }
    if (!manifest || typeof manifest !== 'object') return [];
    return DEPENDENCY_BLOCKS.flatMap((block) => {
        const deps = (manifest as Record<string, unknown>)[block];
        if (!deps || typeof deps !== 'object') return [];
        return Object.entries(deps as Record<string, unknown>)
            .filter(
                ([name, spec]) =>
                    SDK_SPECIFIER.test(name) || (typeof spec === 'string' && SDK_ALIAS.test(spec))
            )
            .map(([name, spec]) => ({
                rule: 'G12' as const,
                file: args.file,
                detail: `${block} declares ${name}: ${JSON.stringify(spec)}`
            }));
    });
}

/** The files git sees under `root`, minus prose, build output and installs. */
function listFiles({ root }: { readonly root: string }): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024
    });
    return out
        .split('\0')
        .filter((file) => file !== '' && !file.startsWith('.specs/'))
        .filter((file) => !/(^|\/)(node_modules|dist)\//.test(file))
        .filter((file) => {
            try {
                return statSync(join(root, file)).isFile();
            } catch {
                return false;
            }
        });
}

/**
 * Scans a tree.
 *
 * @param args.root - Repository root
 * @returns The violations and how many code files were read
 */
export function scanRepo(args: { readonly root: string }): {
    readonly violations: readonly Violation[];
    readonly scannedCodeFiles: number;
} {
    const violations: Violation[] = [];
    let scannedCodeFiles = 0;
    for (const file of listFiles({ root: args.root })) {
        const isManifest = file === 'package.json' || file.endsWith('/package.json');
        const isCode = CODE_FILE.test(file);
        if (!isManifest && !isCode) continue;
        if (isCode) scannedCodeFiles += 1;
        if (isCode && file.startsWith(PAYMENTS_ADAPTERS_DIR)) continue;
        if (isManifest && file === PAYMENTS_MANIFEST) continue;
        const source = readFileSync(join(args.root, file), 'utf8');
        violations.push(
            ...(isManifest
                ? findSdkDeclarations({ file, source })
                : findSdkImports({ file, source }))
        );
    }
    return { violations, scannedCodeFiles };
}

/**
 * Runs GUARD:G12.
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
    const lines = ["=== GUARD:G12 - the gateway's SDK only inside the adapter ==="];
    const { violations, scannedCodeFiles } = scanRepo({ root });
    if (scannedCodeFiles < minScannedFiles) {
        lines.push(
            `ERROR: only ${scannedCodeFiles} code file(s) scanned under ${root}, expected at least ` +
                `${minScannedFiles}. The cwd is wrong or the scan is broken; this is not a clean tree.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    if (violations.length > 0) {
        lines.push('', `FAIL ${RULE_MESSAGE}`);
        for (const v of violations)
            lines.push(`  ${v.file}${v.line === undefined ? '' : `:${v.line}`}  ${v.detail}`);
        return { exitCode: 1, output: lines.join('\n') };
    }
    lines.push(
        `OK: ${scannedCodeFiles} code file(s) and every package.json scanned; the gateway's SDK appears ` +
            `imported only under ${PAYMENTS_ADAPTERS_DIR} and declared only in ${PAYMENTS_MANIFEST}.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
