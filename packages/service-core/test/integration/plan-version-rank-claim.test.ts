/**
 * HOS-2176: pins the plan-version-rank helper's uniqueness machinery without a database. The
 * block claim must hand out distinct block indexes to two claimers of one run directory, and
 * every rank the helper can produce must stay strictly below the smallest fixed rank a fixture
 * writes at or above the helper base and fit the `integer` column.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
    claimRankBlock,
    nextPlanVersionRank,
    PLAN_VERSION_RANK_MAX
} from './services/support/plan-version-rank.js';

describe('plan-version-rank block claim', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'plan-version-rank-claim-'));
    afterAll(() => rmSync(runDir, { recursive: true, force: true }));

    it('hands distinct block indexes to two claimers of the same run directory', () => {
        const first = claimRankBlock(runDir);
        const second = claimRankBlock(runDir);
        expect(first).not.toBe(second);
    });

    it('keeps every possible rank below every fixed fixture rank at or above the base', () => {
        // Smallest fixed rank a fixture writes at or above RANK_BASE: the plan-catalog trio whose
        // top, the sellable+current `1_900_000_002`, lives at plan-catalog-admin-read.test.ts:114.
        const SMALLEST_FIXED_RANK_ABOVE_BASE = 1_900_000_000; // same file, :101
        const INTEGER_MAX = 2_147_483_647; // `plan_version.rank` is an int32 column
        expect(PLAN_VERSION_RANK_MAX).toBeLessThan(SMALLEST_FIXED_RANK_ABOVE_BASE);
        expect(PLAN_VERSION_RANK_MAX).toBeLessThanOrEqual(INTEGER_MAX);
    });

    it('leaves room for a fixture row seeded at drawn + 1 before the next draw', () => {
        // Fixtures seed `rank: version.rank + 1` next to a drawn rank (plan-migration-fixtures.ts,
        // b10-exit-fixtures.ts, paused-increase-fixtures.ts); with a step of 1 that row took the
        // next draw and the next seed failed with 23505 in CI (PR #4736, 33 tests).
        const first = nextPlanVersionRank();
        const second = nextPlanVersionRank();
        expect(second - first).toBeGreaterThan(1);
    });
});
