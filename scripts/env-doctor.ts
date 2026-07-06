/**
 * env:doctor — umbrella that runs the three zero-network local env checks
 * (usage, local, rules) and reports ALL of their results in one pass, instead
 * of stopping at the first failure, so an operator sees every problem at once
 * (HOS-79 T-013). Exits non-zero if ANY sub-check failed.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

/** One sub-check the doctor runs. */
interface DoctorCheck {
    /** Human-readable name (also the pnpm script name). */
    readonly name: string;
    /** Sibling script file executed via tsx. */
    readonly script: string;
}

/** The three local checks, in reporting order. */
export const DOCTOR_CHECKS: readonly DoctorCheck[] = [
    { name: 'env:check:usage', script: 'check-env-usage.ts' },
    { name: 'env:check:local', script: 'check-env-local.ts' },
    { name: 'env:check:rules', script: 'check-env-rules.ts' }
];

/** Runs one check and returns its process exit code (0 = pass). */
export type CheckRunner = (input: { script: string }) => number;

/** Default runner: executes a sibling script via tsx, inheriting stdio. */
const defaultRunner: CheckRunner = ({ script }) => {
    const result = spawnSync('pnpm', ['exec', 'tsx', join(SCRIPTS_DIR, script)], {
        stdio: 'inherit'
    });
    return result.status ?? 1;
};

/**
 * Runs every check and collects the names that failed. Runs ALL checks
 * regardless of individual failures (report-all, never stop-at-first), so the
 * operator gets a complete picture in a single invocation.
 *
 * @param input.checks - Checks to run (defaults to {@link DOCTOR_CHECKS}).
 * @param input.runner - Injected runner (defaults to a tsx subprocess); the
 *                        seam exists so tests can exercise the aggregation
 *                        logic without spawning real processes.
 * @returns The names of the checks that failed (empty when all passed).
 */
export function runDoctor(input: { checks?: readonly DoctorCheck[]; runner?: CheckRunner } = {}): {
    readonly failed: readonly string[];
} {
    const checks = input.checks ?? DOCTOR_CHECKS;
    const runner = input.runner ?? defaultRunner;
    const failed: string[] = [];

    for (const check of checks) {
        console.log(`\n── ${check.name} ──`);
        const code = runner({ script: check.script });
        if (code !== 0) {
            failed.push(check.name);
        }
    }

    return { failed };
}

// Run only when invoked as a script (skip when imported by tests).
const isMainModule =
    process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    const { failed } = runDoctor();
    if (failed.length > 0) {
        console.error(`\nenv:doctor: ${failed.length} check(s) failed — ${failed.join(', ')}.`);
        process.exitCode = 1;
    } else {
        console.log('\nenv:doctor: all checks passed.');
    }
}
