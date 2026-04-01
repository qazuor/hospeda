import type { Post } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model.ts';
import { getDb } from '../../client.ts';
import { posts } from '../../schemas/post/post.dbschema.ts';

export class PostModel extends BaseModel<Post> {
    protected table = posts;
    protected entityName = 'posts';

    protected getTableName(): string {
        return 'posts';
    }

    /** Atomically increment the likes counter by 1 */
    async incrementLikes({ id }: { id: string }): Promise<void> {
        const db = getDb();
        await db
            .update(posts)
            .set({ likes: sql`COALESCE(${posts.likes}, 0) + 1` })
            .where(eq(posts.id, id));
    }

    /** Atomically decrement the likes counter by 1 (minimum 0) */
    async decrementLikes({ id }: { id: string }): Promise<void> {
        const db = getDb();
        await db
            .update(posts)
            .set({ likes: sql`GREATEST(COALESCE(${posts.likes}, 0) - 1, 0)` })
            .where(eq(posts.id, id));
    }
}
