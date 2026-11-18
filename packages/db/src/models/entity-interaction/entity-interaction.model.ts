/**
 * @file entity-interaction.model.ts
 *
 * Lean, standalone model for the `entity_interactions` append-only telemetry
 * table (HOS-2256). Same shape and reasoning as `PartnerLogoClickModel` and
 * `EntityViewModel`: no `BaseModelImpl`, because it would inherit `softDelete()`
 * and `update()` against columns this table intentionally omits.
 *
 * This spec only WRITES: insert, monthly rollup and purge. The aggregation
 * queries that read the data belong to HOS-2261 and are added to this file.
 *
 * @see packages/db/src/schemas/entity-interaction/entity_interaction.dbschema.ts
 * @see packages/db/src/models/partner/partner-logo-click.model.ts - the mould.
 */

import type { EntityInteractionKind, TrackableInteractionEntityType } from '@repo/schemas';
import { getLocalMonthWindow } from '@repo/utils';
import { lt, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import type {
    InsertEntityInteraction,
    SelectEntityInteraction
} from '../../schemas/entity-interaction/entity_interaction.dbschema.ts';
import { entityInteractions } from '../../schemas/entity-interaction/entity_interaction.dbschema.ts';
import { NIL_EVENT_ID_SQL } from '../../schemas/entity-interaction/entity_interaction_monthly_rollup.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Input to record a single interaction. */
export interface InsertInteractionInput {
    /** Entity type the interaction happened on. */
    readonly entityType: TrackableInteractionEntityType;
    /** UUID of the entity. */
    readonly entityId: string;
    /** What the visitor did. */
    readonly kind: EntityInteractionKind;
    /** Venue event the interaction refers to, for event kinds only. */
    readonly eventId?: string | undefined;
    /** Salted daily hash of the visitor fingerprint. Never a raw IP. */
    readonly visitorHash: string;
}

/** Input to purge interactions older than a threshold. */
export interface PurgeInteractionsOlderThanInput {
    /** Rows with `occurred_at < NOW() - interval '<days> days'` are hard-deleted. */
    readonly days: number;
}

/**
 * Standalone model for the `entity_interactions` telemetry table.
 *
 * All methods accept an optional `tx`; when omitted they use the singleton from `getDb()`.
 */
export class EntityInteractionModel {
    /** Returns the provided tx if available, otherwise the global db client. */
    private getClient(tx?: DrizzleClient): DrizzleClient {
        return tx ?? getDb();
    }

    /**
     * Appends a single interaction. No synchronous dedup (insert-always, like
     * `entity_views`); deduplication is applied at query time.
     *
     * @param input - The interaction to record.
     * @param tx - Optional transaction client.
     * @returns The inserted row.
     * @throws {DbError} If the database operation fails.
     */
    async insertInteraction(
        input: InsertInteractionInput,
        tx?: DrizzleClient
    ): Promise<SelectEntityInteraction> {
        const db = this.getClient(tx);
        const logContext = {
            entityType: input.entityType,
            entityId: input.entityId,
            kind: input.kind
        };

        try {
            const row: InsertEntityInteraction = {
                entityType: input.entityType,
                entityId: input.entityId,
                kind: input.kind,
                eventId: input.eventId ?? null,
                visitorHash: input.visitorHash
            };

            const [inserted] = await db.insert(entityInteractions).values(row).returning();

            if (!inserted) {
                throw new Error('Insert returned no row');
            }

            try {
                logQuery('entityInteractions', 'insertInteraction', logContext, {
                    id: inserted.id
                });
            } catch {}

            return inserted;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('entityInteractions', 'insertInteraction', logContext, err);
            } catch {}
            throw new DbError('entityInteractions', 'insertInteraction', logContext, err.message);
        }
    }

    /**
     * Aggregates one calendar month of interactions into
     * `entity_interaction_monthly_rollups`, for every (entity, kind, event) that has any.
     *
     * A single `INSERT ... SELECT ... ON CONFLICT DO UPDATE`, so a re-run over a
     * month whose source rows still exist CORRECTS the stored totals instead of
     * duplicating them. Month boundaries are resolved in TypeScript (local
     * midnights as UTC instants), never with `DATE_TRUNC ... AT TIME ZONE` in
     * SQL, for the two reasons documented in `PartnerLogoClickModel.rollUpMonth`
     * (the statement could not execute, and it was not sargable).
     *
     * `total` uses the same 30-minute bucket rule as the live views window.
     * The conflict target repeats the `coalesce(event_id, nil)` expression of
     * the unique index, because a plain unique index treats NULLs as distinct.
     *
     * @param input.month - Any date inside the month to roll up.
     * @param tx - Optional transaction client.
     * @returns The number of rollup rows written or updated.
     * @throws {DbError} If the database operation fails.
     */
    async rollUpMonth(input: { readonly month: Date }, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const { monthStart, nextMonthStart, monthLabel } = getLocalMonthWindow({
            instant: input.month
        });
        const logContext = { month: monthLabel };

        try {
            const nilEvent = sql.raw(`'${NIL_EVENT_ID_SQL}'::uuid`);
            const result = await db.execute(sql`
                INSERT INTO entity_interaction_monthly_rollups
                    (entity_type, entity_id, kind, event_id, month, total, unique_visitors)
                SELECT
                    entity_type,
                    entity_id,
                    kind,
                    event_id,
                    ${monthLabel}::date,
                    COUNT(DISTINCT (
                        visitor_hash,
                        FLOOR(EXTRACT(EPOCH FROM occurred_at) / 1800)
                    ))::int,
                    COUNT(DISTINCT visitor_hash)::int
                FROM entity_interactions
                WHERE occurred_at >= ${monthStart}
                  AND occurred_at < ${nextMonthStart}
                GROUP BY
                    entity_type, entity_id, kind, event_id
                ON CONFLICT (entity_type, entity_id, kind, (coalesce(event_id, ${nilEvent})), month)
                DO UPDATE SET
                    total = EXCLUDED.total,
                    unique_visitors = EXCLUDED.unique_visitors
            `);

            const written = (result as { rowCount?: number | null }).rowCount ?? 0;

            try {
                logQuery('entityInteractions', 'rollUpMonth', logContext, { written });
            } catch {}

            return written;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('entityInteractions', 'rollUpMonth', logContext, err);
            } catch {}
            throw new DbError('entityInteractions', 'rollUpMonth', logContext, err.message);
        }
    }

    /**
     * Hard-deletes rows with `occurred_at < NOW() - interval '<days> days'`.
     *
     * Called by the same TTL cron that purges `entity_views`: `visitor_hash` is
     * a fingerprint and must not be retained indefinitely. The monthly rollup
     * keeps the NUMBERS after the fingerprints are gone.
     *
     * @param input.days - Retention threshold in days.
     * @param tx - Optional transaction client.
     * @returns The number of rows deleted.
     * @throws {DbError} If the database operation fails.
     */
    async purgeOlderThan(
        input: PurgeInteractionsOlderThanInput,
        tx?: DrizzleClient
    ): Promise<number> {
        const { days } = input;
        const db = this.getClient(tx);
        const logContext = { days };

        try {
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const deleted = await db
                .delete(entityInteractions)
                .where(lt(entityInteractions.occurredAt, cutoff))
                .returning({ id: entityInteractions.id });

            try {
                logQuery('entityInteractions', 'purgeOlderThan', logContext, {
                    deleted: deleted.length
                });
            } catch {}

            return deleted.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('entityInteractions', 'purgeOlderThan', logContext, err);
            } catch {}
            throw new DbError('entityInteractions', 'purgeOlderThan', logContext, err.message);
        }
    }
}

/** Singleton instance of EntityInteractionModel for use across the application. */
export const entityInteractionModel = new EntityInteractionModel();
