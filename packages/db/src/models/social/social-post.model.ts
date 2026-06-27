import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPosts } from '../../schemas/social/social_posts.dbschema.ts';

/** Row type inferred from the social_posts table */
type SelectSocialPost = typeof socialPosts.$inferSelect;

/**
 * Model for the `social_posts` table.
 * Master record for every social media post in the pipeline, from GPT draft
 * through approval, scheduling, dispatch, and publish.
 * Supports soft-delete via `deletedAt`.
 *
 * `recurrenceParamsJson`, `gptHashtagPayloadJson`, and `metadataJson` are JSONB
 * columns declared mergeable so partial patches preserve sibling keys.
 */
export class SocialPostModel extends BaseModelImpl<SelectSocialPost> {
    protected table = socialPosts;
    public entityName = 'social_posts';

    protected override readonly validRelationKeys = [
        'campaign',
        'batch',
        'audience',
        'footer',
        'baseHashtagSet',
        'approvedBy',
        'createdBy',
        'updatedBy',
        'deletedBy',
        'targets',
        'media',
        'hashtags'
    ] as const;

    /**
     * JSONB columns that receive shallow-merge semantics on update so partial
     * patches do not clobber existing keys.
     */
    protected override readonly mergeableJsonbColumns = [
        'recurrenceParamsJson',
        'gptHashtagPayloadJson',
        'metadataJson'
    ] as const;

    protected getTableName(): string {
        return 'socialPosts';
    }
}

/** Singleton instance of SocialPostModel for use across the application. */
export const socialPostModel = new SocialPostModel();
