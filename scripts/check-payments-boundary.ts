/**
 * @file check-payments-boundary.ts
 * @description GUARD:G16 (HOS-1352 program, built by B1 / HOS-1506, AC:B1:10,
 * TEST:B1:10): the payments code never again depends on what it left behind.
 *
 * ## The two predicates (the message names the one that failed)
 *
 * (a) The legacy billing library, ANY of its packages, appears in a
 *     `package.json` (dependencies, devDependencies, peerDependencies or
 *     optionalDependencies, plus the override maps `pnpm.overrides`, `overrides`
 *     and `resolutions`), in `pnpm-workspace.yaml` (any non-comment line: its
 *     `overrides:` is where the legacy pin used to live), or as a module
 *     specifier in code, anywhere in the
 *     repo. Code is `.ts .tsx .mts .cts .js .jsx .mjs .cjs .astro`; a specifier
 *     is any quoted string equal to the library's name or starting with it, so
 *     `import`, `export … from`, `import()`, `require()` and `vi.mock()` are all
 *     caught. Lines that start as a comment are prose, not code, and are skipped.
 *
 * (b) The payments package (`packages/payments`) depends on an app: its
 *     `package.json` declares an app package (by the names read from
 *     `apps/<name>/package.json`, or a `file:`/`link:` path into `apps/`), or one
 *     of its code files imports a specifier that names an app package, contains
 *     an `apps/` segment, or is a relative path that resolves into `apps/`.
 *
 * NOT looked at, on purpose: a dependency of the payments package on an internal
 * `@repo/*` package (allowed when avoiding it is not simple: owner, 2026-09-29,
 * case 30), and the payments package importing the verticals half (GUARD:G14's).
 *
 * ## Also carried here: TEST:U1:1 rule P-3
 *
 * This file retires `scripts/check-no-qzpay.sh` (TEST:U1:1, HOS-1416), whose
 * header said G16 would replace it. Its P-1 and P-2 ARE predicate (a). Its P-3
 * is not a G16 predicate (the old billing routes, webhook receiver, storage
 * adapter, test control route and retired cron job files stay deleted), so it is
 * kept verbatim as its own check, reported under its own name, rather than
 * dropped with the old script.
 *
 * ## The guard never spells the library's name
 *
 * It is assembled from parts below, so this file is scanned like any other and
 * needs no exemption.
 *
 * ## Scope
 *
 * The files git sees in the tree (`git ls-files -co --exclude-standard`), minus
 * `.specs/` (prose) and `pnpm-lock.yaml` (generated). A scan of fewer than
 * `MIN_SCANNED_FILES` code files is a moved root or a wrong cwd, not a clean tree.
 *
 * ## Positive control
 *
 * A green guard over a clean tree has proved nothing. `run({ root, minScannedFiles })`
 * takes any tree, and over one that violates a predicate it must exit 1 naming
 * it: `scripts/__tests__/check-payments-boundary.test.ts` does exactly that, once
 * per predicate, over throwaway git trees.
 *
 * Exit codes: 0 = clean; 1 = at least one violation, or an unenforceable rule.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

/** The legacy billing library's package-name prefix, built in parts. */
export const LEGACY_PREFIX = `${'@qazuor'}/${'qz'}${'pay'}`;

/** The payments package, repo-relative. */
export const PAYMENTS_PACKAGE_DIR = 'packages/payments';

/** Fewer code files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 1000;

/** Extensions read as code. */
export const CODE_EXTENSIONS = [
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.astro'
] as const;

/** The four manifest blocks that declare a dependency. */
const DEPENDENCY_BLOCKS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
] as const;

/** P-3: paths the demolition removed (TEST:U1:1, carried from `check-no-qzpay.sh`). */
export const DEMOLISHED_PATHS = [
    'apps/api/src/routes/billing',
    'apps/api/src/routes/webhooks/mercadopago',
    'packages/db/src/billing',
    `apps/api/src/routes/test/${'qz'}${'pay'}-control.ts`
] as const;

