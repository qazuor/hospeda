/**
 * Collision-free `plan_version.rank` values for integration fixtures (HOS-2176).
 *
 * `uq_plan_version_sellable_current_rank` (`packages/db/src/schemas/vertical/plan-catalog.dbschema.ts`)
 * is a partial unique index on `(vertical, rank)` applied while the version is sellable AND
 * current, and the integration database is shared by every worker of a run. Seeding that rank with
 * a `Math`-module random draw of about `1e8` gave two concurrent workers a birthday-collision
 * window (~1 in a few thousand runs lost one test to `23505`); this helper replaces that draw with
 * values that are **unique per run by construction** — not probabilistically rare: impossible to
 * repeat within one run, whatever the worker count, file order, or timing.
 *
 * Every vitest worker loads this module in a fresh forked process, once per test file. Each load
 * claims one rank block by exclusively creating the marker file `<runDir>/<n>` with
 * `fs.openSync(path, 'wx')`, walking n upward past `EEXIST`. Exclusive creation is atomic across
 * processes, so the i-th claim of a run always gets block n = i: two files served by the same
 * worker (fresh fork each, same `VITEST_POOL_ID`) and files served by different workers can never
 * occupy the same block. (The previous time-of-day bucket, `Date.now() % 4096`, repeated across
 * processes every 4096 seconds and could not offer that guarantee.)
 *
 * - **runDir** — created fresh by the integration global setup (`global-setup.ts`) for every run
 *   (one `mkdtempSync` directory, announced to the forked workers through the
 *   `HOSPEDA_SERVICE_TEST_RANK_DIR` environment variable, removed at teardown), so claim markers
 *   never survive into another run. Outside vitest, with the variable unset, the module falls back
 *   to its own private `mkdtempSync` directory.
 * - **counter** — a monotonic per-file counter, so a fixture that seeds several versions never
 *   draws the same value twice; later rows keep ranking above earlier ones inside a file.
 *
 * The result spans `[1_000_000_000, 1_008_389_631]` — far above every small rank a fixture writes,
 * strictly below the smallest fixed rank any fixture writes at or above the base (the
 * `1_900_000_000..1_900_000_002` trio of `plan-catalog-admin-read.test.ts`, whose sellable+current
 * member is the highest fixed rank in the tree), far below the `integer` column max
 * (`2_147_483_647`), and no fixture may assert an absolute value against it. The claim unit test
 * (`test/integration/plan-version-rank-claim.test.ts`) pins that bound.
 */
import { closeSync, mkdtempSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RANK_BASE = 1_000_000_000;
/** Rank blocks available per run, one claimed per test file; runs use a fraction of it. */
const MAX_BLOCKS = 8_192; // 2^13
const COUNTER_CAP = 1_024; // 2^10; max observed use: 5 per file

/** Highest rank the helper can ever return; pinned below every fixed fixture rank above the base
 * by the claim unit test. */
export const PLAN_VERSION_RANK_MAX = RANK_BASE + MAX_BLOCKS * COUNTER_CAP + (COUNTER_CAP - 1);

/**
 * Claims the next free rank block index in a run directory by exclusively creating
 * `<runDir>/<n>`, walking n upward past `EEXIST`. Exclusive creation is atomic across processes,
 * so concurrent claimers of the same directory always receive distinct indexes.
 *
 * @param runDir Directory holding this run's claim markers; must exist and start empty.
 * @returns The claimed block index, in `[0, MAX_BLOCKS)`.
 * @throws When the directory exists but every `MAX_BLOCKS` blocks of the run are taken, which no
 *   run approaches, or when the directory cannot be opened at all; failing loudly beats silently
 *   sharing a block (a shared block would reintroduce the `23505` collisions).
 */
export function claimRankBlock(runDir: string): number {
    for (let block = 0; block < MAX_BLOCKS; block++) {
        try {
            closeSync(openSync(join(runDir, String(block)), 'wx'));
            return block;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
    }
    throw new Error(
        `plan-version-rank claim exhausted its ${MAX_BLOCKS} blocks per run in ${runDir}`
    );
}

/** The rank-block directory announced by the integration global setup, or a private directory
 * created for this process when running outside vitest. */
function resolveRunDir(): string {
    return (
        process.env.HOSPEDA_SERVICE_TEST_RANK_DIR ||
        mkdtempSync(join(tmpdir(), 'hospeda-service-plan-rank-'))
    );
}

let counter = 0;
const block = claimRankBlock(resolveRunDir());

/**
 * Returns the next rank for a `plan_version` row seeded by an integration fixture. Ranks are
 * unique per run by construction: distinct files hold distinct blocks, and the per-file counter
 * never repeats.
 *
 * @throws When one test file consumed more than {@linkcode COUNTER_CAP} ranks, which no fixture
 *   approaches; failing loudly beats silently wrapping into a duplicate.
 */
export function nextPlanVersionRank(): number {
    if (counter >= COUNTER_CAP) {
        throw new Error('plan-version-rank fixture counter exceeded its per-block cap');
    }
    const rank = RANK_BASE + block * COUNTER_CAP + counter;
    counter += 1;
    return rank;
}
