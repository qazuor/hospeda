import type { EventOrganizer } from '@repo/schemas';
import { BaseModel } from '../base/base.model.ts';
import { getDb } from '../client.ts';
import { eventOrganizers } from '../schemas/event/event_organizer.dbschema.ts';
import { DbError } from '../utils/error.ts';
import { logError, logQuery } from '../utils/logger.ts';

/**
 * Model for the EventOrganizer entity.
 * Extends BaseModel to provide CRUD and relation methods.
 */
export class EventOrganizerModel extends BaseModel<EventOrganizer> {
    /**
     * The Drizzle table schema for event organizers.
     */
    protected table = eventOrganizers;
    /**
     * The entity name for logging and error context.
     */
    protected entityName = 'eventOrganizers';

    protected getTableName(): string {
        return 'event_organizers';
    }

    /**
     * Finds an event organizer with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { events: true })
     * @returns Promise resolving to the event organizer with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<EventOrganizer | null> {
        const db = getDb();
        try {
            // Example: supports 'events' relation
            if (relations.events) {
                const result = await db.query.eventOrganizers.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: { events: true }
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as EventOrganizer | null;
            }
            // Fallback to base findOne if no relations requested
            const result = await this.findOne(where);
            logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findWithRelations', { where, relations }, error as Error);
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where, relations },
                (error as Error).message
            );
        }
    }
}

// Export a singleton instance for convenience
export const eventOrganizerModel = new EventOrganizerModel();
