#!/usr/bin/env tsx

/**
 * @file check-env-usage.ts
 * @description Scans every TypeScript source file under `apps/<app>/src` and
 * `packages/<pkg>/src` for `process.env.X` reads (both `process.env.FOO` dot
 * access and `process.env['FOO']` / `process.env["FOO"]` bracket access) and
 * diffs the set of referenced variable names against `@repo/config`'s
 * `ENV_REGISTRY` (HOS-79 — Env Var Management Hardening).
 *
 * This closes gap G-1 from the spec: a shared package or app can read
 * `process.env.X` directly, bypassing every per-app Zod schema, and nothing
 * previously caught that. Three real vars were found unregistered this way
 * before this script existed: `HOSPEDA_TAG_USER_QUOTA_PER_USER`,
 * `HOSPEDA_DEPLOY_ENV`, `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED` (all registered
 * by a companion task before this script shipped).
 *
 * Primary (failing) direction — AC-1:
 *   Any `process.env.X` used in scope whose `X` has no matching
 *   `ENV_REGISTRY` entry (and is not in {@link PLATFORM_ENV_ALLOWLIST}) fails
 *   the check, printing the offending variable name and the `file:line`
 *   where it was read.
 *
 * Secondary (informational, never failing) direction:
 *   Registry entries never observed via a direct `process.env.X` read are
 *   reported as a count only. This is intentionally non-actionable noise —
 *   most registry entries are consumed indirectly through a Zod schema
 *   parsed against the whole `process.env` object (`schema.parse(process.env)`),
 *   not a literal per-key member access, so a large "phantom" count is
 *   expected and does NOT indicate a real gap.
 *
 * Scope: `{apps,packages}/*\/src/**\/*.{ts,tsx}`, excluding any path segment
 * named `node_modules`, `dist`, `test`, `tests`, `__tests__`, `__mocks__`,
 * `docs`, or `scripts` (the spec calls out `test`/`dist`/`docs`/`scripts`
 * explicitly; `tests`/`__tests__`/`__mocks__` are included too since they are
 * the same "test code" category under a different naming convention used
 * throughout this monorepo).
 *
 * Usage:
 *   pnpm env:check:usage
 *
 * Exit codes:
 *   0 — every process.env usage in scope is registered
 *   1 — at least one usage has no matching registry entry
 */

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
import { ENV_REGISTRY } from '../packages/config/src/env-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single `process.env.X` (or `process.env['X']`) read site. */
export interface EnvUsage {
    /** The environment variable name referenced. */
    readonly name: string;
    /** File path where the read occurs (relative to the repo root when produced by {@link main}). */
    readonly file: string;
    /** 1-based line number of the read within {@link EnvUsage.file}. */
    readonly line: number;
}

