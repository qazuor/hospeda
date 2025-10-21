import type { PostSponsorship } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { postSponsorships } from '../../schemas/post/post_sponsorship.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class PostSponsorshipModel extends BaseModel<PostSponsorship> {
    protected table = postSponsorships;
    protected entityName = 'postSponsorships';

    protected getTableName(): string {
        return 'postSponsorships';
    }

    /**
     * Finds a PostSponsorship with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { post: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<PostSponsorship | null> {
        const db = getDb();
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of ['post', 'sponsor']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.postSponsorships.findFirst({
                    where: (fields, { eq }) => eq(fields.postId, where.postId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as PostSponsorship | null;
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
