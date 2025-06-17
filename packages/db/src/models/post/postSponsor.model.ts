import type { PostSponsorType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { postSponsors } from '../../schemas/post/post_sponsor.dbschema';

export class PostSponsorModel extends BaseModel<PostSponsorType> {
    protected table = postSponsors;
    protected entityName = 'postSponsors';
}
