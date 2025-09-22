import type { Post } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { posts } from '../../schemas/post/post.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class PostModel extends BaseModel<Post> {
    protected table = posts;
    protected entityName = 'posts';

    /**
     * Finds a post with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { author: true })
     * @returns Promise resolving to the post with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<Post | null> {
        const db = getDb();
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of [
                'author',
                'createdBy',
                'updatedBy',
                'deletedBy',
                'relatedAccommodation',
                'relatedDestination',
                'relatedEvent',
                'sponsorship',
                'tags'
            ]) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.posts.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as Post | null;
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
