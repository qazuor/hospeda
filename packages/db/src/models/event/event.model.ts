import type { Event } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { events } from '../../schemas/event/event.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class EventModel extends BaseModel<Event> {
    protected table = events;
    protected entityName = 'events';

    protected getTableName(): string {
        return 'events';
    }

    /**
     * Finds an event with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { author: true })
     * @returns Promise resolving to the event with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<Event | null> {
        const db = getDb();
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of [
                'author',
                'createdBy',
                'updatedBy',
                'deletedBy',
                'location',
                'organizer',
                'tags'
            ]) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.events.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as Event | null;
            }
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
