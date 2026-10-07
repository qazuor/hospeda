import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KnownIds, KnownIdsReader } from './types.ts';

/** Minimal slice of a Postgres client: enough to read, nothing else is used. */
export interface ReadOnlyClient {
    readonly query: (sql: string) => Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
    readonly end: () => Promise<void>;
}

/** A connected client plus the call that opens it. */
interface PgClientCtor {
    new (config: {
        connectionString: string;
        options: string;
    }): ReadOnlyClient & {
        connect: () => Promise<void>;
    };
}

/**
 * Selects ids ONLY: never an email, a name or any other column. One query per family,
 * `UNION` so a duplicate id across tables is returned once.
 */
const PREAPPROVAL_IDS_SQL = `
    SELECT mp_subscription_id AS id FROM billing_subscriptions WHERE mp_subscription_id IS NOT NULL
    UNION
    SELECT mp_subscription_id FROM billing_addon_purchases WHERE mp_subscription_id IS NOT NULL
    UNION
    SELECT mp_subscription_id FROM billing_plan_price_change_targets WHERE mp_subscription_id IS NOT NULL`;
const PLAN_IDS_SQL = `
    SELECT mp_preapproval_plan_id AS id FROM billing_mp_plans WHERE mp_preapproval_plan_id IS NOT NULL
    UNION
    SELECT mp_preapproval_plan_id FROM billing_mp_addon_plans WHERE mp_preapproval_plan_id IS NOT NULL
    UNION
    SELECT mp_preapproval_plan_id FROM billing_pending_checkouts WHERE mp_preapproval_plan_id IS NOT NULL`;

function toIds({ rows }: { readonly rows: readonly Record<string, unknown>[] }): readonly string[] {
    return rows.map((row) => String(row.id)).filter((id) => id.length > 0);
}

/**
 * Reads the ids the old database knows, inside a READ ONLY transaction on a session
 * that is read-only by default. The table list is the old system's (built from `main`).
 *
 * @param input - a connected read-only client
 * @returns the known plan and preapproval ids
 */
export async function readKnownIds({
    client
}: {
    readonly client: ReadOnlyClient;
}): Promise<KnownIds> {
    await client.query('BEGIN READ ONLY');
    try {
        const preapprovals = await client.query(PREAPPROVAL_IDS_SQL);
        const plans = await client.query(PLAN_IDS_SQL);
        return { preapprovalIds: toIds(preapprovals), planIds: toIds(plans) };
    } finally {
        await client.query('ROLLBACK');
    }
}

/**
 * Opens a connection that cannot write: the session is read-only by default, so even
 * a bug in this script cannot modify the old database.
 *
 * `pg` is resolved from the db package's install instead of being added as a root
 * dependency; that is dependency resolution only, no code of that package is used.
 *
 * @param input - connection string from the operator's session
 * @returns a connected read-only client
 */
export async function connectReadOnly({
    connectionString
}: {
    readonly connectionString: string;
}): Promise<ReadOnlyClient> {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const requireFromDb = createRequire(path.resolve(here, '../../packages/db/package.json'));
    const { Client } = requireFromDb('pg') as { Client: PgClientCtor };
    const client = new Client({ connectionString, options: '-c default_transaction_read_only=on' });
    await client.connect();
    return client;
}

/**
 * Builds the {@link KnownIdsReader} the run uses against the old database.
 *
 * @param input - connection string of the old database
 * @returns a reader that connects, reads ids, and always closes
 */
export function createKnownIdsReader({
    connectionString
}: {
    readonly connectionString: string;
}): KnownIdsReader {
    return async () => {
        const client = await connectReadOnly({ connectionString });
        try {
            return await readKnownIds({ client });
        } finally {
            await client.end();
        }
    };
}
