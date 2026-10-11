import type { Pool } from 'pg';

/** Swallows only the FATAL admin_shutdown sent by PostgreSQL during DROP DATABASE FORCE. */
export function ignoreAdminShutdown(error: Error & { readonly code?: string }): void {
    if (error.code === '57P01') return;
    throw error;
}

/** Adds admin_shutdown handlers to a pool and every client as it connects. */
export function protectScratchPool({ pool }: { readonly pool: Pool }): void {
    pool.on('error', ignoreAdminShutdown);
    pool.on('connect', (client) => client.on('error', ignoreAdminShutdown));
}

/** Waits up to five seconds for all backends connected to a scratch database to leave. */
export async function waitForNoConnections({
    admin,
    database
}: {
    readonly admin: Pool;
    readonly database: string;
}): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const result = await admin.query<{ count: string }>(
            'SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = $1',
            [database]
        );
        if (Number(result.rows[0]?.count ?? 0) === 0) return;
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
}
