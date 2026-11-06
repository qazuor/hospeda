import type { DrizzleClient } from '@repo/db';
import { getDb, setDb } from '@repo/db';
import { testDb } from '../../e2e/setup/test-database';

/** Run a production composition root against seeded rows and roll every write back. */
export async function withCompositionRollback(
    run: (tx: DrizzleClient) => Promise<void>
): Promise<void> {
    const db = getDb();
    await testDb.withRollback(async (tx: DrizzleClient) => {
        setDb(tx);
        try {
            await run(tx);
        } finally {
            setDb(db);
        }
    });
}
