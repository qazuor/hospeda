import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPostTargets } from '../../schemas/social/social_post_targets.dbschema.ts';

/** Row type inferred from the social_post_targets table */
type SelectSocialPostTarget = typeof socialPostTargets.$inferSelect;

/**
 * Model for the `social_post_targets` table.
 * One row per platform the post should be published to.
 * No soft-delete on this table (by schema design).
 *
 * `makePayloadJson` is declared mergeable so partial payload patches preserve
 * existing keys already stored in the column.
 */
export class SocialPostTargetModel extends BaseModelImpl<SelectSocialPostTarget> {
    protected table = socialPostTargets;
    public entityName = 'social_post_targets';

    protected override readonly validRelationKeys = [
        'post',
        'platformFormat',
        'publishLogs'
    ] as const;

    /**
     * `makePayloadJson` receives shallow-merge semantics so incremental updates
     * to the Make.com dispatch payload do not overwrite previously set keys.
     */
    protected override readonly mergeableJsonbColumns = ['makePayloadJson'] as const;

    protected getTableName(): string {
        return 'socialPostTargets';
    }
}

/** Singleton instance of SocialPostTargetModel for use across the application. */
export const socialPostTargetModel = new SocialPostTargetModel();
