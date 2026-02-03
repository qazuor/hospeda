import type { Post } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { posts } from '../../schemas/post/post.dbschema.ts';

export class PostModel extends BaseModel<Post> {
    protected table = posts;
    protected entityName = 'posts';

    protected getTableName(): string {
        return 'posts';
    }
}
