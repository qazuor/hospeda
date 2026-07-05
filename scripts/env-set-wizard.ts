#!/usr/bin/env tsx

/**
 * @file env-set-wizard.ts
 * @description Interactive local env-var wizard: `pnpm env:set [--review-all]`
 * (HOS-79 — Env Var Management Hardening, T-018, spec §8, AC-6).
 *
 * DEFAULT mode prompts ONLY for the always-required registry vars missing
 * from each app's `.env.local` — the exact gap set `pnpm env:check:local`
 * reports (reused here via `findMissingAlwaysRequiredVars`). It NEVER walks
 * the full ~224-entry registry by default (AC-6).
 *
 * `--review-all` walks EVERY non-platform-injected registry entry
 * applicable to each app, offering a keep/change choice per entry; secret
 * entries show their current value REDACTED in that "keep?" prompt (never
 * echoed in the clear).
 *
 * Prompt shaping per entry:
 *   - `enum`    -> a list picker over `entry.enumValues`.
 *   - `boolean` -> a yes/no confirm.
 *   - secret    -> `howToObtain` (and `helpUrl`, if present) printed BEFORE
 *                  the prompt, then a masked password input.
 *   - `number`  -> a validated text input enforcing the min/max bounds
 *                  introspected from the real per-app Zod schemas (reused
 *                  as-is from `buildConstraints()` in
 *                  `generate-env-registry-json.ts` — this wizard does not
 *                  re-implement Zod introspection).
 *   - plain string/url -> a text input, defaulted to `exampleValue` as a hint.
 *
 * Deviation from the spec brief: this script targets the LOCAL/tsx world
 * (root `scripts/*.ts`, run under Node via the pnpm workspace), which does
 * NOT have `@clack/prompts` on its dependency graph — that package is only
 * a direct dependency of the separate bun-standalone `scripts/server-tools`
 * package (see that package's own `env-set.ts` for the `@clack/prompts`
 * wizard, T-019). The established prompt library for root-level interactive
 * scripts is `@inquirer/prompts` (already a root devDependency, used by
 * `scripts/cli/direct.ts` / `interactive.ts`) — this file follows that
 * existing convention instead of introducing a new dependency.
 *
 * WRITE strategy: answers are written back to the app's `.env.local` via
 * `upsertDotenv()`, which updates existing `KEY=` lines IN PLACE (preserving
 * every other line — comments, blank lines, unrelated keys, ordering) and
 * appends genuinely new keys under a single clearly-labeled managed section
 * at the end of the file. This is a deliberately conservative "minimum
 * viable" comment-preservation strategy: it only rewrites a line when that
 * line's key is actually being changed, and it never reformats or reorders
 * anything else.
 *
 * All prompting for every app happens BEFORE any file is written, and a
 * cancelled prompt (Ctrl+C) aborts the whole run with zero writes — never a
 * partial write across some-but-not-all apps.
 *
 * Usage:
 *   pnpm env:set
 *   pnpm env:set --review-all
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirm, input, password, select } from '@inquirer/prompts';
import type { AppId, EnvVarDefinition } from '../packages/config/src/env-registry-types.js';
import { ENV_REGISTRY } from '../packages/config/src/env-registry.js';
import { findMissingAlwaysRequiredVars, readDotenvFile } from './check-env-local.js';
import { type EnvVarConstraint, buildConstraints } from './generate-env-registry-json.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

/**
 * Maps each app to its local dotenv file path. Duplicated (not imported)
 * from `check-env-local.ts`, mirroring the same duplication already
 * established by `check-env-rules.ts` — `docker` and `seed` are pseudo-apps
 * with no `.env.local` of their own.
 */
const DOTENV_PATHS: Record<AppId, string | null> = {
    api: resolve(ROOT, 'apps/api/.env.local'),
    web: resolve(ROOT, 'apps/web/.env.local'),
    admin: resolve(ROOT, 'apps/admin/.env.local'),
    mobile: resolve(ROOT, 'apps/mobile/.env.local'),
    docker: null,
    seed: null
};

