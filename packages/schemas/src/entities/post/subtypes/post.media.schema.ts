import type { z } from 'zod';
import { BaseContentMediaSchema } from '../../../common/content-media.schema.js';
import { PostIdSchema, PostMediaIdSchema } from '../../../common/id.schema.js';

/**
 * Zod schema for a single row in the `post_media` table (HOS-390).
 *
 * The row shape lives in {@link BaseContentMediaSchema}; this adds only the two
 * fields that are specific to posts — its own id and the parent FK.
 *
 * Scope (mirrors SPEC-204 D1): this table covers the post's gallery, its
 * featured image, and archived rows. **Videos stay in the `posts.media` JSONB
 * column** — they have no per-row state to track and no gallery ordering.
 *
 * @see packages/db/src/schemas/post/post_media.dbschema.ts — the table
 * @see packages/schemas/src/common/content-media.schema.ts — the shared row shape
 */
export const PostMediaSchema = BaseContentMediaSchema.extend({
    /** UUID primary key for this media row. */
    id: PostMediaIdSchema,
    /** UUID of the parent post (FK → posts.id, ON DELETE CASCADE). */
    postId: PostIdSchema
});

/**
 * Type inferred from `PostMediaSchema`.
 *
 * Structurally compatible with `SelectPostMedia` (the Drizzle-inferred type) so
 * `BaseModelImpl<PostMedia>` typechecks without casts.
 */
export type PostMedia = z.infer<typeof PostMediaSchema>;
