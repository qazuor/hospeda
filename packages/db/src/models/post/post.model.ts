import type { Post } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { posts } from '../../schemas/post/post.dbschema';

export class PostModel extends BaseModel<Post> {
    protected table = posts;
    protected entityName = 'posts';

    protected getTableName(): string {
        return 'posts';
    }
}
