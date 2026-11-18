import { eq } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { allianceLeads } from '../../schemas/alliance/alliance_lead.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError } from '../../utils/logger.ts';

/**
 * AllianceLeadModel — DB access for inbound alliance leads (HOS-277).
 *
 * Provides standard CRUD via BaseModelImpl, including soft-delete/restore
 * (the table carries a `deletedAt` column, unlike the retired lead-intake table). Custom
 * query methods (e.g. findByKind, findByStatus) should be added here as the
 * admin inbox is built.
 */
export class AllianceLeadModel extends BaseModelImpl<typeof allianceLeads.$inferSelect> {
    protected table = allianceLeads;
    public entityName = 'allianceLeads';

    protected getTableName(): string {
        return 'allianceLeads';
    }

    /**
     * Loads a lead with `SELECT ... FOR UPDATE`, holding the row lock until the
     * transaction ends (HOS-2339). Two concurrent provisioning retries
     * serialize on it, and the loser re-reads `provisionedHostTradeId` after
     * the lock instead of creating a second listing.
     *
     * Must run on a transaction client to be meaningful.
     *
     * @param id - Lead UUID.
     * @param tx - Transaction client holding the lock.
     * @returns The lead row (soft-deleted rows are returned, the caller checks), or `null`.
     * @throws DbError if the database query fails.
     */
    async findByIdForUpdate(
        id: string,
        tx?: DrizzleClient
    ): Promise<typeof allianceLeads.$inferSelect | null> {
        const db = this.getClient(tx);
        const logContext = { id };
        try {
            const rows = await db
                .select()
                .from(allianceLeads)
                .where(eq(allianceLeads.id, id))
                .for('update');
            return (rows[0] as typeof allianceLeads.$inferSelect | undefined) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByIdForUpdate', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByIdForUpdate', logContext, err.message, err);
        }
    }
}

/** Singleton instance of AllianceLeadModel. */
export const allianceLeadModel = new AllianceLeadModel();
