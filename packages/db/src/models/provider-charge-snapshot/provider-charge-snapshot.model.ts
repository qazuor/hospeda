import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    type InsertProviderChargeSnapshot,
    providerChargeSnapshots
} from '../../schemas/vertical/provider-charge-snapshot.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Ordered persistence operations for provider charge snapshots. */
export class ProviderChargeSnapshotModel {
    /** Store a read unless a later observation already won the race. */
    async upsertOrdered(input: {
        readonly row: InsertProviderChargeSnapshot;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly written: boolean }> {
        const [row] = await (input.tx ?? getDb())
            .insert(providerChargeSnapshots)
            .values(input.row)
            .onConflictDoUpdate({
                target: [providerChargeSnapshots.provider, providerChargeSnapshots.chargeId],
                set: {
                    authorizationId: sql`excluded.authorization_id`,
                    providerCreatedAt: sql`excluded.provider_created_at`,
                    expiresAt: sql`excluded.expires_at`,
                    status: sql`excluded.status`,
                    purpose: sql`excluded.purpose`,
                    reference: sql`excluded.reference`,
                    declineReason: sql`excluded.decline_reason`,
                    amountMinor: sql`excluded.amount_minor`,
                    refundedAmountMinor: sql`excluded.refunded_amount_minor`,
                    currency: sql`excluded.currency`,
                    chargedBack: sql`excluded.charged_back`,
                    observedAt: sql`excluded.observed_at`
                },
                where: lte(providerChargeSnapshots.observedAt, sql`excluded.observed_at`)
            })
            .returning({ id: providerChargeSnapshots.id });
        return { written: row !== undefined };
    }

    /** Find snapshots for one provider and a set of charge ids. */
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
