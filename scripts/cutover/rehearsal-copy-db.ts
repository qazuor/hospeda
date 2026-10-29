import type { ReadOnlyClient } from './known-ids.ts';
import { assertStagingDatabase, EnvironmentRefusal } from './staging-sandbox-guards.ts';

/** Session variable both rehearsal-copy tools read. The same name the staging sandbox run uses. */
export const VAR_STAGING_DB = 'CUTOVER_STAGING_DATABASE_URL';

/**
 * Opens the WRITABLE session of a rehearsal-copy tool (HOS-1957) and proves, before returning it,
 * that the server is staging's: `current_database()` and `current_user` must be the staging name
 * and role (the same guard the staging sandbox run uses; production's are both `postgres`). A
 * failed connection or a failed proof refuses, and the session is closed before refusing.
 *
 * @param input - the connection string and the connector (`connectWritable` in production)
 * @returns a writable client on the staging database
 * @throws EnvironmentRefusal when the database cannot be proven to be staging's
 */
export async function openStagingCopy({
    connectionString,
    connectDb
}: {
    readonly connectionString: string;
    readonly connectDb: (input: { readonly connectionString: string }) => Promise<ReadOnlyClient>;
}): Promise<ReadOnlyClient> {
    let client: ReadOnlyClient;
    try {
        client = await connectDb({ connectionString });
    } catch {
        throw new EnvironmentRefusal({
            message: 'could not connect to the database; refusing to run'
        });
    }
    try {
        await assertStagingDatabase({ client });
    } catch (error) {
        await client.end().catch(() => undefined);
        throw error;
    }
    return client;
}