/** Header written above newly-appended keys in a `.env.local` file. */
const MANAGED_SECTION_HEADER = '# --- Added by `pnpm env:set` (HOS-79 T-018) ---';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown internally when the operator cancels a prompt (Ctrl+C). */
class WizardCancelledError extends Error {
    constructor() {
        super('env:set wizard cancelled by the operator.');
        this.name = 'WizardCancelledError';
    }
}

/**
 * Duck-typing check for `@inquirer/prompts`' `ExitPromptError`, thrown when
 * the operator cancels a prompt. Mirrors `scripts/cli/utils.ts`'s
 * `isExitPromptError` (kept as a local copy rather than a cross-boundary
 * import — `scripts/cli/` is its own typechecked sub-tree).
 */
function isExitPromptError(error: unknown): boolean {
    return (
        error !== null &&
        typeof error === 'object' &&
        'name' in error &&
        (error as { name: string }).name === 'ExitPromptError'
    );
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing — zero I/O)
// ---------------------------------------------------------------------------

/**
 * Computes the DEFAULT-mode prompt set for one app: every always-required
 * registry entry missing from that app's parsed `.env.local` values.
 * Reuses {@link findMissingAlwaysRequiredVars} (the same gap logic
 * `pnpm env:check:local` reports) rather than re-deriving it, then resolves
 * each gap's key back to its full {@link EnvVarDefinition} so the caller has
 * enough metadata to shape a prompt.
 *
 * Deliberately NEVER returns more than the always-required gaps — this is
 * the AC-6 guarantee that `env:set` (no flags) never walks the full ~224
 * entry registry.
 *
 * @param input - The full registry, the app's current local dotenv values,
 *   and which app to compute gaps for.
 * @returns The registry entries that are missing, in registry order.
 */
export function selectGapsToPrompt(input: {
    registry: readonly EnvVarDefinition[];
    localValues: Readonly<Record<string, string>>;
    app: AppId;
}): EnvVarDefinition[] {
    const { registry, localValues, app } = input;
    const gaps = findMissingAlwaysRequiredVars({ appId: app, localValues, registry });
    const gapKeys = new Set(gaps.map((gap) => gap.key));
    return registry.filter((entry) => gapKeys.has(entry.name));
}

/**
 * Computes the `--review-all`-mode prompt set for one app: every registry
 * entry applicable to that app, EXCLUDING `platformInjected` vars (those are
 * injected by the platform/CI and must never be set by hand — prompting for
 * one would be nonsensical). Sorted by category then name, matching the
 * deterministic ordering used elsewhere (`generate-env-examples.ts`).
 *
 * @param input - The full registry and which app to scope to.
 * @returns Every applicable, non-platform-injected entry for `app`.
 */
export function selectReviewAllEntries(input: {
    registry: readonly EnvVarDefinition[];
    app: AppId;
}): EnvVarDefinition[] {
    const { registry, app } = input;
    return registry
        .filter((entry) => entry.apps.includes(app) && !entry.platformInjected)
        .sort((a, b) => {
            const catCmp = a.category.localeCompare(b.category);
            return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
        });
}

/**
 * Merges `updates` into the raw text of a `.env.local` file, preserving
 * every existing line (comments, blank lines, unrelated keys) as-is.
 *
 * Behavior:
 *   - A key already present as a `KEY=...` line has ONLY that line replaced
 *     with `KEY=<new value>` — nothing else on the line, nor any other
 *     line, is touched.
 *   - A key with no existing `KEY=...` line is appended at the end of the
 *     file under a single {@link MANAGED_SECTION_HEADER} comment (added
 *     once, even when appending multiple new keys in the same call).
 *   - The result always ends with exactly one trailing newline.
 *
 * Pure — takes/returns plain strings, no filesystem access — so it is
 * covered directly by unit tests without touching disk.
 *
 * @param input - The original file content (empty string for a file that
 *   does not exist yet) and the key/value pairs to upsert.
 * @returns The new full file content to write.
 */
