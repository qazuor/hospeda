import { BaseModelImpl } from '../../base/base.model.ts';
import { socialAiRequests } from '../../schemas/social/social_ai_requests.dbschema.ts';

/** Row type inferred from the social_ai_requests table */
type SelectSocialAiRequest = typeof socialAiRequests.$inferSelect;

/**
 * Model for the append-only `social_ai_requests` table.
 * Permanent audit record of every GPT ingestion call.
 *
 * This table has NO soft-delete columns and NO audit FKs by design —
 * rows are never deleted by application code. `softDelete` and `restore`
 * will throw at runtime (base class guards on `deletedAt` presence).
 */
export class SocialAiRequestModel extends BaseModelImpl<SelectSocialAiRequest> {
    protected table = socialAiRequests;
    public entityName = 'social_ai_requests';

    protected override readonly validRelationKeys = ['audience'] as const;

    protected getTableName(): string {
        return 'socialAiRequests';
    }
}

/** Singleton instance of SocialAiRequestModel for use across the application. */
export const socialAiRequestModel = new SocialAiRequestModel();
