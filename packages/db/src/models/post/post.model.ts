import type { Post } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { posts } from '../../schemas/post/post.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

export class PostModel extends BaseModelImpl<Post> {
    protected table = posts;
    public entityName = 'posts';

    protected override readonly validRelationKeys = [
        'author',
        'createdBy',
        'updatedBy',
        'deletedBy',
        'relatedAccommodation',
        'relatedDestination',
        'relatedEvent',
        'sponsorship',
        'tags'
    ] as const;

    protected getTableName(): string {
        return 'posts';
    }

    /** Atomically increment the likes counter by 1 */
    async incrementLikes({ id }: { id: string }, tx?: DrizzleClient): Promise<void> {
        const db = this.getClient(tx);
        await db
            .update(posts)
            .set({ likes: sql`COALESCE(${posts.likes}, 0) + 1` })
            .where(eq(posts.id, id));
    }

    /** Atomically decrement the likes counter by 1 (minimum 0) */
    async decrementLikes({ id }: { id: string }, tx?: DrizzleClient): Promise<void> {
        const db = this.getClient(tx);
        await db
            .update(posts)
            .set({ likes: sql`GREATEST(COALESCE(${posts.likes}, 0) - 1, 0)` })
            .where(eq(posts.id, id));
    }
}

/** Singleton instance of PostModel for use across the application. */
export const postModel = new PostModel();
