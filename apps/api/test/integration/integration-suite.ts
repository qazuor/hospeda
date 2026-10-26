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

const NO_DB_INIT =
    'HOS-1891: never ran in CI; the API answers 500 "Database not initialized" because the file never calls testDb.setup().';
const STALE_STATUS =
    'HOS-1891: never ran in CI; the asserted status list no longer matches what the route answers (mostly 404 for a missing id, 400 on hierarchy). Unverified per file.';
const WHOLE_MODULE_MOCK =
    'HOS-1891: never ran in CI; its whole-module vi.mock of @repo/logger or @repo/service-core lacks an export the app now imports.';
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
        reason: NO_DB_INIT,
        files: [
            'test/integration/accommodation/get-by-id.test.ts',
            'test/integration/accommodation/get-by-slug.test.ts',
            'test/integration/accommodation/get-stats.test.ts',
            'test/integration/accommodation/get-summary.test.ts',
            'test/integration/accommodation/list-enhanced.test.ts',
            'test/integration/accommodation/list-sorts.test.ts',
            'test/integration/accommodation/list.test.ts',
            'test/integration/attraction/list.test.ts',
            'test/integration/destination/list-enhanced.test.ts',
            'test/integration/destination/list.test.ts',
            'test/integration/event-organizer/list.test.ts',
            'test/integration/event/list.test.ts',
            'test/integration/owner-promotion/public.test.ts',
            'test/integration/post/list.test.ts',
            'test/integration/post/middleware-stack.test.ts',
            'test/integration/post/performance-rate-limit.test.ts',
            'test/integration/sponsorship/protected.test.ts'
        ]
    }),
    ...byReason({
        reason: STALE_STATUS,
        files: [
            'test/integration/accommodation-reviews/admin-crud.test.ts',
            'test/integration/accommodation/create.test.ts',
            'test/integration/accommodation/delete-faq.test.ts',
            'test/integration/accommodation/get-faqs.test.ts',
            'test/integration/accommodation/post-faq.test.ts',
            'test/integration/accommodation/put-faq.test.ts',
            'test/integration/accommodation/update.test.ts',
            'test/integration/attraction/hard-delete.test.ts',
            'test/integration/attraction/patch.test.ts',
            'test/integration/attraction/restore.test.ts',
            'test/integration/destination-reviews/admin-crud.test.ts',
            'test/integration/destination/hierarchy.test.ts',
            'test/integration/event-location/hard-delete.test.ts',
            'test/integration/event-location/list.test.ts',
            'test/integration/event-location/patch.test.ts',
            'test/integration/event-location/restore.test.ts',
            'test/integration/event-organizer/hard-delete.test.ts',
            'test/integration/event-organizer/patch.test.ts',
            'test/integration/event-organizer/restore.test.ts',
            'test/integration/sponsorship/admin-list.test.ts'
        ]
    }),
    ...byReason({
        reason: WHOLE_MODULE_MOCK,
        files: [
            'test/integration/accommodation/relations.test.ts',
            'test/integration/billing-routes.test.ts',
            'test/integration/error-handling.test.ts',
            'test/integration/middleware-interactions.test.ts',
            'test/integration/middleware-stack.test.ts',
            'test/integration/performance-stack.test.ts',
            'test/integration/real-user-scenarios.test.ts',
            'test/integration/sponsor-user-flow.test.ts',
            'test/integration/sponsorship-purchase-analytics.test.ts'
        ]
    }),
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
