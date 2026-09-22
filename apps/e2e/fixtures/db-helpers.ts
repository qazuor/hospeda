import { Pool } from 'pg';

/**
 * Direct DB access helpers for E2E tests (SPEC-092).
 *
 * Use ONLY for forcing test fixtures into specific states that cannot be
 * achieved through the public API (e.g. expired trials, past period_end).
 * For everything else, prefer api-helpers (which exercise the real flow).
 *
 * The pool is lazily initialized on first use and reused across the
 * Playwright worker. Call `closeDbPool()` from the global teardown.
 */

/**
 * Default E2E DB URL. Precedence (first non-empty wins):
 *   1. HOSPEDA_E2E_DATABASE_URL  — explicit E2E override (CI, wt:up)
 *   2. HOSPEDA_DATABASE_URL      — what the API process is using (same DB)
 *   3. Hardcoded fallback        — docker-compose.e2e.yml default (port 5433)
 *
 * Without this fallback chain, running the suite against a worktree DB
 * (port 5436) without HOSPEDA_E2E_DATABASE_URL set causes execSQL to
 * attempt port 5433 (the docker-compose default), which either doesn't
 * exist or holds a different DB, making all DB assertions fail silently.
 */
function resolveE2eDbUrl(): string {
    return (
        process.env.HOSPEDA_E2E_DATABASE_URL ??
        process.env.HOSPEDA_DATABASE_URL ??
        'postgresql://hospeda_user:hospeda_pass@localhost:15433/hospeda_e2e'
    );
}

let pool: Pool | null = null;

/**
 * Returns a singleton pg Pool connected to the E2E database.
 * Reads `HOSPEDA_E2E_DATABASE_URL` (or `HOSPEDA_DATABASE_URL`) from env,
 * or falls back to the docker-compose.e2e.yml default on port 5433.
 *
 * @returns shared pg.Pool
 */
export function getDbPool(): Pool {
    if (pool === null) {
        pool = new Pool({
            connectionString: resolveE2eDbUrl(),
            max: 5,
            idleTimeoutMillis: 30_000
        });
    }
    return pool;
}

/**
 * Closes the shared pool. Call from global teardown.
 */
export async function closeDbPool(): Promise<void> {
    if (pool !== null) {
        await pool.end();
        pool = null;
    }
}

/**
 * Executes an arbitrary SQL query via the shared pool.
 *
 * Escape inputs through parameterized placeholders (`$1`, `$2`, ...). Never
 * interpolate user-supplied values into the query string.
 *
 * @param query - SQL query string with `$N` placeholders
 * @param params - Positional parameters
 * @returns Array of result rows (typed as `T`)
 */
export async function execSQL<T extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    params: ReadonlyArray<unknown> = []
): Promise<T[]> {
    const result = await getDbPool().query<T>(query, params as unknown[]);
    return result.rows;
}

/**
 * Reads the set of roles a user holds, from the `user_role` junction table.
 *
 * HOS-296 dropped `users.role`; the hats now live one row each in `user_role`.
 * Tests that used to assert on the scalar (`SELECT role FROM users`) must go
 * through this helper instead — the old query fails at runtime with
 * `column "role" does not exist`, never at typecheck.
 *
 * Assert with `toContain('HOST')` when the test cares that a hat was granted,
 * and with `not.toContain('HOST')` when it cares that one was revoked. Only
 * assert on the whole array when the exact set is the point (e.g. "no extra
 * hat was granted as a side effect") — the result is sorted so such an
 * assertion is stable.
 *
 * @param userId - UUID of the user whose hats to read
 * @returns The held role names, sorted alphabetically (empty when none)
 */
export async function getUserRoles(userId: string): Promise<readonly string[]> {
    const rows = await execSQL<{ role: string }>(
        'SELECT role FROM user_role WHERE user_id = $1 ORDER BY role ASC',
        [userId]
    );
    return rows.map((row) => row.role);
}

/**
 * Takes the HOST hat off a user, leaving every other hat untouched.
 *
 * Used by HOST-07a (idempotency) to simulate a user who was promoted and later
 * demoted. Before HOS-296 this overwrote the single `users.role` scalar with
 * `'USER'`, which was both a demotion AND a wipe of anything else the account
 * held; with multi-role the faithful equivalent is a targeted revoke of the one
 * hat, mirroring what the `archive-abandoned-drafts` cron actually does.
 *
 * The baseline USER hat is granted first (idempotently) so the account can
 * never be left holding zero roles — the same invariant `revokeRole` enforces
 * in production (HOS-296 AC-5). Insert-then-delete, not the reverse, so there
 * is no window in which the user holds nothing.
 *
 * @param userId - UUID of the user to demote
 */
export async function demoteHostToUser(userId: string): Promise<void> {
    await execSQL(
        `INSERT INTO user_role (user_id, role, grant_reason)
         VALUES ($1, 'USER'::role_enum, 'e2e_fixture_demote')
         ON CONFLICT (user_id, role) DO NOTHING`,
        [userId]
    );
    await execSQL(`DELETE FROM user_role WHERE user_id = $1 AND role = 'HOST'::role_enum`, [
        userId
    ]);
}

