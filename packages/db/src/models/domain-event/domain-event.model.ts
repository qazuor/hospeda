/**
 * @file domain-event.model.ts
 *
 * Insert-and-read model for the append-only `domain_event` table (HOS-1424,
 * unit U2, AC:U2:11).
 *
 * **Why NOT BaseModelImpl:** the table is append-only. `BaseModelImpl` hands
 * every model `update`, `softDelete`, `hardDelete` and `restore`, and assumes
 * `deleted_at`/`updated_at` columns this table deliberately does not have. A
 * model that exposed those would invite the exact writes the table's trigger
 * rejects. So this model offers three operations and nothing else: write one
 * event, read an entity's events, read a correlation's events.
 *
 * The correlation id is always passed in by the caller: `@repo/db` never reads
 * the API's request context.
 */

import { and, asc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    type DomainEventActorType,
    type DomainEventChange,
    type DomainEventType,
    domainEvent,
    type SelectDomainEvent
} from '../../schemas/domain-event/domain_event.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

const ENTITY_NAME = 'domainEvent';

/** Input of {@link DomainEventModel.insert}. */
export interface InsertDomainEventInput {
    /** What happened, from the closed catalog. */
    readonly eventType: DomainEventType;
    /** Kind of entity the event is about. */
    readonly entityType: string;
    /** Id of that entity. */
    readonly entityId: string;
    /** Account that caused it; omit for a job or the provider. */
    readonly actorId?: string | null;
    /** Kind of actor. */
    readonly actorType: DomainEventActorType;
    /** Correlation of the intention (or job item) that produced it. */
    readonly correlationId: string;
    /** Changed fields. Content fields carry only their name. Defaults to none. */
    readonly changes?: readonly DomainEventChange[];
    /** Why, when the operation admits a reason. */
    readonly reason?: string | null;
    /** When it happened. Defaults to the database's now(). */
    readonly occurredAt?: Date;
    /** Optional transaction: pass the domain transaction to write the event with the change. */
    readonly tx?: DrizzleClient;
}

/** Input of {@link DomainEventModel.findByEntity}. */
export interface FindDomainEventsByEntityInput {
    readonly entityType: string;
    readonly entityId: string;
    readonly tx?: DrizzleClient;
}

/** Input of {@link DomainEventModel.findByCorrelationId}. */
export interface FindDomainEventsByCorrelationInput {
    readonly correlationId: string;
    readonly tx?: DrizzleClient;
}

/** Input of {@link DomainEventModel.existsByEntity}. */
export interface ExistsDomainEventByEntityInput {
    readonly eventType: DomainEventType;
    readonly entityType: string;
    readonly entityId: string;
    readonly tx?: DrizzleClient;
}

/** Input for keyset pagination through a closed set of event types and time range. */
export interface ListDomainEventsByTypesInRangeInput {
    readonly eventTypes: readonly DomainEventType[];
    readonly after: Date;
    readonly until: Date;
    readonly afterEventId?: string;
    readonly limit: number;
    readonly tx?: DrizzleClient;
}

/** Input for counting a closed set of event types in a time range. */
export interface CountDomainEventsByTypesInRangeInput {
    readonly eventTypes: readonly DomainEventType[];
    readonly after: Date;
    readonly until: Date;
    readonly tx?: DrizzleClient;
}

/** Model for the append-only `domain_event` table. */
export class DomainEventModel {
    /** Resolves the transaction client when given, the shared client otherwise. */
    private client(tx?: DrizzleClient): DrizzleClient {
        return tx ?? getDb();
    }

    /** Checks whether an append-only event already exists for this entity and type. */
    async existsByEntity(input: ExistsDomainEventByEntityInput): Promise<boolean> {
        try {
            const rows = await this.client(input.tx)
                .select({ exists: sql<number>`1` })
                .from(domainEvent)
                .where(
                    and(
                        eq(domainEvent.eventType, input.eventType),
                        eq(domainEvent.entityType, input.entityType),
                        eq(domainEvent.entityId, input.entityId)
                    )
                )
                .limit(1);
            return rows.length > 0;
        } catch (error) {
            this.fail('existsByEntity', input, error);
        }
    }

