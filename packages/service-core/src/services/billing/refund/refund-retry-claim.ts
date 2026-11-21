import { getDb } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { Pool } from 'pg';
import { ServiceError } from '../../../types';

/** Namespace of the per-refund retry lock, hashed with the refund id like the cron locks. */
const RETRY_LOCK_PREFIX = 'refund-retry:';

/**
 * Single-flight per refund (HOS-2516 review): a second retry of the same refund while one runs
 * (a double click, two admins) is refused with `REFUND_RETRY_IN_PROGRESS` instead of racing the
 * first one into a false `PROVIDER_REFUND_ALREADY_CITED`.
 *
 * HOS-2538: action 14's panel settlement of a refund stuck on stale calls takes the SAME claim. A
 * retry that passed the 24-hour cutoff a moment before may still have its POST in flight; settling
 * the call from the panel meanwhile would pay the refund twice. Whichever runs first holds the
 * claim, and the other answers `REFUND_RETRY_IN_PROGRESS`.
 *
 * Why a session advisory lock on a dedicated connection: the work spans provider I/O, and a
 * transaction (`FOR UPDATE`, `pg_advisory_xact_lock`) must not stay open across it. The session
 * lock holds one idle pool connection for the retry's duration and no transaction. It needs no
 * schema change, and unlike a claim row it cannot go stale: if the process dies, the connection
 * closes and PostgreSQL drops the lock. Same mechanism as `apps/api/src/cron/cron-lock.ts`.
 *
 * Cost: each running retry holds one pool connection idle for its whole duration, on top of the
 * ones its own queries borrow. Retries are rare manual actions, so this stays far below the pool
 * size; many concurrent retries would compete with the API for connections.
 *
 * @param refundId - The refund the claim is for.
 * @param run - The work to run while holding the claim.
 * @returns What `run` returns.
 * @throws ServiceError ALREADY_EXISTS `REFUND_RETRY_IN_PROGRESS` when another holder has it.
 */
export async function withRefundCallClaim<T>(refundId: string, run: () => Promise<T>): Promise<T> {
    const pool = (getDb() as ReturnType<typeof getDb> & { readonly $client: Pool }).$client;
    const client = await pool.connect();
    let destroyClient = false;
    try {
        const lock = await client.query<{ readonly acquired: boolean }>(
            'SELECT pg_try_advisory_lock(hashtext($1 || $2)::bigint) AS acquired',
            [RETRY_LOCK_PREFIX, refundId]
        );
        if (lock.rows[0]?.acquired !== true)
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Another retry or panel settlement of this refund is running',
                undefined,
                'REFUND_RETRY_IN_PROGRESS'
            );
        try {
            return await run();
        } finally {
            try {
                await client.query('SELECT pg_advisory_unlock(hashtext($1 || $2)::bigint)', [
                    RETRY_LOCK_PREFIX,
                    refundId
                ]);
            } catch {
                // A connection whose unlock failed may still hold the lock: never reuse it.
                destroyClient = true;
            }
        }
    } finally {
        client.release(destroyClient);
    }
}