export function upsertDotenv(input: {
    original: string;
    updates: Readonly<Record<string, string>>;
}): string {
    const { original, updates } = input;
    const remaining = new Map(Object.entries(updates));

    const lines = original === '' ? [] : original.split('\n');
    // `String.split('\n')` on a trailing-newline-terminated string produces a
    // trailing empty element; drop it so we can re-append exactly one
    // newline at the end regardless of the original's line-ending style.
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }

    const keyLinePattern = /^([A-Za-z_][A-Za-z0-9_]*)=/;
    const updatedLines = lines.map((line) => {
        const match = keyLinePattern.exec(line);
        if (!match) return line;
        const key = match[1] as string;
        if (!remaining.has(key)) return line;
        const value = remaining.get(key) as string;
        remaining.delete(key);
        return `${key}=${value}`;
    });

    if (remaining.size === 0) {
        return `${updatedLines.join('\n')}\n`;
    }

    const appended: string[] = [];
    if (updatedLines.some((line) => line.length > 0)) {
        appended.push('');
    }
    appended.push(MANAGED_SECTION_HEADER);
    for (const [key, value] of remaining) {
        appended.push(`${key}=${value}`);
    }

    return `${[...updatedLines, ...appended].join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Interactive prompting (not pure — talks to the terminal)
// ---------------------------------------------------------------------------

/** Renders a `(min/max)` hint suffix for a numeric prompt message, or ''. */
function formatBoundsHint(constraint: EnvVarConstraint | undefined): string {
    const numeric = constraint?.numeric;
    if (!numeric || (numeric.min === undefined && numeric.max === undefined)) return '';
    const min = numeric.min ?? '-inf';
    const max = numeric.max ?? '+inf';
    return ` (${min}..${max})`;
}

/**
 * Prompts for one registry entry's value, shaped by its `type` (and, for
 * secrets, its `howToObtain`/`helpUrl`). In `'review'` mode, first asks
 * whether to keep the current value (redacted for secrets) — answering
 * "keep" skips the type-specific prompt entirely.
 *
 * @returns The new value to write, or `undefined` when the operator chose
 *   to keep the current value unchanged (review mode only).
 * @throws {WizardCancelledError} when the operator cancels any prompt.
 */
async function promptForEntry(params: {
    entry: EnvVarDefinition;
    constraint: EnvVarConstraint | undefined;
    currentValue: string | undefined;
    mode: 'gap' | 'review';
}): Promise<string | undefined> {
    const { entry, constraint, currentValue, mode } = params;

    try {
        if (mode === 'review') {
            const currentLabel = entry.secret
                ? currentValue
                    ? '***REDACTED***'
                    : '<unset>'
                : (currentValue ?? '<unset>');
            const keep = await confirm({
                message: `${entry.name} — keep current value (${currentLabel})?`,
                default: true
            });
            if (keep) return undefined;
        }

        if (entry.secret) {
            if (entry.howToObtain) console.log(`  ${entry.howToObtain}`);
            if (entry.helpUrl) console.log(`  More info: ${entry.helpUrl}`);
        }

        if (entry.type === 'enum' && entry.enumValues && entry.enumValues.length > 0) {
            return await select({
                message: `${entry.name} — ${entry.description}`,
                choices: entry.enumValues.map((value) => ({ name: value, value }))
            });
        }

        if (entry.type === 'boolean') {
            const value = await confirm({
                message: `${entry.name} — ${entry.description}`,
                default: currentValue === 'true'
            });
            return String(value);
        }

        if (entry.secret) {
            return await password({
                message: `${entry.name} — ${entry.description}`,
                mask: '*',
                validate: (value) => (value ? true : 'Value cannot be empty.')
            });
        }

        if (entry.type === 'number') {
            const boundsHint = formatBoundsHint(constraint);
            return await input({
                message: `${entry.name} — ${entry.description}${boundsHint}`,
                default: entry.exampleValue,
                validate: (value) => {
                    if (!value) return 'Value cannot be empty.';
                    const num = Number(value);
                    if (Number.isNaN(num)) return 'Must be a number.';
                    const min = constraint?.numeric?.min;
                    const max = constraint?.numeric?.max;
                    if (min !== undefined && num < min) return `Must be >= ${min}.`;
                    if (max !== undefined && num > max) return `Must be <= ${max}.`;
                    return true;
                }
            });
        }

        // Plain string / url.
        return await input({
            message: `${entry.name} — ${entry.description}`,
            default: entry.exampleValue,
            validate: (value) => (value ? true : 'Value cannot be empty.')
        });
    } catch (err) {
        if (isExitPromptError(err)) throw new WizardCancelledError();
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const HELP = `
pnpm env:set [--review-all]

