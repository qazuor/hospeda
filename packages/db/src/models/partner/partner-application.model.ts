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
    },

    /** Locks a Partner application and reads the fields required to resolve its wait. */
    async lockById(args: { readonly tx: DrizzleClient; readonly applicationId: string }): Promise<{
        readonly id: string;
        readonly email: string;
        readonly status: string;
        readonly waitCancelledAt: Date | null;
    } | null> {
        const result = await args.tx.execute(sql`
            SELECT id, email, status, wait_cancelled_at
            FROM partner_application
            WHERE id = ${args.applicationId}
            FOR UPDATE`);
        const row = result.rows[0];
        if (!row) return null;
        return {
            id: String(row.id),
            email: String(row.email),
            status: String(row.status),
            waitCancelledAt: row.wait_cancelled_at as Date | null
        };
    },

    /** Cancels a rejected application's wait without changing its machine state. */
    async cancelWait(args: {
        readonly tx: DrizzleClient;
        readonly applicationId: string;
        readonly at: Date;
        readonly actorId: string;
    }): Promise<void> {
        await args.tx.execute(sql`
            UPDATE partner_application
            SET wait_cancelled_at = ${args.at}, wait_cancelled_by = ${args.actorId}
            WHERE id = ${args.applicationId}`);
    }
};
