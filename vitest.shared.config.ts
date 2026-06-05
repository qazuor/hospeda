/**
 * Shared Vitest base configuration for the Hospeda monorepo.
 *
 * This file is the SINGLE SOURCE OF TRUTH for concurrency and pool settings.
 * Every package-level vitest.config.ts should extend it via mergeConfig().
 *
 * ## Machine-safety concurrency cap (SC-3 / SPEC-188 Track A)
 *
 * Peak concurrent test processes = turbo --concurrency × vitest maxForks.
 * leo-laptop (16 cores / 62 GB) hangs under >~57 simultaneous forks (the
 * old layout: turbo concurrency 10 × 3 forks = 30, but with build tasks also
 * running, effective peak was higher).
 *
 * Formula: safe_ceiling = cores - 4 = 16 - 4 = 12
 *   Split as: turbo concurrency 4 × maxForks 3 = 12 peak processes locally.
 *   Leaves 4 cores for the OS, IDE, and turbo orchestration overhead.
 *
 * On CI (GitHub-hosted ubuntu-latest, one VM per shard) the machine-safety
 * constraint does not apply — each shard runs in isolation. CI sets
 * VITEST_MAX_FORKS=4 to get more throughput per shard without risking any
 * shared machine. See .github/workflows/ci.yml test-unit job env block.
 *
 * To override locally (e.g. on a beefier machine):
 *   VITEST_MAX_FORKS=6 pnpm test
 *
 * @see docs/guides/test-performance.md for full rationale and re-measure procedure.
 */

/** Default maxForks when VITEST_MAX_FORKS is not set (safe for leo-laptop). */
const LOCAL_MAX_FORKS = 3;

/**
 * Reads the VITEST_MAX_FORKS env var and returns the parsed integer value.
 * Falls back to LOCAL_MAX_FORKS if the var is absent or not a valid integer.
 *
 * @returns Number of vitest fork workers to use.
 */
export function resolveMaxForks(): number {
    const raw = process.env.VITEST_MAX_FORKS;
    if (raw !== undefined) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return LOCAL_MAX_FORKS;
}

/**
 * Shared base test configuration.
 *
 * Use mergeConfig(sharedTestConfig, { test: { ...overrides } }) in each
 * package's vitest.config.ts. Do NOT spread this directly — mergeConfig
 * handles deep merging of arrays (setupFiles, include, etc.) correctly.
 *
 * @example
 * ```ts
 * import { mergeConfig } from 'vitest/config';
 * import { sharedTestConfig } from '../../vitest.shared.config';
 *
 * export default mergeConfig(sharedTestConfig, {
 *   test: {
 *     setupFiles: ['./test/setup.ts'],
 *     include: ['src/**\/*.test.ts'],
 *   },
 * });
 * ```
 */
export const sharedTestConfig = {
    test: {
        /**
         * Use forks (child_process) pool.
         * - apps/api: forks required (threads segfaults — SIGSEGV measured 2026-06-02
         *   with better-auth native deps). Never change to threads for api.
         * - Pure schema/util packages: threads spike deferred to Track B (T-012).
         *   Keep forks as the safe default until each package is validated.
         */
        pool: 'forks' as const,
        poolOptions: {
            forks: {
                /**
                 * Env-driven fork count. Default 3 locally (safe for 16c machine).
                 * CI overrides to 4 via VITEST_MAX_FORKS env var in ci.yml.
                 *
                 * Combined with turbo concurrency 4, local peak = 4 × 3 = 12 forks.
                 * CI peak per shard = 1 package at a time × 4 forks = 4 forks.
                 */
                maxForks: resolveMaxForks()
            }
        }
    }
} as const;
