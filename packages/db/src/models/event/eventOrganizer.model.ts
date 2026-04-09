import type { EventOrganizer } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { eventOrganizers } from '../../schemas/event/event_organizer.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for the EventOrganizer entity.
 * Extends BaseModelImpl to provide CRUD and relation methods.
 */
export class EventOrganizerModel extends BaseModelImpl<EventOrganizer> {
    /**
     * The Drizzle table schema for event organizers.
     */
    protected table = eventOrganizers;
    /**
     * The entity name for logging and error context.
     */
    public entityName = 'eventOrganizers';

    /**
     * Returns the Drizzle query key for this model.
     * Must match the JS variable name used in the Drizzle schema (camelCase),
     * NOT the SQL table name. Used by findAllWithRelations via db.query[tableName].
     */
    protected getTableName(): string {
        return 'eventOrganizers';
    }

    /**
     * Finds an event organizer with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { events: true })
     * @param tx - Optional transaction client
     * @returns Promise resolving to the event organizer with relations or null if not found
     */
    override async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<EventOrganizer | null> {
        const db = this.getClient(tx);
        try {
            // Supports 'events' relation
            if (relations.events) {
                const result = await db.query.eventOrganizers.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: { events: true }
                });
                try {
                    logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                } catch {}
                return (result as EventOrganizer | null | undefined) ?? null;
            }
            // Fallback to base findOne if no relations requested
            const result = await this.findOne(where, tx);
            try {
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findWithRelations', { where, relations }, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where, relations },
                err.message
            );
        }
    }
}

/** Singleton instance for convenience. */
export const eventOrganizerModel = new EventOrganizerModel();
