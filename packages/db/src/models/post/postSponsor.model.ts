import type { PostSponsor } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { postSponsors } from '../../schemas/post/post_sponsor.dbschema.ts';

export class PostSponsorModel extends BaseModelImpl<PostSponsor> {
    protected table = postSponsors;
    public entityName = 'postSponsors';

    /**
     * Grouped JSONB columns shallow-merged (PostgreSQL `||`) on update rather
     * than replaced wholesale, following the `accommodations` / `users` /
     * `partners` precedent (HOS-278 D3).
     *
     * `contactInfo` was NOT declared here until now — every model with a
     * `contact_info` JSONB column defaults to full replacement unless it
     * opts in, so a PATCH that sent only one contact field (e.g. a phone
     * number) silently deleted every other stored contact field. The table
     * is empty in production as of this fix, so there is no data to migrate.
     *
     * `socialNetworks`, `logo` and `adminInfo` (also JSONB on this table) are
     * deliberately NOT added here — that is a separate decision left to the
     * table owner, same as `partners.socialNetworks` was excluded for a
     * documented reason (see `PartnerModel`).
     */
    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;

    protected getTableName(): string {
        return 'postSponsors';
    }
}

/** Singleton instance of PostSponsorModel for use across the application. */
export const postSponsorModel = new PostSponsorModel();
