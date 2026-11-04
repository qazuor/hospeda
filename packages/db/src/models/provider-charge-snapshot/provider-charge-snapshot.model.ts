import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    type InsertProviderChargeSnapshot,
    providerChargeSnapshots
} from '../../schemas/vertical/provider-charge-snapshot.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Ordered persistence operations for provider charge snapshots. */
export class ProviderChargeSnapshotModel {
    /**
     * Stores a live read. Ordered by our observation instant: a read observed earlier than the
     * stored one never overwrites its fields. Two fields only ever grow at the provider, so they
     * are merged monotonically instead (a slow stale read can never erase a refund or a
     * chargeback a newer read already saw, and an older read that saw more still raises them).
     *
     * @param input.row - The row built from the live read.
     * @param input.tx - Optional transaction.
     * @returns `written` is true when the stored row changed.
     */
    async upsertOrdered(input: {
        readonly row: InsertProviderChargeSnapshot;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly written: boolean }> {
        const table = providerChargeSnapshots;
        const newer = sql`excluded.observed_at >= ${table.observedAt}`;
        const pick = (column: string, current: unknown) =>
            sql`CASE WHEN ${newer} THEN excluded.${sql.raw(column)} ELSE ${current} END`;
        const [row] = await (input.tx ?? getDb())
            .insert(table)
            .values(input.row)
            .onConflictDoUpdate({
                target: [table.provider, table.chargeId],
                set: {
                    authorizationId: pick('authorization_id', table.authorizationId),
                    providerCreatedAt: pick('provider_created_at', table.providerCreatedAt),
                    expiresAt: pick('expires_at', table.expiresAt),
                    status: pick('status', table.status),
                    purpose: pick('purpose', table.purpose),
                    reference: pick('reference', table.reference),
                    declineReason: pick('decline_reason', table.declineReason),
                    amountMinor: pick('amount_minor', table.amountMinor),
                    currency: pick('currency', table.currency),
                    refundedAmountMinor: sql`GREATEST(${table.refundedAmountMinor}, excluded.refunded_amount_minor)`,
                    chargedBack: sql`${table.chargedBack} OR excluded.charged_back`,
                    observedAt: sql`GREATEST(${table.observedAt}, excluded.observed_at)`
                },
                where: sql`${newer} OR excluded.refunded_amount_minor > ${table.refundedAmountMinor} OR (excluded.charged_back AND NOT ${table.chargedBack})`
            })
            .returning({ id: table.id });
        return { written: row !== undefined };
    }

    /**
     * Find snapshots for one provider and a set of charge ids.
     *
     * @param input.provider - Provider code of the snapshots.
     * @param input.chargeIds - Provider charge ids to look up; empty returns no rows.
     * @param input.tx - Optional transaction.
     * @returns The stored rows, in no particular order.
     */
    async findByChargeIds(input: {
        readonly provider: string;
        readonly chargeIds: readonly string[];
        readonly tx?: DrizzleClient;
    }): Promise<ReadonlyArray<typeof providerChargeSnapshots.$inferSelect>> {
        if (input.chargeIds.length === 0) return [];
        return (input.tx ?? getDb())
            .select()
            .from(providerChargeSnapshots)
            .where(
                and(
                    eq(providerChargeSnapshots.provider, input.provider),
                    inArray(providerChargeSnapshots.chargeId, [...input.chargeIds])
                )
            );
    }
}

/** Shared provider charge snapshot model. */
export const providerChargeSnapshotModel = new ProviderChargeSnapshotModel();
