import type { PostSponsorship } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { postSponsorships } from '../../schemas/post/post_sponsorship.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

export class PostSponsorshipModel extends BaseModelImpl<PostSponsorship> {
    protected table = postSponsorships;
    public entityName = 'postSponsorships';

    protected override readonly validRelationKeys = ['post', 'sponsor'] as const;

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
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<PostSponsorship | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of ['post', 'sponsor']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.postSponsorships.findFirst({
                    where: (fields, { eq }) => eq(fields.postId, where.postId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as PostSponsorship | null;
            }
            const result = await this.findOne(where, tx);
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

/** Singleton instance of PostSponsorshipModel for use across the application. */
export const postSponsorshipModel = new PostSponsorshipModel();