/** P-3: the cron jobs the demolition removed; a file named after one resurrects it. */
export const DEMOLISHED_CRON_JOBS = [
    'dunning',
    'webhook-retry',
    'finalize-cancelled-subs',
    'trial-expiry',
    'trial-series-dispatch',
    'addon-expiry',
    'addon-subscription-reconcile',
    'apply-scheduled-plan-changes',
    'subscription-poll',
    'abandoned-pending-subs',
    'preapproval-less-expiry',
    'entity-subscription-cache-reconcile',
    'courtesy-expiry',
    'partner-expiry',
    'partner-payment-review',
    'partner-unpaid-reaper',
    'propagate-plan-price-changes',
    'reactivation-supersession-reconcile',
    'subscription-drift-reconcile',
    'featured-by-entitlement-reconcile'
] as const;

/** The cron jobs directory P-3 watches. */
const CRON_JOBS_DIR = 'apps/api/src/cron/jobs';

/** Which rule a violation breaks. */
export type Rule = 'G16(a)' | 'G16(b)' | 'P-3';

/** One offending occurrence. */
export interface Violation {
    readonly rule: Rule;
    readonly file: string;
    readonly line?: number;
    readonly detail: string;
}

/** What each rule means, printed once per failing rule. */
export const RULE_MESSAGES: Readonly<Record<Rule, string>> = {
    'G16(a)':
        'GUARD:G16 predicate (a): the legacy billing library is declared or overridden in a package.json or ' +
        'pnpm-workspace.yaml, or imported (or a manifest cannot be read to prove otherwise). The old billing ' +
        'system was demolished (U1); nothing in the repo may name it again.',
    'G16(b)':
        'GUARD:G16 predicate (b): the payments package (packages/payments) imports from apps/. ' +
        'It is a shared package: it may depend on internal @repo/* packages, never on an app.',
    'P-3':
        'TEST:U1:1 rule P-3 (carried from the retired check-no-qzpay.sh): a path of the demolished billing ' +
        'system is back (routes, webhook receiver, storage adapter, test control route or a retired cron job).'
};

/** Whether a line starts as a comment (prose, not a dependency). */
function isCommentLine({ line }: { readonly line: string }): boolean {
    return /^\s*(\/\/|\/\*|\*)/.test(line);
}

/**
 * The code part of one line: a trailing `// …` and any inline `/* … *\/` are
 * dropped when they sit OUTSIDE a string literal, so `foo(); // was '<lib>'`
 * is not a hit while `'http://x'` keeps its slashes. A line-local scan: a
 * string or comment spanning lines is not tracked (the leading-comment check
 * covers block comment bodies).
 */
function codeOf({ line }: { readonly line: string }): string {
    let out = '';
    let quote: string | null = null;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i] as string;
        if (quote) {
            out += ch;
            if (ch === '\\' && i + 1 < line.length) {
                out += line[i + 1];
                i += 1;
            } else if (ch === quote) {
                quote = null;
            }
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            out += ch;
            continue;
        }
        if (ch === '/' && line[i + 1] === '/') break;
        if (ch === '/' && line[i + 1] === '*') {
            const end = line.indexOf('*/', i + 2);
            if (end === -1) break;
            i = end + 1;
            out += ' ';
            continue;
        }
        out += ch;
    }
    return out;
}

