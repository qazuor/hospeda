import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';

/** Transaction-bound persistence operations for Partner applications. */
export const partnerApplicationModel = {
    /** Inserts a pending application and returns its generated identifier. */
    async insertPending(args: {
        readonly tx: DrizzleClient;
        readonly email: string;
    }): Promise<{ readonly id: string }> {
        const result = await args.tx.execute(sql`
            INSERT INTO partner_application (email, status, deadlines_version)
            VALUES (${args.email}, 'PENDING', (SELECT max("version") FROM "vertical_deadline_version"))
            RETURNING id`);
        const row = result.rows[0];
        if (!row) throw new Error('Partner application insert did not return an id');
        return { id: String(row.id) };
    }
};
