import type { PostSponsor } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { postSponsors } from '../../schemas/post/post_sponsor.dbschema.ts';

export class PostSponsorModel extends BaseModelImpl<PostSponsor> {
    protected table = postSponsors;
    protected entityName = 'postSponsors';

    protected getTableName(): string {
        return 'postSponsors';
    }
}