/** Escapes a literal for use inside a RegExp. */
function escapeRegExp({ text }: { readonly text: string }): string {
    return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** Any quoted string that is, or starts with, the legacy library name. */
const LEGACY_SPECIFIER = new RegExp(`(['"\`])${escapeRegExp({ text: LEGACY_PREFIX })}[^'"\`]*\\1`);

/** A module specifier in an import-creating form. */
const IMPORT_SPECIFIER =
    /(?:\bfrom|\bimport|\brequire|\bvi\.(?:mock|doMock|importActual)|\bjest\.mock)\s*\(?\s*(['"`])([^'"`]+)\1/g;

/**
 * Parses a manifest, failing CLOSED: a manifest the guard cannot read is a
 * violation of the rule that needed to read it, never a silent skip.
 */
function parseManifest(args: {
    readonly file: string;
    readonly source: string;
    readonly rule: Rule;
}): { readonly manifest: Record<string, unknown> } | { readonly violation: Violation } {
    try {
        const parsed: unknown = JSON.parse(args.source);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { manifest: parsed as Record<string, unknown> };
        }
    } catch {
        // falls through to the violation below
    }
    return {
        violation: {
            rule: args.rule,
            file: args.file,
            detail: 'is not a valid JSON object; the guard cannot read it, so it cannot clear it'
        }
    };
}

/**
 * The version-override maps a manifest can carry: pnpm's `pnpm.overrides`, npm's
 * `overrides` and yarn's `resolutions`. Each can pull a package into the tree
 * without any dependency block naming it.
 */
function overrideMaps(args: { readonly manifest: Record<string, unknown> }): readonly {
    readonly where: string;
    readonly map: Record<string, unknown>;
}[] {
    const pnpm = args.manifest.pnpm;
    const candidates: readonly [string, unknown][] = [
        [
            'pnpm.overrides',
            pnpm && typeof pnpm === 'object'
                ? (pnpm as Record<string, unknown>).overrides
                : undefined
        ],
        ['overrides', args.manifest.overrides],
        ['resolutions', args.manifest.resolutions]
    ];
    return candidates.flatMap(([where, map]) =>
        map && typeof map === 'object' ? [{ where, map: map as Record<string, unknown> }] : []
    );
}

/** Whether an override entry (its selector or its target) names the library. */
function overrideNamesLegacy(args: { readonly key: string; readonly value: unknown }): boolean {
    return args.key.includes(LEGACY_PREFIX) || JSON.stringify(args.value).includes(LEGACY_PREFIX);
}

/**
 * Predicate (a), manifest half: a `package.json` that declares the library in
 * a dependency block, or pins it through an override map.
 *
 * @param args.file - Repo-relative path, used in the report
 * @param args.source - The manifest text
 * @returns One violation per declaring entry; one if the manifest is not JSON
 */
export function findLegacyInManifest(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    const parsed = parseManifest({ ...args, rule: 'G16(a)' });
    if ('violation' in parsed) return [parsed.violation];
    const { manifest } = parsed;
    const declared = DEPENDENCY_BLOCKS.flatMap((block) => {
        const deps = manifest[block];
        if (!deps || typeof deps !== 'object') return [];
        // The KEY and the VALUE: an npm alias ("x": "npm:<lib>@1") names the
        // library only in its value.
        return Object.entries(deps as Record<string, unknown>)
            .filter(([name, spec]) => overrideNamesLegacy({ key: name, value: spec }))
            .map(([name, spec]) => ({
                rule: 'G16(a)' as const,
                file: args.file,
                detail: name.startsWith(LEGACY_PREFIX)
                    ? `${block} declares ${name}`
                    : `${block} declares ${name} as ${JSON.stringify(spec)}`
            }));
    });
    const overridden = overrideMaps({ manifest }).flatMap(({ where, map }) =>
        Object.entries(map)
            .filter(([key, value]) => overrideNamesLegacy({ key, value }))
            .map(([key]) => ({
                rule: 'G16(a)' as const,
                file: args.file,
                detail: `${where} overrides ${key}`
            }))
    );
    return [...declared, ...overridden];
}

/**
 * Predicate (a), workspace half: `pnpm-workspace.yaml`, where pnpm reads its
 * `overrides:` (and catalogs, patches). There is no YAML parser among the root
 * dependencies, so it is read by line: ANY non-comment line naming the library
 * fails, which is stricter than the overrides block alone and errs closed.
 *
 * @param args.file - Repo-relative path, used in the report
 * @param args.source - The YAML text
 * @returns One violation per offending line
 */
export function findLegacyInWorkspace(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    return args.source.split('\n').flatMap((line, index) => {
        const code = line.replace(/(^|\s)#.*$/, '');
        return code.includes(LEGACY_PREFIX)
            ? [
                  {
                      rule: 'G16(a)' as const,
                      file: args.file,
                      line: index + 1,
                      detail: line.trim()
                  }
              ]
            : [];
    });
}

/**
 * Predicate (a), code half: a module specifier naming the library.
 *
 * @param args.file - Repo-relative path, used in the report
 * @param args.source - The file text
 * @returns One violation per offending line
 */
export function findLegacyInCode(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    return args.source.split('\n').flatMap((line, index) =>
        !isCommentLine({ line }) && LEGACY_SPECIFIER.test(codeOf({ line }))
            ? [
                  {
                      rule: 'G16(a)' as const,
                      file: args.file,
                      line: index + 1,
                      detail: line.trim()
                  }
              ]
            : []
    );
}

/**
 * Predicate (b), code half: a payments file importing from an app.
 *
 * @param args.root - Repo root (absolute)
 * @param args.file - Repo-relative path of the payments file
 * @param args.source - The file text
 * @param args.appNames - Package names of the apps
 * @returns One violation per offending specifier
 */
export function findAppImports(args: {
    readonly root: string;
    readonly file: string;
    readonly source: string;
    readonly appNames: readonly string[];
}): readonly Violation[] {
    const appsDir = resolve(args.root, 'apps');
    const fileDir = dirname(resolve(args.root, args.file));
    return args.source.split('\n').flatMap((line, index) => {
        if (isCommentLine({ line })) return [];
        return [...codeOf({ line }).matchAll(IMPORT_SPECIFIER)].flatMap((match) => {
            const specifier = match[2] ?? '';
            const namesApp = args.appNames.some(
                (app) => specifier === app || specifier.startsWith(`${app}/`)
            );
            const hasAppsSegment = /(^|\/)apps\//.test(specifier);
            const target = specifier.startsWith('.') ? resolve(fileDir, specifier) : '';
            const resolvesIntoApps =
                target !== '' && (target === appsDir || target.startsWith(`${appsDir}${sep}`));
            return namesApp || hasAppsSegment || resolvesIntoApps
                ? [
                      {
                          rule: 'G16(b)' as const,
                          file: args.file,
                          line: index + 1,
                          detail: `imports '${specifier}'`
                      }
                  ]
                : [];
        });
    });
}

/**
 * Predicate (b), manifest half: the payments manifest declaring an app.
 *
 * @param args.file - Repo-relative path of the manifest
 * @param args.source - The manifest text
 * @param args.appNames - Package names of the apps
 * @returns One violation per declaring entry
 */
export function findAppDependencies(args: {
    readonly file: string;
    readonly source: string;
    readonly appNames: readonly string[];
}): readonly Violation[] {
    const parsed = parseManifest({ ...args, rule: 'G16(b)' });
    if ('violation' in parsed) return [parsed.violation];
    const { manifest } = parsed;
    return DEPENDENCY_BLOCKS.flatMap((block) => {
        const deps = manifest[block];
        if (!deps || typeof deps !== 'object') return [];
        return Object.entries(deps as Record<string, unknown>)
            .filter(
                ([name, spec]) =>
                    args.appNames.includes(name) ||
                    (typeof spec === 'string' && /(^|[:/])apps\//.test(spec))
            )
            .map(([name]) => ({
                rule: 'G16(b)' as const,
                file: args.file,
                detail: `${block} declares ${name}`
            }));
    });
}

/**
 * P-3: the demolished paths and cron job files stay gone.
 *
 * @param args.root - Repo root (absolute)
 * @returns One violation per resurrected path
 */
export function findDemolishedSurface(args: { readonly root: string }): readonly Violation[] {
    const paths = [
        ...DEMOLISHED_PATHS,
        ...DEMOLISHED_CRON_JOBS.flatMap((job) => [
            `${CRON_JOBS_DIR}/${job}.ts`,
            `${CRON_JOBS_DIR}/${job}.job.ts`
        ])
    ];
    return paths
        .filter((path) => existsSync(join(args.root, path)))
        .map((path) => ({
            rule: 'P-3' as const,
            file: path,
            detail: 'exists; the demolition removed it'
        }));
}

/** The files git sees under `root`, minus prose and the lockfile. */
function listFiles({ root }: { readonly root: string }): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024
    });
    return out
        .split('\0')
        .filter((file) => file !== '' && !file.startsWith('.specs/') && file !== 'pnpm-lock.yaml')
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
 * The package names of `apps/*`, which predicate (b) needs. An app manifest
 * that cannot be read is a named (b) violation: without its name, an import of
 * that app could not be recognised.
 */
function readAppNames({ root }: { readonly root: string }): {
    readonly appNames: readonly string[];
    readonly violations: readonly Violation[];
} {
    const appsDir = join(root, 'apps');
    if (!existsSync(appsDir)) return { appNames: [], violations: [] };
    const appNames: string[] = [];
    const violations: Violation[] = [];
    for (const dir of readdirSync(appsDir)) {
        const manifest = join(appsDir, dir, 'package.json');
        if (!existsSync(manifest)) continue;
        const file = `apps/${dir}/package.json`;
        const parsed = parseManifest({
            file,
            source: readFileSync(manifest, 'utf8'),
            rule: 'G16(b)'
        });
        if ('violation' in parsed) {
            violations.push(parsed.violation);
            continue;
        }
        const { name } = parsed.manifest;
        if (typeof name === 'string' && name !== '') appNames.push(name);
        else
            violations.push({
                rule: 'G16(b)',
                file,
                detail: 'has no package name; predicate (b) cannot recognise imports of it'
            });
    }
    return { appNames, violations };
}

/**
 * Scans a tree for every rule.
 *
 * @param args.root - Repo root (absolute)
 * @returns The violations, how many code files were read, and whether the payments package exists
 */
export function scanRepo(args: { readonly root: string }): {
    readonly violations: readonly Violation[];
    readonly scannedCodeFiles: number;
    readonly paymentsPackageFound: boolean;
} {
    const root = isAbsolute(args.root) ? args.root : resolve(args.root);
    const files = listFiles({ root });
    const apps = readAppNames({ root });
    const { appNames } = apps;
    const paymentsManifest = `${PAYMENTS_PACKAGE_DIR}/package.json`;
    const violations: Violation[] = [...apps.violations];
    let scannedCodeFiles = 0;
    for (const file of files) {
        const isManifest = file === 'package.json' || file.endsWith('/package.json');
        const isWorkspace = file === 'pnpm-workspace.yaml' || file.endsWith('/pnpm-workspace.yaml');
        const isCode = CODE_EXTENSIONS.some((ext) => file.endsWith(ext));
        if (!isManifest && !isWorkspace && !isCode) continue;
        const source = readFileSync(join(root, file), 'utf8');
        if (isWorkspace) {
            violations.push(...findLegacyInWorkspace({ file, source }));
            continue;
        }
        if (isManifest) {
            violations.push(...findLegacyInManifest({ file, source }));
            if (file === paymentsManifest)
                violations.push(...findAppDependencies({ file, source, appNames }));
            continue;
        }
        scannedCodeFiles += 1;
        violations.push(...findLegacyInCode({ file, source }));
        if (file.startsWith(`${PAYMENTS_PACKAGE_DIR}/`)) {
            violations.push(...findAppImports({ root, file, source, appNames }));
        }
    }
    violations.push(...findDemolishedSurface({ root }));
    return {
        violations,
        scannedCodeFiles,
        paymentsPackageFound: files.includes(paymentsManifest)
    };
}

/**
 * Runs the guard and renders its report.
 *
 * @param args.root - Repo root (defaults to the cwd)
 * @param args.minScannedFiles - Floor of code files (defaults to `MIN_SCANNED_FILES`)
 * @returns The exit code and the report text
 */
export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const root = args.root ?? process.cwd();
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const lines: string[] = [
        '=== GUARD:G16 — the payments code does not depend on what it left ==='
    ];
    const result = scanRepo({ root });

    if (!result.paymentsPackageFound) {
        lines.push(
            `ERROR: ${PAYMENTS_PACKAGE_DIR}/package.json not found under ${root}.`,
            '       Predicate (b) cannot be enforced; fix PAYMENTS_PACKAGE_DIR or the cwd.'
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    if (result.scannedCodeFiles < minScannedFiles) {
        lines.push(
            `ERROR: only ${result.scannedCodeFiles} code file(s) scanned under ${root}, expected at least ` +
                `${minScannedFiles}. The cwd is wrong or the scan is broken; this is not a clean tree.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }

    const failing = (['G16(a)', 'G16(b)', 'P-3'] as const).filter((rule) =>
        result.violations.some((violation) => violation.rule === rule)
    );
    for (const rule of failing) {
        lines.push('', `FAIL ${RULE_MESSAGES[rule]}`);
        for (const v of result.violations.filter((violation) => violation.rule === rule)) {
            lines.push(`  ${v.file}${v.line ? `:${v.line}` : ''}  ${v.detail}`);
        }
    }
    if (failing.length > 0) return { exitCode: 1, output: lines.join('\n') };

    lines.push(
        `OK: ${result.scannedCodeFiles} code file(s), every package.json and pnpm-workspace.yaml scanned; ` +
            'predicates (a) and (b) and rule P-3 hold.'
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
