import { BaseModelImpl } from '../../base/base.model.ts';
import { socialAssets } from '../../schemas/social/social_assets.dbschema.ts';

/** Row type inferred from the social_assets table */
type SelectSocialAsset = typeof socialAssets.$inferSelect;

/**
 * Model for the `social_assets` table.
 * Cloudinary-hosted media assets referenced by social posts.
 * Supports soft-delete via `deletedAt`.
 *
 * `metadataJson` is declared mergeable so partial metadata patches
 * preserve sibling keys already present in the stored object.
 */
export class SocialAssetModel extends BaseModelImpl<SelectSocialAsset> {
    protected table = socialAssets;
    public entityName = 'social_assets';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy',
        'postMedia'
    ] as const;

    /**
     * `metadataJson` is a JSONB column that receives shallow-merge semantics on
     * update so partial patches (e.g. only setting `altText` metadata) do not
     * clobber other keys in the stored object.
     */
    protected override readonly mergeableJsonbColumns = ['metadataJson'] as const;

    protected getTableName(): string {
        return 'socialAssets';
    }
}

/** Singleton instance of SocialAssetModel for use across the application. */
export const socialAssetModel = new SocialAssetModel();
