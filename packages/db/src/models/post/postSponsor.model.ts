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
     * held ZERO rows in production when this shipped — soft-deleted ones
     * included — so there was nothing to backfill (owner's measurement,
     * 2026-09-05, HOS-1190). That is a dated observation, not a standing
     * property of the table: re-measure before reusing it to justify skipping
     * a migration.
     *
     * `socialNetworks` is merged for the same reason (HOS-1262): it is one JSONB
     * value of up to six independent network URLs, and a PATCH that sent one
     * network used to replace the column and silently delete the rest. The price
     * is the same as for `contactInfo`: clearing a network is an explicit `null`
     * (`{ socialNetworks: { instagram: null } }`), never an omission. The shared
     * `SocialNetworkSchema` (WRITE) and `SocialNetworkReadSchema` (READ) both
     * accept `null` per key for exactly that reason. `socialNetworks: null` (the
     * whole value) still clears the entire column.
     *
     * `logo` and `adminInfo` (also JSONB on this table) are deliberately NOT
     * added here — that is a separate decision left to the table owner.
     */
    protected override readonly mergeableJsonbColumns = ['contactInfo', 'socialNetworks'] as const;

    protected getTableName(): string {
        return 'postSponsors';
    }
}

/** Singleton instance of PostSponsorModel for use across the application. */
export const postSponsorModel = new PostSponsorModel();
