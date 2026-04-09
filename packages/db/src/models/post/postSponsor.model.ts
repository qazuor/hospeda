import type { PostSponsor } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { postSponsors } from '../../schemas/post/post_sponsor.dbschema.ts';

export class PostSponsorModel extends BaseModelImpl<PostSponsor> {
    protected table = postSponsors;
    public entityName = 'postSponsors';

    protected getTableName(): string {
        return 'postSponsors';
    }
}

/** Singleton instance of PostSponsorModel for use across the application. */
export const postSponsorModel = new PostSponsorModel();
