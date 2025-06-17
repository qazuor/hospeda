import type { EntityTagType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { rEntityTag } from '../../schemas/tag/r_entity_tag.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class REntityTagModel extends BaseModel<EntityTagType> {
    protected table = rEntityTag;
    protected entityName = 'rEntityTag';

    /**
     * Finds a REntityTag with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { tag: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<EntityTagType | null> {
        const db = getDb();
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['tag']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.rEntityTag.findFirst({
                    where: (fields, { eq }) => eq(fields.tagId, where.tagId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as EntityTagType | null;
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
