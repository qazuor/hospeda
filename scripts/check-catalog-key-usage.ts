/**
 * @file check-catalog-key-usage.ts
 * @description GUARD:G3 (HOS-1352 program, built by V1 / HOS-1431, AC:V1:3,
 * TEST:V1:4): a key used in production code exists in the key catalog
 * (`packages/schemas/src/catalog`).
 *
 * Only that direction (code → catalog). The other one, a key in the database
 * that the catalog does not have, is a database constraint: every assignment
 * points at `catalog_key` by FK, and `catalog_key` is written from the catalog
 * as generated SQL that GUARD:G18 watches.
 *
 * ## What counts as "a key used in code"
 *
 * In every production code file under `apps/` and `packages/` (`.ts .tsx .mts
 * .cts .js .jsx .mjs .cjs .astro`, tests excluded, comments ignored):
 *
 * 1. A member of the legacy key enums, `EntitlementKey.X` or `LimitKey.X`
 *    (`@repo/billing`), resolved to its string value by reading the enum
 *    declarations in `packages/billing/src/types/`. The value must be a
 *    catalog key. A member the enums do not declare fails too: it cannot be
 *    resolved, so it cannot be proved to be in the catalog.
 * 2. A string literal equal to a value of those legacy enums (`'read_reviews'`).
 *    It must be a catalog key.
 * 3. A string literal passed as `key:` to the catalog accessors
 *    (`getCatalogKey({ key: '...' })`, `isCatalogKey({ key: '...' })`). It must
 *    be a catalog key.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - A key-shaped literal that is neither a legacy enum value nor an accessor
 *   argument (`const k = 'brand_new_key'`): nothing distinguishes it from any
 *   other snake_case string, so a NEW key invented outside both forms is
 *   invisible until it reaches the enum or the accessor.
 * - A key built at runtime (concatenation, template, a variable).
 *
 * ## The one exclusion and the one allowlist entry
 *
 * - `packages/billing/` is not scanned: it is the legacy package that DECLARES
 *   the old enums, still with `read_reviews` (owner decision 7, 2026-10-07). It
 *   leaves the repository with HOS-1626.
 * - {@link ALLOWLIST} lets exactly one file use exactly one out-of-catalog key:
 *   `apps/web/src/components/billing/plan-comparison-rows.ts` and its
 *   `reviews` row (`read_reviews`), kept on purpose (no intermediate UX
 *   patches) until HOS-1626. An entry that stops matching (the file no longer
 *   uses that key) FAILS, so the allowlist cannot outlive its reason.
 *
 * ## Positive control
 *
 * `run({ root, minScannedFiles, catalogKeys, allowlist })` takes any tree:
 * `scripts/__tests__/check-catalog-key-usage.test.ts` adds an out-of-catalog
 * key on purpose and sees it red.
 *
 * Exit codes: 0 = every used key is in the catalog; 1 = a violation, a stale
 * allowlist entry, or a scan that cannot be trusted.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG_KEY_NAMES } from '../packages/schemas/src/catalog/key-catalog.js';
import { stripComments } from './check-vertical-axis-items.js';

/** The legacy enum declarations, repo-relative, by enum name. */
export const LEGACY_ENUM_FILES = {
    EntitlementKey: 'packages/billing/src/types/entitlement.types.ts',
    LimitKey: 'packages/billing/src/types/plan.types.ts'
} as const;

/** The scanned tree is production code under these roots. */
const SCAN_ROOT = /^(?:apps|packages)\//;

/** Not scanned: the legacy package that declares the old enums (until HOS-1626). */
export const EXCLUDED_PREFIX = 'packages/billing/';

/** Exact path → the out-of-catalog keys it may use, each with its reason. */
export const ALLOWLIST: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    'apps/web/src/components/billing/plan-comparison-rows.ts': {
        read_reviews:
            'the plan comparison table keeps its `reviews` row until the legacy package leaves (HOS-1626)'
    }
};

