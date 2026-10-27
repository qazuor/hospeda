/**
 * Single source of truth for which files the API integration suite collects
 * (HOS-1891).
 *
 * The suite used to be a hand-written allowlist of folders, and 179 of the 385
 * files under `test/integration/**` matched none of them: they never ran in CI,
 * so nobody noticed that 54 of them were broken. The include is now the whole
 * tree, and the only way to keep a file out is to list it here WITH a reason.
 *
 * Consumed by `vitest.config.integration.ts` (the config CI runs), by
 * `test/static-guards/integration-suite-coverage.guard.test.ts` (which fails on
 * a stale or reasonless exclusion), and by the `scripts/__tests__/*-exit-ci-wiring`
 * tests (which ask whether a file is collected instead of grepping the config).
 *
 * Paths are relative to `apps/api`.
 *
 * @module test/integration/integration-suite
 */
import { matchesGlob } from 'node:path';
import { configDefaults } from 'vitest/config';

/** Every integration test under `apps/api/test/integration`. */
export const API_INTEGRATION_INCLUDE = ['test/integration/**/*.test.ts'] as const;

/** One file kept out of the integration suite, and why. */
export interface ApiIntegrationExclusion {
    /** Path relative to `apps/api`. Must exist on disk. */
    readonly file: string;
    /** Why it is excluded and what brings it back. Never empty. */
    readonly reason: string;
}

const MISC =
    'HOS-1891: never ran in CI; fails for a file-specific reason (health, app, auth actor, reviews permissions, missing vertical seed). Needs its own diagnosis.';

const byReason = ({
    reason,
    files
}: {
    readonly reason: string;
    readonly files: readonly string[];
}): readonly ApiIntegrationExclusion[] => files.map((file) => ({ file, reason }));

/**
 * Files kept out of the API integration suite. Shrink this list; do not grow
 * it: the coverage guard freezes its length and requires an issue id in every
 * reason.
 */
export const API_INTEGRATION_EXCLUSIONS: readonly ApiIntegrationExclusion[] = [
    {
        file: 'test/integration/ai/vault-roundtrip.test.ts',
        reason: 'HOS-247: non-deterministically flaky: the credential-create route fires syncAiProviderModels after responding, racing testDb.clean(). Comes back once the create flow is deterministic under test.'
    },
    ...byReason({
        reason: MISC,
        files: [
            'test/integration/amenity/vertical-filter.content.test.ts',
            'test/integration/app.test.ts',
            'test/integration/auth/auth.test.ts',
            'test/integration/auth/signup-as-host.test.ts',
            'test/integration/conversation-guest-idor.integration.test.ts',
            'test/integration/feature/vertical-filter.content.test.ts',
            'test/integration/health/health.test.ts',
            'test/integration/reviews/permission-boundaries.test.ts'
        ]
    })
];

/**
 * Whether the API integration suite collects a file, by the same include and
 * exclude the config hands vitest.
 *
 * @param input.file - Path relative to `apps/api` (e.g. `test/integration/x/y.test.ts`).
 * @returns `{ collected }` — true when included and not excluded.
 */
export function isCollectedByApiIntegration({ file }: { readonly file: string }): {
    readonly collected: boolean;
} {
    const included = API_INTEGRATION_INCLUDE.some((glob) => matchesGlob(file, glob));
    // vitest also drops vitest's own default excludes (node_modules, dist, ...).
    const excluded =
        configDefaults.exclude.some((glob) => matchesGlob(file, glob)) ||
        API_INTEGRATION_EXCLUSIONS.some((exclusion) => exclusion.file === file);
    return { collected: included && !excluded };
}
