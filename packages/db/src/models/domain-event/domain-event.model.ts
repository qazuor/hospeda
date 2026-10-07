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

import { and, asc, eq } from 'drizzle-orm';
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

/** Model for the append-only `domain_event` table. */
export class DomainEventModel {
    /** Resolves the transaction client when given, the shared client otherwise. */
    private client(tx?: DrizzleClient): DrizzleClient {
        return tx ?? getDb();
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