/** Fewer scanned files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 1000;

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;
const TEST_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;

/** One problem found by the guard. */
export interface G3Violation {
    readonly file: string;
    readonly line?: number;
    readonly key: string;
    readonly detail: string;
}

/**
 * Reads the members of one legacy enum declaration.
 *
 * @param input - Parse input.
 * @param input.source - The declaring file's text.
 * @param input.enumName - The enum to read.
 * @returns Member name → string value; empty when the enum is not found.
 */
export function parseEnumMembers({
    source,
    enumName
}: {
    readonly source: string;
    readonly enumName: string;
}): ReadonlyMap<string, string> {
    const code = stripComments({ source });
    const start = code.search(new RegExp(`export\\s+enum\\s+${enumName}\\s*\\{`));
    if (start === -1) return new Map();
    const body = code.slice(code.indexOf('{', start) + 1, code.indexOf('}', start));
    const members = new Map<string, string>();
    for (const match of body.matchAll(/([A-Z][A-Z0-9_]*)\s*=\s*['"]([^'"]+)['"]/g)) {
        members.set(match[1] as string, match[2] as string);
    }
    return members;
}

/**
 * Finds every key a file uses that the catalog does not have.
 *
 * @param input - Scan input.
 * @param input.file - Repo-relative path, for the report.
 * @param input.source - The file's text.
 * @param input.enums - Legacy enum name → (member → value).
 * @param input.catalogKeys - The catalog's key names.
 * @returns One violation per out-of-catalog use, with its line.
 */