/** Result of diffing observed usages against the registry. */
export interface UsageDiffResult {
    /** Usages whose name has no matching registry entry (and isn't allowlisted) — the failing set. */
    readonly unregistered: readonly EnvUsage[];
    /** Registry names never observed via a direct `process.env.X` read — informational only, never failing. */
    readonly phantom: readonly string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

/**
 * Directory names excluded from the scan wherever they appear in the path,
 * at any depth under `apps/*\/src` or `packages/*\/src`.
 *
 * The spec (HOS-79 §6) names `test`, `dist`, `docs`, `scripts` explicitly.
 * `tests`, `__tests__`, and `__mocks__` are added here because this monorepo
 * uses those names interchangeably with `test` for the same purpose (see
 * e.g. `packages/config/src/__tests__/`), and scanning them would only add
 * noise from mock/fixture code that is never subject to the same
 * registry-registration discipline as production source.
 */
const EXCLUDED_DIR_NAMES: ReadonlySet<string> = new Set([
    'node_modules',
    'dist',
    'test',
    'tests',
    '__tests__',
    '__mocks__',
    'docs',
    'scripts'
]);

/**
 * Environment variable names that are legitimately read via `process.env.X`
 * but must NEVER be added to `ENV_REGISTRY` — pure platform/framework
 * signals that are not part of the Hospeda-managed configuration surface.
 *
 * Keep this list SMALL. Every genuine platform variable actually used in
 * this repo today (`NODE_ENV`, `CI`, `API_PORT`, `API_HOST`,
 * `ALLOW_PLACEHOLDER_ENV_URLS`) already has a real `ENV_REGISTRY` entry
 * (several with `platformInjected: true`), so as of HOS-79 this allowlist is
 * intentionally EMPTY — do not add an entry here to force a check green
 * without first confirming the variable cannot or should not be a registry
 * entry. When in doubt, register it instead (see `packages/config/src/env-registry.hospeda.ts`
 * for the pattern) rather than allowlisting it here.
 */
export const PLATFORM_ENV_ALLOWLIST: ReadonlySet<string> = new Set([]);

const DOT_ACCESS_RE = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
const BRACKET_ACCESS_RE = /process\.env\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Replaces the contents of every `/* ... *\/` block comment with spaces
 * (preserving line breaks and overall length), so subsequent regex scanning
 * never mistakes an illustrative `process.env.X` mention inside a JSDoc
 * `@example` block for a real usage site.
 *
 * Deliberately does NOT touch `//` line comments: unlike block comments,
 * stripping those naively risks truncating real code that happens to
 * contain `://` (e.g. a URL in an adjacent string literal on the same
 * line), and no real false positive from a line comment was found in this
 * codebase at the time this scanner was written.
 *
 * @param content - Raw file content
 * @returns Content with block-comment bodies blanked out
 */
export function blankBlockComments(content: string): string {
    return content.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

/**
 * Extracts every `process.env.X` / `process.env['X']` read from a single
 * file's content, with 1-based line numbers.
 *
 * @param input - The file content and the path used to label results
 * @returns One {@link EnvUsage} entry per read site (duplicates preserved —
 *   the same name can be read from multiple lines/files)
 */
export function extractEnvUsages(input: { content: string; filePath: string }): EnvUsage[] {
    const { content, filePath } = input;
    const sanitized = blankBlockComments(content);
    const lines = sanitized.split('\n');
    const usages: EnvUsage[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        for (const pattern of [DOT_ACCESS_RE, BRACKET_ACCESS_RE]) {
            pattern.lastIndex = 0;
            let match = pattern.exec(line);
            while (match) {
                const name = match[1];
                if (name) {
                    usages.push({ name, file: filePath, line: lineIndex + 1 });
                }
                match = pattern.exec(line);
            }
        }
    }

    return usages;
}

/**
 * Finds every `.ts`/`.tsx` file under `{apps,packages}/*\/src`, excluding
 * {@link EXCLUDED_DIR_NAMES} at any depth.
 *
 * @param input - The repo root to scan from
 * @returns Absolute paths to every matching source file, sorted
 */
export function findSourceFiles(input: { rootDir: string }): string[] {
    const { rootDir } = input;
    const ignore = [...EXCLUDED_DIR_NAMES].map((dir) => `**/${dir}/**`);
    return globSync('{apps,packages}/*/src/**/*.{ts,tsx}', {
        cwd: rootDir,
        ignore,
        absolute: true
    }).sort();
}

/**
 * Diffs observed `process.env` usages against the registry (both directions).
 *
 * @param input - Observed usages and the set of registered variable names
 * @returns Unregistered usages (the failing set) and phantom registry names
 *   (informational only)
 */
export function diffUsageAgainstRegistry(input: {
    usages: readonly EnvUsage[];
    registryNames: ReadonlySet<string>;
    /** Defaults to {@link PLATFORM_ENV_ALLOWLIST}; overridable so tests can inject a fixture allowlist. */
    allowlist?: ReadonlySet<string>;
}): UsageDiffResult {
    const { usages, registryNames, allowlist = PLATFORM_ENV_ALLOWLIST } = input;

    const unregistered = usages.filter(
        (usage) => !registryNames.has(usage.name) && !allowlist.has(usage.name)
    );

    const usedNames = new Set(usages.map((usage) => usage.name));
    const phantom = [...registryNames].filter((name) => !usedNames.has(name)).sort();

    return { unregistered, phantom };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Scans the repo and reports unregistered `process.env` usages.
 */
function main(): void {
    const files = findSourceFiles({ rootDir: ROOT });

    const usages: EnvUsage[] = [];
    for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        usages.push(...extractEnvUsages({ content, filePath: relative(ROOT, file) }));
    }

    const registryNames = new Set(ENV_REGISTRY.map((entry) => entry.name));
    const { unregistered, phantom } = diffUsageAgainstRegistry({ usages, registryNames });

    if (phantom.length > 0) {
        console.log(
            `ℹ ${phantom.length} registry var(s) not observed via a direct process.env.X read (informational only — most are consumed indirectly through a Zod-parsed schema, not a literal member access; this is NOT a failure signal).`
        );
    }

    if (unregistered.length === 0) {
        console.log(
            `✓ All ${usages.length} process.env usage(s) across ${files.length} source file(s) are registered in ENV_REGISTRY.`
        );
        return;
    }

    console.error(
        `✗ Found ${unregistered.length} process.env usage(s) with no matching ENV_REGISTRY entry:\n`
    );
    for (const usage of unregistered) {
        console.error(`  ${usage.name}  ${usage.file}:${usage.line}`);
    }
    console.error(
        '\nFix: add a registry entry in packages/config/src/env-registry.*.ts (see existing entries for the pattern), ' +
            'or if this is a genuine platform/framework signal that must never be a registry entry, ' +
            'add it to PLATFORM_ENV_ALLOWLIST in scripts/check-env-usage.ts with a comment justifying why.'
    );
    process.exitCode = 1;
}

// Run only when invoked as a script (skip when imported by tests).
const isMainModule =
    process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    main();
}
