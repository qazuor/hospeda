/**
 * Answers "does CI's API integration suite run these files?" for the
 * `*-exit-ci-wiring` tests (HOS-1891).
 *
 * Those tests used to grep `apps/api/vitest.config.integration.ts` for a
 * literal glob, which passed on a commented-out glob and broke the day the
 * include became the whole tree. This resolves the same include and
 * exclusions the config hands vitest, from the module both read.
 *
 * @module scripts/__tests__/helpers/api-integration-collection
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { isCollectedByApiIntegration } from '../../../apps/api/test/integration/integration-suite';

const API_ROOT = path.resolve(__dirname, '../../../apps/api');

function listTestFiles({ target }: { readonly target: string }): readonly string[] {
    if (!statSync(target).isDirectory()) return [target];
    return readdirSync(target).flatMap((entry) => {
        const full = path.join(target, entry);
        if (statSync(full).isDirectory()) return listTestFiles({ target: full });
        return full.endsWith('.test.ts') ? [full] : [];
    });
}

/**
 * Splits the test files under one API integration path into collected and
 * excluded, using the suite's own include and exclusions.
 *
 * @param input.target - Directory or file relative to `apps/api`
 *   (e.g. `test/integration/billing-refund`).
 * @returns `{ collected, excluded }` as paths relative to `apps/api`. Both are
 *   empty when the path holds no test file, so callers assert `collected` is
 *   non-empty.
 */
export function apiIntegrationCollection({ target }: { readonly target: string }): {
    readonly collected: readonly string[];
    readonly excluded: readonly string[];
} {
    const files = listTestFiles({ target: path.join(API_ROOT, target) }).map((full) =>
        path.relative(API_ROOT, full).split(path.sep).join('/')
    );
    const collected = files.filter((file) => isCollectedByApiIntegration({ file }).collected);
    return { collected, excluded: files.filter((file) => !collected.includes(file)) };
}

/**
 * Whether the `test-integration` job's steps run both halves of the suite
 * since HOS-1775 split it: the turbo run over every other package, and the
 * sharded API run.
 *
 * @param input.runs - The job's `run:` lines.
 * @returns true when both commands are present.
 */
export function integrationJobRunsBothSuites({
    runs
}: {
    readonly runs: readonly string[];
}): boolean {
    return (
        runs.some((run) => run.startsWith('pnpm test:integration')) &&
        runs.some((run) => run.startsWith('pnpm --filter hospeda-api test:integration'))
    );
}
