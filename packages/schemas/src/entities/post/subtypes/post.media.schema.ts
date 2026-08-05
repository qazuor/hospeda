import { z } from 'zod';
import {
    BaseContentMediaSchema,
    ContentMediaAddPayloadSchema,
    ContentMediaReorderPayloadSchema,
    ContentMediaStateSchema
} from '../../../common/content-media.schema.js';
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

// ----------------------------------------------------------------------------
// Command Input Schemas (HOS-390 step 3)
// ----------------------------------------------------------------------------
//
// Field-level rules live in the shared `ContentMedia*PayloadSchema` objects —
// posts and events differ ONLY in the name of the parent FK, so duplicating the
// payload shape per entity would be three copies of the same rules to keep in
// sync. Each entity re-exports the shared payload under its own name so route
// handlers and clients import a post-specific symbol.

/** HTTP payload for `POST /posts/:id/media`. Alias of the shared content payload. */
export const PostMediaAddPayloadSchema = ContentMediaAddPayloadSchema;
/** Inferred type for the add-media payload. */
export type PostMediaAddPayload = z.infer<typeof PostMediaAddPayloadSchema>;

/**
 * Full service input for `addPostMedia`.
 * Combines the URL param `postId` with the photo payload.
 */
export const PostMediaAddInputSchema = z.object({
    /** UUID of the parent post (from URL param `/:id`). */
    postId: PostIdSchema,
    /** Photo payload received from the caller. */
    media: PostMediaAddPayloadSchema
});
/** Inferred type for the full add-media service input. */
export type PostMediaAddInput = z.infer<typeof PostMediaAddInputSchema>;

/** HTTP payload for `PATCH /posts/:id/media/reorder`. */
export const PostMediaReorderPayloadSchema = ContentMediaReorderPayloadSchema;
/** Inferred type for the reorder payload. */
export type PostMediaReorderPayload = z.infer<typeof PostMediaReorderPayloadSchema>;

/** Service input for reordering a post gallery. */
export const PostMediaReorderInputSchema = z.object({
    /** UUID of the parent post (from URL param `/:id`). */
    postId: PostIdSchema,
    /** Ordered array of visible media UUIDs. */
    orderedIds: PostMediaReorderPayloadSchema.shape.orderedIds
});
/** Inferred type for the reorder service input. */
export type PostMediaReorderInput = z.infer<typeof PostMediaReorderInputSchema>;

/** Service input for removing a single photo from a post gallery. */
export const PostMediaRemoveInputSchema = z.object({
    /** UUID of the parent post (from URL param `/:id`). */
    postId: PostIdSchema,
    /** UUID of the media row to remove (from URL param `/:mediaId`). */
    mediaId: PostMediaIdSchema
});
/** Inferred type for the remove-media service input. */
export type PostMediaRemoveInput = z.infer<typeof PostMediaRemoveInputSchema>;

/** Service input for listing a post's media rows. */
export const PostMediaListInputSchema = z.object({
    /** UUID of the parent post (from URL param `/:id`). */
    postId: PostIdSchema,
    /**
     * Visibility state filter. Defaults to `'visible'` (active gallery).
     * Pass `'archived'` to list photos moved out of the gallery.
     */
    state: ContentMediaStateSchema.optional()
});
/** Inferred type for the list-media service input. */
export type PostMediaListInput = z.infer<typeof PostMediaListInputSchema>;

/**
 * Service input for promoting a post photo to the featured image.
 *
 * DB invariants (extras carril 033, mirroring SPEC-204 T-003): at most ONE
 * featured row per post (partial unique index) and a featured photo can never
 * be `state = 'archived'` (CHECK constraint).
 */
export const PostMediaSetFeaturedInputSchema = z.object({
    /** UUID of the parent post (from URL param `/:id`). */
    postId: PostIdSchema,
    /** UUID of the media row to promote as featured (from URL param `/:mediaId`). */
    mediaId: PostMediaIdSchema
});
/** Inferred type for the set-featured service input. */
export type PostMediaSetFeaturedInput = z.infer<typeof PostMediaSetFeaturedInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

/** Single-row output envelope for add-media / set-featured responses. */
export const PostMediaSingleOutputSchema = z.object({
    media: PostMediaSchema
});
/** Inferred type for a single-media response. */
export type PostMediaSingleOutput = z.infer<typeof PostMediaSingleOutputSchema>;

/** List output envelope for `GET /posts/:id/media` and reorder responses. */
export const PostMediaListOutputSchema = z.object({
    media: z.array(PostMediaSchema)
});
/** Inferred type for a media list response. */
export type PostMediaListOutput = z.infer<typeof PostMediaListOutputSchema>;