/**
 * Backdates an accommodation's `updated_at` field by N days.
 * Used by HOST-07e to trigger the archive-abandoned-drafts cron behavior.
 *
 * ## Why this is not a plain UPDATE (HOS-1267)
 *
 * `accommodations` carries `trg_set_updated_at_accommodations`, a `BEFORE
 * UPDATE` trigger running `set_updated_at()`, which assigns
 * `NEW.updated_at := NOW()` unconditionally. A plain
 * `UPDATE ... SET updated_at = <past>` is therefore overwritten before it is
 * stored: the statement reports one row affected, the transaction commits, and
 * the column still holds `NOW()`.
 *
 * That is exactly what this helper did between the VPS migration and HOS-1267.
 * Nobody noticed because its only caller — `host-07e-cron-demote` — was
 * `test.fixme(true)` for the whole period.
 *
 * The write runs inside a transaction with `session_replication_role =
 * 'replica'`, which suppresses ordinary user triggers for that transaction
 * only. `SET LOCAL` on a dedicated client is what keeps it that way: the shared
 * pool hands out a different connection per `execSQL` call, so a plain `SET`
 * would leak the setting onto a connection some other test later borrows, and
 * `ALTER TABLE ... DISABLE TRIGGER` would suppress the trigger for every
 * parallel worker rather than just this one.
 *
 * It then READS THE VALUE BACK and throws if the row is not actually in the
 * past. A fixture that quietly does nothing is worse than one that fails: the
 * test it feeds goes green while asserting about a state that was never set up.
 *
 * @param accommodationId - UUID of the accommodation to backdate.
 * @param days - Number of days to subtract from `updated_at` (positive).
 * @throws When `days` is not a positive finite number, when no row matches, or
 *   when the stored `updated_at` did not actually move into the past.
 */
export async function backdateAccommodation(accommodationId: string, days: number): Promise<void> {
    if (!Number.isFinite(days) || days <= 0) {
        throw new Error(
            `backdateAccommodation: 'days' must be a positive finite number (got ${days})`
        );
    }

    const client = await getDbPool().connect();
    let stored: { updated_at: Date } | undefined;
    try {
        await client.query('BEGIN');
        // Transaction-scoped: reverts on COMMIT/ROLLBACK, and never reaches
        // another connection in the pool.
        await client.query("SET LOCAL session_replication_role = 'replica'");
        const result = await client.query<{ updated_at: Date }>(
            `UPDATE accommodations
                SET updated_at = NOW() - ($1::int * INTERVAL '1 day')
              WHERE id = $2
              RETURNING updated_at`,
            [days, accommodationId]
        );
        await client.query('COMMIT');
        stored = result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    } finally {
        client.release();
    }

    if (!stored) {
        throw new Error(`backdateAccommodation: no accommodation with id ${accommodationId}`);
    }

    // Read-back check. Half the requested offset is a deliberately loose bound:
    // it is far beyond any clock skew, and it fails hard on the only outcome
    // that matters — the trigger having stamped `NOW()` over the write.
    const cutoff = Date.now() - (days / 2) * 24 * 60 * 60 * 1000;
    if (new Date(stored.updated_at).getTime() > cutoff) {
        throw new Error(
            `backdateAccommodation: updated_at for ${accommodationId} is ${stored.updated_at.toISOString()}, ` +
                `which is not ~${days} days in the past. A BEFORE UPDATE trigger has overwritten the ` +
                'backdate — the fixture did nothing, so any test relying on it would assert about a ' +
                'state that was never set up.'
        );
    }
}

/**
 * Forces a user's trial subscription to be expired by setting trial_end_date
 * to a past timestamp.
 *
 * The actual table name and column shape live in the @qazuor/qzpay-core
 * package. This helper hits whatever the running schema exposes; if the
 * billing tables are not present in `hospeda_e2e` yet (HOST-02 onboarding
 * hasn't seeded them), the UPDATE is a no-op (0 rows affected).
 *
 * @param userId - UUID of the user whose trial to expire
 */
export async function forceTrialExpired(userId: string): Promise<void> {
    // The column is `trial_end` (QZPay schema), not `trial_end_date`.
    await execSQL(
        `UPDATE billing_subscriptions
         SET trial_end = NOW() - INTERVAL '1 day',
             current_period_end = NOW() - INTERVAL '1 day'
         WHERE customer_id IN (
             SELECT id FROM billing_customers WHERE external_id = $1
         )
           AND status = 'trialing'`,
        [userId]
    );
}

/**
 * Forces the current period_end on an active paid subscription to be in
 * the past, simulating expiration after cancellation grace period.
 *
 * @param subscriptionId - UUID of billing_subscriptions row
 */
export async function forcePeriodEndPast(subscriptionId: string): Promise<void> {
    await execSQL(
        `UPDATE billing_subscriptions
         SET current_period_end = NOW() - INTERVAL '1 hour'
         WHERE id = $1`,
        [subscriptionId]
    );
}

/**
 * Suspends a user (HOST or otherwise) by setting users.service_suspended = true.
 * Used by ADM-03 helper paths.
 *
 * Note: the `users` table uses a boolean `service_suspended` column, NOT
 * a timestamp `suspended_at` column. The ADM-03 test's DB invariant check
 * was written against the old schema; it is updated to use `service_suspended`.
 *
 * @param userId - UUID
 */
export async function suspendUser(userId: string): Promise<void> {
    await execSQL('UPDATE users SET service_suspended = true WHERE id = $1', [userId]);
}

/**
 * Reverses a suspension.
 *
 * @param userId - UUID
 */
export async function reactivateUser(userId: string): Promise<void> {
    await execSQL('UPDATE users SET service_suspended = false WHERE id = $1', [userId]);
}
