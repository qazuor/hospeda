#!/usr/bin/env tsx

/**
 * @file check-env-local.ts
 * @description For each app, reads its local dotenv file (`.env.local`) and
 * diffs the present keys against `@repo/config`'s `ENV_REGISTRY`, filtered
 * to entries whose `apps` array includes that app AND whose effective
 * required scope is `'always'` (HOS-79 — Env Var Management Hardening, gap
 * G-2).
 *
 * Only vars whose effective scope is `'always'` (`requiredScope: 'always'`,
 * or `required: true` with no `requiredScope`) are required locally.
 * `requiredScope: 'production'` vars are NOT required in local dev (a
 * developer's machine is never `NODE_ENV=production`), and `'conditional'`
 * / fully-optional vars are never required by this check either — deciding
 * whether a conditional var's trigger condition holds from free-text
 * `requiredWhen` is out of scope here (see `pnpm env:check:rules` for
 * cross-var consistency checks).
 *
 * A missing dotenv file is treated as "every var is absent" — never a
 * crash (per spec §8 UX behavior).
 *
 * Usage:
 *   pnpm env:check:local
 *
 * Exit codes:
 *   0 — every `'always'`-required var is present (non-empty) in every
 *       checked app's `.env.local`
 *   1 — at least one `'always'`-required var is missing from at least one
 *       app's `.env.local`
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseDotenv } from 'dotenv';
import type { AppId, EnvVarDefinition } from '../packages/config/src/env-registry-types.js';
import { ENV_REGISTRY } from '../packages/config/src/env-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single missing-required-var finding for one app. */
export interface LocalEnvGap {
    /** App the gap was found in. */
    readonly app: AppId;
    /** Registry variable name that is missing. */
    readonly key: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

/**
 * Maps each app to its local dotenv file path. `docker` and `seed` are
 * pseudo-apps with no per-app `.env.local` of their own (mirrors the
 * `null` mapping in `scripts/generate-env-examples.ts` / the
 * `env-examples.guard.test.ts` `EXAMPLE_PATHS` convention).
 */
const DOTENV_PATHS: Record<AppId, string | null> = {
    api: resolve(ROOT, 'apps/api/.env.local'),
    web: resolve(ROOT, 'apps/web/.env.local'),
    admin: resolve(ROOT, 'apps/admin/.env.local'),
    mobile: resolve(ROOT, 'apps/mobile/.env.local'),
    docker: null,
    seed: null
};

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Reads and parses a dotenv-style file. A missing file (or any read error)
 * is treated as "no keys present" — never throws.
 *
 * @param input - Absolute path to the dotenv file
 * @returns Parsed key/value pairs, or an empty object if the file is absent
 */
export function readDotenvFile(input: { filePath: string }): Record<string, string> {
    const { filePath } = input;
    try {
        const raw = readFileSync(filePath, 'utf-8');
        return parseDotenv(raw);
    } catch {
        return {};
    }
}

/**
 * Returns true when a registry entry's effective required scope is
 * `'always'` — i.e. it must be present in every environment, including
 * local dev.
 *
 * @param entry - Registry entry to evaluate
 * @returns Whether the entry is always-required
 */
export function isAlwaysRequired(entry: EnvVarDefinition): boolean {
    return entry.requiredScope === 'always' || (entry.required && !entry.requiredScope);
}

/**
 * Finds every `'always'`-required registry var for `appId` that is missing
 * (absent, or present but empty) from `localValues`.
 *
 * @param input - The app being checked, its parsed local dotenv values, and
 *   the full registry to filter
 * @returns One {@link LocalEnvGap} per missing always-required var
 */
export function findMissingAlwaysRequiredVars(input: {
    appId: AppId;
    localValues: Readonly<Record<string, string>>;
    registry: readonly EnvVarDefinition[];
}): LocalEnvGap[] {
    const { appId, localValues, registry } = input;
    const gaps: LocalEnvGap[] = [];

    for (const entry of registry) {
        if (!entry.apps.includes(appId)) continue;
        if (!isAlwaysRequired(entry)) continue;

        const value = localValues[entry.name];
        if (value === undefined || value === '') {
            gaps.push({ app: appId, key: entry.name });
        }
    }

    return gaps;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Checks every app's local dotenv file against the registry and reports
 * missing always-required vars.
 */
function main(): void {
    const allGaps: LocalEnvGap[] = [];

    for (const [appId, dotenvPath] of Object.entries(DOTENV_PATHS) as Array<
        [AppId, string | null]
    >) {
        if (dotenvPath === null) continue;

        const localValues = readDotenvFile({ filePath: dotenvPath });
        const gaps = findMissingAlwaysRequiredVars({ appId, localValues, registry: ENV_REGISTRY });
        allGaps.push(...gaps);
    }

    if (allGaps.length === 0) {
        console.log(
            "✓ Every always-required registry var is present in each checked app's .env.local."
        );
        return;
    }

    console.error(`✗ Found ${allGaps.length} missing always-required var(s):\n`);
    const byApp = new Map<AppId, string[]>();
    for (const gap of allGaps) {
        const existing = byApp.get(gap.app);
        if (existing) {
            existing.push(gap.key);
        } else {
            byApp.set(gap.app, [gap.key]);
        }
    }
    for (const [app, keys] of byApp) {
        console.error(`  ${app}:`);
        for (const key of keys) {
            console.error(`    - ${key}`);
        }
    }
    console.error(
        "\nFix: copy the missing value(s) into the app's .env.local (see .env.example for placeholders), " +
            'or run pnpm env:set once the local wizard ships.'
    );
    process.exitCode = 1;
}

// Run only when invoked as a script (skip when imported by tests).
const isMainModule =
    process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    main();
}