export function findOutOfCatalogKeys({
    file,
    source,
    enums,
    catalogKeys
}: {
    readonly file: string;
    readonly source: string;
    readonly enums: Readonly<Record<string, ReadonlyMap<string, string>>>;
    readonly catalogKeys: ReadonlySet<string>;
}): readonly G3Violation[] {
    const code = stripComments({ source });
    const lineOf = (index: number) => code.slice(0, index).split('\n').length;
    const legacyValues = new Set(Object.values(enums).flatMap((members) => [...members.values()]));
    const violations: G3Violation[] = [];

    const enumNames = Object.keys(enums).join('|');
    for (const match of code.matchAll(
        new RegExp(`\\b(${enumNames})\\.([A-Z][A-Z0-9_]*)\\b`, 'g')
    )) {
        const enumName = match[1] as string;
        const member = match[2] as string;
        const value = enums[enumName]?.get(member);
        if (value === undefined) {
            violations.push({
                file,
                line: lineOf(match.index),
                key: `${enumName}.${member}`,
                detail: `${enumName}.${member} is not declared by the legacy enum, so it cannot be resolved to a catalog key.`
            });
        } else if (!catalogKeys.has(value)) {
            violations.push({
                file,
                line: lineOf(match.index),
                key: value,
                detail: `${enumName}.${member} is '${value}', which is not in the key catalog.`
            });
        }
    }

    for (const match of code.matchAll(/(['"`])([a-z][a-z0-9_]*)\1/g)) {
        const value = match[2] as string;
        if (legacyValues.has(value) && !catalogKeys.has(value)) {
            violations.push({
                file,
                line: lineOf(match.index),
                key: value,
                detail: `the literal '${value}' is a legacy key that is not in the key catalog.`
            });
        }
    }

    const accessor = /\b(?:getCatalogKey|isCatalogKey)\s*\(\s*\{\s*key\s*:\s*(['"`])([^'"`]*)\1/g;
    for (const match of code.matchAll(accessor)) {
        const value = match[2] as string;
        if (!catalogKeys.has(value)) {
            violations.push({
                file,
                line: lineOf(match.index),
                key: value,
                detail: `the catalog is asked for '${value}', which it does not have.`
            });
        }
    }
    return violations;
}

/** Production code files G3 reads, from the files git sees under `root`. */
function listScannedFiles({ root }: { readonly root: string }): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return out
        .split('\0')
        .filter(Boolean)
        .filter((file) => SCAN_ROOT.test(file) && !file.startsWith(EXCLUDED_PREFIX))
        .filter((file) => CODE_FILE.test(file) && !TEST_FILE.test(file));
}

/**
 * Runs GUARD:G3.
 *
 * @param args - Run input.
 * @param args.root - Repository root; defaults to this repo.
 * @param args.minScannedFiles - Scan floor; defaults to {@link MIN_SCANNED_FILES}.
 * @param args.catalogKeys - The catalog's key names; defaults to the code catalog.
 * @param args.allowlist - Exact path → allowed out-of-catalog keys; defaults to {@link ALLOWLIST}.
 * @returns The exit code and the report.
 */
export function run(
    args: {
        readonly root?: string;
        readonly minScannedFiles?: number;
        readonly catalogKeys?: readonly string[];
        readonly allowlist?: Readonly<Record<string, Readonly<Record<string, string>>>>;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const catalogKeys = new Set(args.catalogKeys ?? CATALOG_KEY_NAMES);
    const allowlist = args.allowlist ?? ALLOWLIST;
    const lines = ['=== GUARD:G3 - every key used in production code is in the key catalog ==='];

    const enums: Record<string, ReadonlyMap<string, string>> = {};
    for (const [enumName, file] of Object.entries(LEGACY_ENUM_FILES)) {
        let members: ReadonlyMap<string, string> = new Map();
        try {
            members = parseEnumMembers({
                source: readFileSync(join(root, file), 'utf8'),
                enumName
            });
        } catch {
            // Reported below as an empty enum.
        }
        if (members.size === 0) {
            lines.push(
                `ERROR: could not read enum ${enumName} from ${file}. Form 1 and 2 cannot be enforced; ` +
                    'fix LEGACY_ENUM_FILES (or retire them with HOS-1626).'
            );
            return { exitCode: 1, output: lines.join('\n') };
        }
        enums[enumName] = members;
    }

    const files = listScannedFiles({ root });
    if (files.length < minScannedFiles) {
        lines.push(
            `ERROR: only ${files.length} code file(s) scanned under ${root}, expected at least ${minScannedFiles}. ` +
                'The root is wrong or the scan is broken; this is not a clean tree.'
        );
        return { exitCode: 1, output: lines.join('\n') };
    }

    const found = files.flatMap((file) =>
        findOutOfCatalogKeys({
            file,
            source: readFileSync(join(root, file), 'utf8'),
            enums,
            catalogKeys
        })
    );
    const violations = found.filter((v) => allowlist[v.file]?.[v.key] === undefined);
    const stale = Object.entries(allowlist).flatMap(([file, keys]) =>
        Object.keys(keys)
            .filter((key) => !found.some((v) => v.file === file && v.key === key))
            .map((key) => `${file}: '${key}'`)
    );

    if (violations.length > 0) {
        lines.push(
            '',
            'FAIL G3: production code uses a key that is not in the key catalog (packages/schemas/src/catalog).',
            'Add the key to the catalog (and regenerate its SQL, GUARD:G18) or stop using it.'
        );
        for (const v of violations) lines.push(`  ${v.file}:${v.line}  ${v.detail}`);
    }
    if (stale.length > 0) {
        lines.push(
            '',
            'FAIL G3: an allowlist entry no longer matches any use; remove it from ALLOWLIST.'
        );
        for (const entry of stale) lines.push(`  ${entry}`);
    }
    if (violations.length > 0 || stale.length > 0) return { exitCode: 1, output: lines.join('\n') };

    const allowed = found.length;
    lines.push(
        `OK: ${files.length} code file(s) under apps/ and packages/ (minus ${EXCLUDED_PREFIX}) use only catalog keys` +
            `${allowed > 0 ? `; ${allowed} allowlisted use(s) until HOS-1626` : ''}.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
