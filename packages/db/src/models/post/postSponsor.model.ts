import type { PostSponsor } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { postSponsors } from '../../schemas/post/post_sponsor.dbschema';

export class PostSponsorModel extends BaseModel<PostSponsor> {
    protected table = postSponsors;
    protected entityName = 'postSponsors';
}
