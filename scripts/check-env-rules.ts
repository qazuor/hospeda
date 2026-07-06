#!/usr/bin/env tsx

/**
 * @file check-env-rules.ts
 * @description Evaluates every cross-check rule
 * (`packages/config/src/env-cross-checks.ts`) whose `appliesTo` includes
 * `'local'` against each app's local dotenv (`.env.local`) values (HOS-79 —
 * Env Var Management Hardening, gap G-3).
 *
 * Produces a THREE-STATE result per rule — `'pass' | 'fail' | 'partial'` —
 * NEVER a boolean (Risk R-2 / AC-3):
 *   - `pass`:    every referenced value is present, and all of them are equal.
 *   - `fail`:    every referenced value is present, but they are NOT all equal.
 *   - `partial`: at least one referenced `(app, key)` pair has no value
 *               locally. Non-failing — a fresh checkout, or a dev-only
 *               partial configuration, is expected to leave an optional
 *               cross-app secret unset on one side. Presence gaps are
 *               `pnpm env:check:local`'s job, not this check's.
 *
 * A missing `.env.local` file is treated as "every var in that app is
 * absent," never a crash (mirrors `check-env-local.ts` / spec §8 UX).
 *
 * Usage:
 *   pnpm env:check:rules
 *
 * Exit codes:
 *   0 — every applicable rule resolves to 'pass' or 'partial'
 *   1 — at least one applicable rule resolves to 'fail'
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CrossCheckRule } from '../packages/config/src/env-cross-checks.js';
import { CROSS_CHECK_RULES } from '../packages/config/src/env-cross-checks.js';
import type { AppId } from '../packages/config/src/env-registry-types.js';
import { readDotenvFile } from './check-env-local.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Three-state outcome of evaluating a single cross-check rule. Deliberately
 * NEVER a boolean (Risk R-2, AC-3) — a rule with an unset side must be
 * distinguishable from both a genuine match and a genuine mismatch.
 */
export type RuleStatus = 'pass' | 'fail' | 'partial';

/** Result of evaluating one {@link CrossCheckRule} against a set of values. */
export interface RuleEvaluationResult {
    /** The evaluated rule's {@link CrossCheckRule.id}. */
    readonly ruleId: string;
    /** Three-state outcome — see {@link RuleStatus}. */
    readonly status: RuleStatus;
    /** Human-readable explanation of the outcome, naming the affected side(s). */
    readonly detail: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

/**
 * Maps each app to its local dotenv file path. Mirrors the `DOTENV_PATHS`
 * convention in `check-env-local.ts`; `docker` and `seed` are pseudo-apps
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

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Evaluates a single cross-check rule using a `(app, key) -> value` lookup.
 *
 * Only the `'equals'` comparator exists today ({@link CrossCheckRule.comparator}
 * is a single-literal type) — this is the only comparison implemented. A
 * future comparator would need a corresponding branch here.
 *
 * @param input - The rule to evaluate, plus a lookup function returning the
 *   current value for a given `(app, key)` pair (`undefined`/empty string
 *   means unset).
 * @returns The three-state {@link RuleEvaluationResult}.
 */
export function evaluateCrossCheckRule(input: {
    rule: CrossCheckRule;
    getValue: (app: AppId, key: string) => string | undefined;
}): RuleEvaluationResult {
    const { rule, getValue } = input;

    const resolved = rule.compare.map((side) => ({
        app: side.app,
        key: side.key,
        value: getValue(side.app, side.key)
    }));

    const missingSides = resolved.filter((side) => !side.value);

    if (missingSides.length > 0) {
        const missingDesc = missingSides.map((s) => `${s.app}:${s.key}`).join(', ');
        return {
            ruleId: rule.id,
            status: 'partial',
            detail: `partial: unset on ${missingDesc} — skipping comparison (not a failure).`
        };
    }

    const firstValue = resolved[0]?.value;
    const allEqual = resolved.every((side) => side.value === firstValue);

    if (allEqual) {
        return {
            ruleId: rule.id,
            status: 'pass',
            detail: 'pass: all sides match.'
        };
    }

    const sidesDesc = resolved.map((s) => `${s.app}:${s.key}`).join(', ');
    return {
        ruleId: rule.id,
        status: 'fail',
        detail: `fail: values differ between ${sidesDesc}.`
    };
}

/**
 * Reads every app's local dotenv values needed to evaluate `'local'`-scoped
 * rules. Apps with no local dotenv file of their own (`docker`, `seed`) map
 * to an empty object. A missing file is treated as "every var absent," never
 * a crash (delegated to {@link readDotenvFile}).
 *
 * @returns A per-app map of parsed dotenv key/value pairs.
 */
export function loadAllLocalValues(): Record<AppId, Record<string, string>> {
    const result = {} as Record<AppId, Record<string, string>>;

    for (const [appId, dotenvPath] of Object.entries(DOTENV_PATHS) as Array<
        [AppId, string | null]
    >) {
        result[appId] = dotenvPath === null ? {} : readDotenvFile({ filePath: dotenvPath });
    }

    return result;
}

/**
 * Filters {@link CROSS_CHECK_RULES} to those applicable to the `'local'`
 * execution context and evaluates each against the given per-app values.
 *
 * @param input - Per-app local dotenv values (as returned by
 *   {@link loadAllLocalValues}) and, optionally, the rule set to evaluate
 *   (defaults to {@link CROSS_CHECK_RULES}, injectable for tests).
 * @returns One {@link RuleEvaluationResult} per applicable rule.
 */
export function evaluateLocalRules(input: {
    localValues: Readonly<Record<AppId, Record<string, string>>>;
    rules?: readonly CrossCheckRule[];
}): RuleEvaluationResult[] {
    const { localValues, rules = CROSS_CHECK_RULES } = input;
    const getValue = (app: AppId, key: string): string | undefined => localValues[app]?.[key];

    return rules
        .filter((rule) => rule.appliesTo.includes('local'))
        .map((rule) => evaluateCrossCheckRule({ rule, getValue }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Evaluates every `'local'`-applicable cross-check rule against each app's
 * `.env.local` and reports the three-state outcome for each.
 */
function main(): void {
    const localValues = loadAllLocalValues();
    const results = evaluateLocalRules({ localValues });

    for (const result of results) {
        const icon = result.status === 'pass' ? '✓' : result.status === 'partial' ? '…' : '✗';
        console.log(`${icon} [${result.ruleId}] ${result.detail}`);
    }

    const failures = results.filter((r) => r.status === 'fail');
    const partials = results.filter((r) => r.status === 'partial');
    const passes = results.filter((r) => r.status === 'pass');

    console.log(
        `\n${passes.length} passed, ${partials.length} partial (non-failing), ${failures.length} failed.`
    );

    if (failures.length > 0) {
        console.error(
            '\nFix: make the failing rule(s) hold the same value across all listed (app, key) sides.'
        );
        process.exitCode = 1;
    }
}

// Run only when invoked as a script (skip when imported by tests).
const isMainModule =
    process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    main();
}
