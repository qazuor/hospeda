/**
 * Collision-free `plan_version.rank` values for integration fixtures (HOS-2176).
 *
 * `uq_plan_version_sellable_current_rank` (`packages/db/src/schemas/vertical/plan-catalog.dbschema.ts`)
 * is a partial unique index on `(vertical, rank)` applied while the version is sellable AND
 * current, and the integration database is shared by every worker of a run. Seeding that rank with
 * a `Math`-module random draw of about `1e8` gave two concurrent workers a birthday-collision
 * window (~1 in a few thousand runs lost one test to `23505`); this helper replaces that draw so
 * two workers can never produce the same value.
 *
 * The value is built from three layers, each closing one collision source:
 *
 * - **slot** — the vitest worker index (`VITEST_POOL_ID`, falling back to `process.pid % 64`).
 *   Concurrent workers never share the pool id, so their rank sub-ranges are disjoint for the
 *   whole lifetime of the database (one run: the global setup recreates it).
 * - **bucket** — the module load time modulo 4096. Files served by the same worker (same slot)
 *   load far apart in time, so they land in different buckets.
 * - **counter** — a monotonic per-file counter, so a fixture that seeds several versions never
 *   draws the same value twice; later rows keep ranking above earlier ones inside a file.
 *
 * The result spans `[1_000_000_000, 1_268_435_455]`: far above every fixed rank a fixture writes
 * (they stay small or are computed relative to another row), far below the `integer` column max
 * (`2_147_483_647`), and no fixture may assert an absolute value against it.
 */

const RANK_BASE = 1_000_000_000;
/** Concurrent vitest workers this scheme separates; `maxWorkers: 3` uses a fraction of it. */
const SLOT_COUNT = 64;
const SLOT_STRIDE = 4_194_304; // 2^22
const BUCKET_COUNT = 4_096; // 2^12, times the 2^10 counter fills one slot stride exactly.
const COUNTER_CAP = 1_024; // 2^10

let counter = 0;
const slot = resolveSlot();
const bucket = Date.now() % BUCKET_COUNT;

/** The vitest worker index, or the process id when running outside a vitest worker. */
function resolveSlot(): number {
    const poolId = Number(process.env['VITEST_POOL_ID']);
    if (Number.isInteger(poolId) && poolId >= 0) return poolId % SLOT_COUNT;
    return process.pid % SLOT_COUNT;
}

/**
 * Returns the next collision-free rank for a `plan_version` row seeded by an integration fixture.
 *
 * @throws When one test file consumed more than {@linkcode COUNTER_CAP} ranks, which no fixture
 *   approaches; failing loudly beats silently wrapping into a duplicate.
 */
export function nextPlanVersionRank(): number {
    if (counter >= COUNTER_CAP) {
        throw new Error('plan-version-rank fixture counter exceeded its per-file cap');
    }
    const rank = RANK_BASE + slot * SLOT_STRIDE + bucket * COUNTER_CAP + counter;
    counter += 1;
    return rank;
}
