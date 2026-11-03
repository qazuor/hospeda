import { getDb } from '@repo/db';
import type { Pool, PoolClient } from 'pg';

/** A lock decision, with completion released only after the handler settles. */
export type CronLockDecision<T> =
    | { readonly acquired: true; readonly completion: Promise<T> }
    | { readonly acquired: false; readonly holderRunId: string | null };

/** Run a handler under a fleet-wide, non-blocking session advisory lock. */
export async function withCronLock<T>(args: {
    readonly name: string;
    readonly runId: string;
    readonly handler: () => Promise<T>;
}): Promise<CronLockDecision<T>> {
    const pool = (getDb() as ReturnType<typeof getDb> & { readonly $client: Pool }).$client;
    const client = await pool.connect();
    let lockAcquired = false;
    let clientReleased = false;
    let destroyClient = false;
    try {
        await client.query("SELECT set_config('application_name', $1, false)", [
            `hospeda-cron:${args.runId}`
        ]);
        const lock = await client.query<{ readonly acquired: boolean }>(
            "SELECT pg_try_advisory_lock(hashtext('cron:' || $1)::bigint) AS acquired",
            [args.name]
        );
        lockAcquired = lock.rows[0]?.acquired === true;
        if (!lockAcquired) {
            const keyResult = await client.query<{ readonly key: string }>(
                "SELECT hashtext('cron:' || $1)::bigint::text AS key",
                [args.name]
            );
            const key = BigInt(keyResult.rows[0]?.key ?? '0');
            const unsignedKey = BigInt.asUintN(64, key);
            const high = String((unsignedKey >> 32n) & 0xffff_ffffn);
            const low = String(unsignedKey & 0xffff_ffffn);
            const holder = await client.query<{ readonly application_name: string }>(
                `SELECT a.application_name
                 FROM pg_locks AS l
                 JOIN pg_stat_activity AS a USING (pid)
                 WHERE l.locktype = 'advisory'
                   AND l.granted
                   AND l.objsubid = 1
                   AND l.classid = $1::oid
                   AND l.objid = $2::oid
                   AND a.pid <> pg_backend_pid()
                 LIMIT 1`,
                [high, low]
            );
            client.release();
            clientReleased = true;
            const match = holder.rows[0]?.application_name.match(/^hospeda-cron:(.+)$/);
            return { acquired: false, holderRunId: match?.[1] ?? null };
        }

        const completion = Promise.resolve()
            .then(args.handler)
            .finally(async () => {
                try {
                    await client.query(
                        "SELECT pg_advisory_unlock(hashtext('cron:' || $1)::bigint)",
                        [args.name]
                    );
                    lockAcquired = false;
                    await client.query("SELECT set_config('application_name', '', false)");
                } catch {
                    destroyClient = true;
                } finally {
                    client.release(destroyClient);
                    clientReleased = true;
                }
            });
        return { acquired: true, completion };
    } catch (error) {
        if (lockAcquired) destroyClient = true;
        if (!clientReleased) client.release(destroyClient);
        throw error;
    }
}

/** Return the pool client type used by the dedicated advisory lock connection. */
export type CronLockClient = PoolClient;
