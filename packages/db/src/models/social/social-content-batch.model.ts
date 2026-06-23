import { BaseModelImpl } from '../../base/base.model.ts';
import { socialContentBatches } from '../../schemas/social/social_content_batches.dbschema.ts';

/** Row type inferred from the social_content_batches table */
type SelectSocialContentBatch = typeof socialContentBatches.$inferSelect;

/**
 * Model for the `social_content_batches` table.
 * Publishing sprint groupings (e.g. "Hospeda Launch 2026-06").
 * Supports soft-delete via `deletedAt`.
 */
export class SocialContentBatchModel extends BaseModelImpl<SelectSocialContentBatch> {
    protected table = socialContentBatches;
    public entityName = 'social_content_batches';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy',
        'posts'
    ] as const;

    protected getTableName(): string {
        return 'socialContentBatches';
    }
}

/** Singleton instance of SocialContentBatchModel for use across the application. */
export const socialContentBatchModel = new SocialContentBatchModel();
