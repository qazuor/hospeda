/**
 * `hops env-doctor <api|web|admin> [--target=prod|staging]` — umbrella that
 * runs `env-reconcile` (scoped to the given app) then `env-check-rules`
 * (filtered to the given app) in sequence, reports BOTH results, and exits
 * non-zero if EITHER sub-check failed (HOS-79 T-017).
 *
 * Mirrors the local `scripts/env-doctor.ts` umbrella (which runs the three
 * zero-network local checks and reports all of them instead of stopping at
 * the first failure) — same "report everything, then decide the exit code"
 * shape, adapted to the two Coolify-backed checks this toolkit ships.
 *
 * Deliberately reuses {@link envReconcile} and {@link envCheckRules} as-is
 * rather than re-implementing their diff/evaluation logic here — this file
 * only adds sequencing + combined reporting.
 */

import { die, log } from '../lib/log.ts';
import { envCheckRules } from './env-check-rules.ts';
import { envReconcile } from './env-reconcile.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops env-doctor <api|web|admin> [--target=prod|staging]

Umbrella that runs, in order:
  1. env-reconcile <app>          — registry-required vars missing on Coolify.
  2. env-check-rules --app=<app>  — cross-app consistency rules touching <app>.

Reports BOTH results (never stops at the first failure) and exits non-zero
if EITHER sub-check failed.

Flags:
  --help, -h    Show this help.

Examples:
  hops --target=staging env-doctor api
  hops --target=prod env-doctor web

Notes:
  Read-only — safe with HOPS_DEFAULT_TARGET (targetPolicy: default-ok).
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

/** One sub-check `env-doctor` runs, in reporting order. */
export interface DoctorSubCheck {
    /** Human-readable name shown in the section header and failure summary. */
    readonly name: string;
    /** Runs the check. Signals failure via `process.exitCode`, like every
     *  other `hops` command — never throws for an ordinary check failure. */
    readonly run: () => Promise<void>;
}

/**
 * Run every sub-check in order, resetting `process.exitCode` to `0` before
 * each so one check's failure can never mask (or be masked by) another's —
 * and so a check that PASSES after an earlier one FAILED doesn't
 * accidentally clear the combined failure state.
 *
 * Exported and injectable (checks are just `{name, run}` pairs) so the
 * aggregation logic is unit-testable with stub checks that flip
 * `process.exitCode` without touching Coolify or the filesystem.
 *
 * @returns The names of the checks that left a non-zero `process.exitCode`
 *   (empty when everything passed). Does NOT restore `process.exitCode` to
 *   its pre-call value — callers own setting the final exit code.
 */
export async function runEnvDoctorChecks(
    checks: readonly DoctorSubCheck[]
): Promise<{ readonly failed: readonly string[] }> {
    const failed: string[] = [];

    for (const check of checks) {
        process.exitCode = 0;
        log.info(`\n── ${check.name} ──`);
        try {
            await check.run();
        } catch (err) {
            // An infra-level THROW (container not found, missing token, an
            // unexpected Coolify client error) must NOT abort the umbrella:
            // record this check as failed and still run the rest, honoring
            // "report BOTH, never stop at the first failure". This is what
            // lets a broken env-reconcile still fall through to env-check-rules
            // (which degrades unreachable apps to `skipped`). Ordinary check
            // failures signal via process.exitCode and never reach here.
            log.error(`${check.name} errored: ${err instanceof Error ? err.message : String(err)}`);
            process.exitCode = 1;
        }
        if (process.exitCode !== undefined && process.exitCode !== 0) {
            failed.push(check.name);
        }
    }

    return { failed };
}

export async function envDoctor(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const positional = args.filter((a) => !a.startsWith('--'));
    const appRaw = positional[0];
    if (!appRaw) {
        die('Missing <kind>. Run with --help for usage.');
    }
    if (!isApp(appRaw)) {
        die(`Unknown app '${appRaw}'. Known: ${KINDS.join(', ')}.`);
    }

    const checks: readonly DoctorSubCheck[] = [
        { name: 'env-reconcile', run: () => envReconcile([appRaw]) },
        { name: 'env-check-rules', run: () => envCheckRules([`--app=${appRaw}`]) }
    ];

    const { failed } = await runEnvDoctorChecks(checks);

    if (failed.length > 0) {
        log.error(`\nenv-doctor: ${failed.length} check(s) failed — ${failed.join(', ')}.`);
        process.exitCode = 1;
    } else {
        log.ok('\nenv-doctor: all checks passed.');
        process.exitCode = 0;
    }
}