Interactive local env-var wizard. Fills gaps in each app's .env.local.

DEFAULT (no flags): prompts ONLY for always-required registry vars missing
from each app's .env.local (the same gaps 'pnpm env:check:local' reports).

--review-all: walks EVERY registry entry applicable to each app, offering a
              keep/change choice per entry (secrets shown redacted).

Flags:
  --review-all   Review every applicable entry instead of only gaps.
  --help, -h     Show this help.
`.trim();

/**
 * Runs the wizard end-to-end: prompts for every app's applicable entries
 * (gap-only by default, all-entries with `--review-all`), then writes every
 * app's collected answers to its `.env.local` — but only after ALL prompting
 * across ALL apps has completed without cancellation (a cancelled run writes
 * nothing, per spec).
 */
async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(HELP);
        return;
    }
    const reviewAll = argv.includes('--review-all');
    const constraints = buildConstraints();

    const pendingWrites: Array<{
        readonly dotenvPath: string;
        readonly updates: Record<string, string>;
    }> = [];

    try {
        for (const [appId, dotenvPath] of Object.entries(DOTENV_PATHS) as Array<
            [AppId, string | null]
        >) {
            if (dotenvPath === null) continue;

            const localValues = readDotenvFile({ filePath: dotenvPath });
            const entries = reviewAll
                ? selectReviewAllEntries({ registry: ENV_REGISTRY, app: appId })
                : selectGapsToPrompt({ registry: ENV_REGISTRY, localValues, app: appId });

            if (entries.length === 0) continue;

            console.log(
                `\n── ${appId} — ${entries.length} var(s) to ${reviewAll ? 'review' : 'fill'} ──`
            );

            const updates: Record<string, string> = {};
            for (const entry of entries) {
                const value = await promptForEntry({
                    entry,
                    constraint: constraints[entry.name],
                    currentValue: localValues[entry.name],
                    mode: reviewAll ? 'review' : 'gap'
                });
                if (value !== undefined) {
                    updates[entry.name] = value;
                }
            }

            if (Object.keys(updates).length > 0) {
                pendingWrites.push({ dotenvPath, updates });
            }
        }
    } catch (err) {
        if (err instanceof WizardCancelledError) {
            console.log(`\n${err.message} No changes written.`);
            return;
        }
        throw err;
    }

    if (pendingWrites.length === 0) {
        console.log('\nNothing to update — every checked app is already up to date.');
        return;
    }

    for (const { dotenvPath, updates } of pendingWrites) {
        const original = existsSync(dotenvPath) ? readFileSync(dotenvPath, 'utf-8') : '';
        const next = upsertDotenv({ original, updates });
        writeFileSync(dotenvPath, next, 'utf-8');
        console.log(`✓ Wrote ${Object.keys(updates).length} var(s) to ${dotenvPath}`);
    }
}

// Run only when invoked as a script (skip when imported by tests).
const isMainModule =
    process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
    });
}