    /**
     * Writes one event.
     *
     * @param input - The event and an optional transaction.
     * @returns The written row.
     * @throws DbError if the insert fails (e.g. a type outside the catalog).
     */
    async insert(input: InsertDomainEventInput): Promise<SelectDomainEvent> {
        const logContext = {
            eventType: input.eventType,
            entityType: input.entityType,
            entityId: input.entityId,
            correlationId: input.correlationId
        };
        try {
            const rows = await this.client(input.tx)
                .insert(domainEvent)
                .values({
                    eventType: input.eventType,
                    entityType: input.entityType,
                    entityId: input.entityId,
                    actorId: input.actorId ?? null,
                    actorType: input.actorType,
                    correlationId: input.correlationId,
                    changes: [...(input.changes ?? [])],
                    reason: input.reason ?? null,
                    ...(input.occurredAt ? { occurredAt: input.occurredAt } : {})
                })
                .returning();
            const row = rows[0];
            if (!row) {
                throw new Error('insert returned no row');
            }
            this.logOk('insert', logContext, row);
            return row;
        } catch (error) {
            this.fail('insert', logContext, error);
        }
    }

    /**
     * Reads every event of one entity, oldest first.
     *
     * @param input - Entity type and id.
     * @returns The entity's events.
     * @throws DbError if the query fails.
     */
    async findByEntity(input: FindDomainEventsByEntityInput): Promise<SelectDomainEvent[]> {
        const logContext = { entityType: input.entityType, entityId: input.entityId };
        try {
            const rows = await this.client(input.tx)
                .select()
                .from(domainEvent)
                .where(
                    and(
                        eq(domainEvent.entityType, input.entityType),
                        eq(domainEvent.entityId, input.entityId)
                    )
                )
                .orderBy(asc(domainEvent.occurredAt));
            this.logOk('findByEntity', logContext, rows);
            return rows;
        } catch (error) {
            this.fail('findByEntity', logContext, error);
        }
    }

    /**
     * Reads every event of one correlation, oldest first: the chain of one
     * business intention (NUCLEO/08 §2).
     *
     * @param input - Correlation id.
     * @returns The correlation's events.
     * @throws DbError if the query fails.
     */
    async findByCorrelationId(
        input: FindDomainEventsByCorrelationInput
    ): Promise<SelectDomainEvent[]> {
        const logContext = { correlationId: input.correlationId };
        try {
            const rows = await this.client(input.tx)
                .select()
                .from(domainEvent)
                .where(eq(domainEvent.correlationId, input.correlationId))
                .orderBy(asc(domainEvent.occurredAt));
            this.logOk('findByCorrelationId', logContext, rows);
            return rows;
        } catch (error) {
            this.fail('findByCorrelationId', logContext, error);
        }
    }

    /** Lists events in (after, until], ordered by id for stable keyset pagination. */
    async listByTypesInRange(
        input: ListDomainEventsByTypesInRangeInput
    ): Promise<SelectDomainEvent[]> {
        if (input.eventTypes.length === 0 || input.limit <= 0) return [];
        const predicates = [
            inArray(domainEvent.eventType, [...input.eventTypes]),
            gt(domainEvent.occurredAt, input.after),
            lte(domainEvent.occurredAt, input.until)
        ];
        if (input.afterEventId) predicates.push(gt(domainEvent.id, input.afterEventId));
        return (input.tx ?? getDb())
            .select()
            .from(domainEvent)
            .where(and(...predicates))
            .orderBy(asc(domainEvent.id))
            .limit(input.limit);
    }

    /** Counts events in the half-open/closed interval (after, until]. */
    async countByTypesInRange(input: CountDomainEventsByTypesInRangeInput): Promise<number> {
        if (input.eventTypes.length === 0) return 0;
        const [row] = await (input.tx ?? getDb())
            .select({ count: sql<number>`count(*)::int` })
            .from(domainEvent)
            .where(
                and(
                    inArray(domainEvent.eventType, [...input.eventTypes]),
                    gt(domainEvent.occurredAt, input.after),
                    lte(domainEvent.occurredAt, input.until)
                )
            );
        return row?.count ?? 0;
    }

    /** Logs a successful query; logging never breaks the operation. */
    private logOk(method: string, context: unknown, result: unknown): void {
        try {
            logQuery(ENTITY_NAME, method, context, result);
        } catch {}
    }

    /** Logs and rethrows as a {@link DbError} that keeps the original error as `cause`. */
    private fail(method: string, context: unknown, error: unknown): never {
        const err = error instanceof Error ? error : new Error(String(error));
        try {
            logError(ENTITY_NAME, method, context, err);
        } catch {}
        throw new DbError(ENTITY_NAME, method, context, err.message, err);
    }
}

/** Singleton instance of {@link DomainEventModel}. */
export const domainEventModel = new DomainEventModel();
