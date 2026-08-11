/**
 * post.media.ts
 *
 * Media (gallery photo) service helpers for posts (HOS-390).
 *
 * Mirrors `gastronomy.media.ts` (HOS-372) field-for-field, including the
 * standalone-function convention: module-level exported functions taking
 * `(model, actor, data, ctx?)` instead of methods bolted onto `PostService`.
 *
 * ## Permission model
 *
 * All five operations (add / remove / reorder / setFeatured / get) are gated on
 * {@link checkPostCanEditMedia}, which delegates to `checkCanUpdatePost`:
 * editing a post's photos IS editing the post, so it cannot require less than
 * updating the post itself (HOS-374 §7.6.2). There is no separate public read
 * path for media — public consumers read the composed `media` field on the post
 * itself (via `post.media-read.ts`), not this management surface.
 *
 * ## No dual-write
 *
 * These helpers NEVER read or write the legacy `posts.media` JSONB column.
 * All PHOTO state lives exclusively in `post_media` rows. Videos are the one
 * exception and stay in the JSONB blob (SPEC-204 D1) — they carry no per-row
 * state and no gallery ordering, so they were never migrated.
 *
 * @module post.media
 */

import { type DrizzleClient, PostMediaModel, type PostModel, withTransaction } from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import {
    ModerationStatusEnum,
    type PostMediaAddInput,
    PostMediaAddInputSchema,
    type PostMediaListInput,
    PostMediaListInputSchema,
    type PostMediaListOutput,
    type PostMediaRemoveInput,
    PostMediaRemoveInputSchema,
    type PostMediaReorderInput,
    PostMediaReorderInputSchema,
    type PostMediaSetFeaturedInput,
    PostMediaSetFeaturedInputSchema,
    type PostMediaSingleOutput,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { deleteMediaAssetOrThrow } from '../media/delete-media-asset';
import { checkPostCanEditMedia } from './post.permissions';

/** Max rows loaded when resequencing or validating a gallery. */
const GALLERY_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Loads a post by ID or throws NOT_FOUND.
 *
 * @param model - The PostModel instance.
 * @param postId - UUID of the post.
 * @param tx - Optional Drizzle transaction client.
 * @returns The post DB row.
 * @throws {ServiceError} NOT_FOUND when no matching row exists.
 */
async function requirePost(model: PostModel, postId: string, tx?: ServiceContext['tx']) {
    const entity = await model.findById(postId, tx);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Post not found');
    }
    return entity;
}

/**
 * Maps a Zod failure onto the `ServiceOutput` validation-error envelope.
 *
 * @param issues - The Zod issue list.
 * @returns The `{ error }` envelope every helper returns on invalid input.
 */
function validationError(issues: readonly { path: PropertyKey[]; message: string }[]) {
    const messages = issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return {
        error: {
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: `Validation failed: ${messages}`
        }
    } as const;
}

/**
 * Normalizes a thrown value into the `ServiceOutput` error envelope.
 *
 * @param err - The caught value.
 * @returns The `{ error }` envelope, preserving a `ServiceError`'s own code.
 */
function toErrorOutput(err: unknown) {
    if (err instanceof ServiceError) {
        return { error: { code: err.code, message: err.message } } as const;
    }
    return {
        error: {
            code: ServiceErrorCode.INTERNAL_ERROR,
            message: err instanceof Error ? err.message : String(err)
        }
    } as const;
}

// ---------------------------------------------------------------------------
// Media helpers (called by route handlers)
// ---------------------------------------------------------------------------

/**
 * Adds a photo to a post's gallery.
 *
 * This is a URL-receiver function: the upload to Cloudinary has already
 * happened via the media-upload endpoint. This function registers the
 * already-uploaded URL as a new `post_media` row.
 *
 * Server-controlled fields set here:
 * - `state`      → `'visible'` (newly added photos are always visible)
 * - `isFeatured` → `false` (featured is managed by {@link setFeaturedPostMedia})
 * - `sortOrder`  → max(current visible sortOrder) + 1, or 0 when none exist
 * - `moderationState` → defaults to `ModerationStatusEnum.PENDING` when omitted
 *
 * @param model - PostModel instance.
 * @param actor - The actor performing the action.
 * @param data - Add-media input (`postId` + photo payload).
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<PostMediaSingleOutput>` containing the created row.
 */
export async function addPostMedia(
    model: PostModel,
    actor: Actor,
    data: PostMediaAddInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<PostMediaSingleOutput>> {
    try {
        const parseResult = PostMediaAddInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const post = await requirePost(model, validated.postId, ctx?.tx);
        checkPostCanEditMedia(actor, post);

        const mediaModel = new PostMediaModel();

        // Compute next sortOrder: max(visible sortOrder) + 1, or 0 if none yet.
        // Uses `findAll` sorted DESC with pageSize 1 rather than `findByPost`
        // (which orders ASC and is page-capped) so the true maximum is read even
        // for a gallery larger than one page.
        const existing = await mediaModel.findAll(
            { postId: validated.postId, state: 'visible', deletedAt: null },
            { pageSize: 1, sortBy: 'sortOrder', sortOrder: 'desc' },
            undefined,
            ctx?.tx
        );
        const topOrder = existing.items[0]?.sortOrder ?? -1;
        const nextSortOrder = typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;

        const createdMedia = await mediaModel.create(
            {
                ...validated.media,
                postId: validated.postId,
                moderationState: validated.media.moderationState ?? ModerationStatusEnum.PENDING,
                state: 'visible' as const,
                isFeatured: false,
                sortOrder: nextSortOrder
            },
            ctx?.tx
        );

        return { data: { media: createdMedia } };
    } catch (err) {
        return toErrorOutput(err);
    }
}

/**
 * Removes a single photo from a post's gallery.
 *
 * Steps:
 * 1. Gate on {@link checkPostCanEditMedia}.
 * 2. Verify the media row exists AND belongs to this post.
 * 3. Delete the Cloudinary binary (when a `mediaProvider` is supplied).
 * 4. Soft-delete the row and resequence the remaining visible rows to a dense
 *    0-based `sortOrder`, both in a single transaction.
 *
 * Step 3 runs BEFORE the DB transaction on purpose: an external call cannot be
 * rolled back, so it must fail before the DB is touched rather than after. A
 * storage failure therefore aborts the removal with the row intact and the user
 * can retry — an orphaned asset becomes impossible rather than merely unlikely.
 * See `services/media/delete-media-asset.ts` for the full ordering rationale.
 *
 * @param model - PostModel instance.
 * @param actor - The actor performing the action.
 * @param data - Remove-media input (`postId` + `mediaId`).
 * @param mediaProvider - Optional ImageProvider used to delete the binary.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function removePostMedia(
    model: PostModel,
    actor: Actor,
    data: PostMediaRemoveInput,
    mediaProvider?: ImageProvider | null,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = PostMediaRemoveInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const post = await requirePost(model, validated.postId, ctx?.tx);
        checkPostCanEditMedia(actor, post);

        const mediaModel = new PostMediaModel();
        const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
        if (!mediaRow || mediaRow.postId !== validated.postId) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Media not found for this post');
        }

        // Binary first, row second — see JSDoc above.
        await deleteMediaAssetOrThrow({ provider: mediaProvider ?? null, row: mediaRow });

        const doRemove = async (tx: DrizzleClient): Promise<void> => {
            await mediaModel.softDelete({ id: validated.mediaId }, tx);

            const { items: remaining } = await mediaModel.findByPost({
                postId: validated.postId,
                state: 'visible',
                pageSize: GALLERY_PAGE_SIZE,
                tx
            });

            // Apply dense 0-based sortOrder in the existing visual order.
            for (let i = 0; i < remaining.length; i++) {
                const row = remaining[i];
                if (row && row.sortOrder !== i) {
                    await mediaModel.update({ id: row.id }, { sortOrder: i }, tx);
                }
            }
        };

        if (ctx?.tx) {
            await doRemove(ctx.tx);
        } else {
            await withTransaction(doRemove);
        }

        return { data: { success: true } };
    } catch (err) {
        return toErrorOutput(err);
    }
}

/**
 * Reorders a post's gallery photos.
 *
 * Steps:
 * 1. Gate on {@link checkPostCanEditMedia}.
 * 2. Load all current VISIBLE rows for the post.
 * 3. Validate that `orderedIds` is exactly the set of current visible row ids —
 *    no missing entries, no extras, no foreign ids, and no duplicates.
 * 4. Batch-update each row's `sortOrder` to its index in `orderedIds`, in one
 *    transaction.
 *
 * NOTE on duplicate detection: comparing SETS cannot see a duplicate. With
 * `orderedIds = [A, A, B]` against `existingIds = {A, B}`, the input dedupes to
 * `{A, B}` — nothing missing, nothing extra — so a set-only check passes. The
 * loop would then write A at index 0 and again at index 1, leaving no row at
 * `sortOrder` 0, and the response maps over `orderedIds` so the same photo is
 * returned twice. The payload schema does not guard it either (`orderedIds` is
 * `array(uuid).min(1)`), so this function compares the raw array length against
 * the deduplicated set size first.
 *
 * @param model - PostModel instance.
 * @param actor - The actor performing the action.
 * @param data - Reorder input (`postId` + `orderedIds`).
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<PostMediaListOutput>` containing the reordered rows.
 */
export async function reorderPostMedia(
    model: PostModel,
    actor: Actor,
    data: PostMediaReorderInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<PostMediaListOutput>> {
    try {
        const parseResult = PostMediaReorderInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const post = await requirePost(model, validated.postId, ctx?.tx);
        checkPostCanEditMedia(actor, post);

        const mediaModel = new PostMediaModel();
        const { items: visibleRows } = await mediaModel.findByPost({
            postId: validated.postId,
            state: 'visible',
            pageSize: GALLERY_PAGE_SIZE,
            tx: ctx?.tx
        });

        const existingIds = new Set(visibleRows.map((r) => r.id));
        const inputIds = new Set(validated.orderedIds);

        // Explicit duplicate guard — see JSDoc note above for why a pure
        // set-difference check is not sufficient on its own.
        if (validated.orderedIds.length !== inputIds.size) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'orderedIds contains duplicate id(s)'
            );
        }

        const missingIds = [...existingIds].filter((id) => !inputIds.has(id));
        const extraIds = [...inputIds].filter((id) => !existingIds.has(id));

        if (missingIds.length > 0 || extraIds.length > 0) {
            const details: string[] = [];
            if (missingIds.length > 0) details.push(`missing: ${missingIds.join(', ')}`);
            if (extraIds.length > 0) details.push(`unknown/foreign: ${extraIds.join(', ')}`);
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `orderedIds does not match visible media for this post — ${details.join('; ')}`
            );
        }

        const rowById = new Map(visibleRows.map((r) => [r.id, r]));

        const doReorder = async (tx: DrizzleClient): Promise<void> => {
            for (let i = 0; i < validated.orderedIds.length; i++) {
                const id = validated.orderedIds[i];
                if (id !== undefined) {
                    await mediaModel.update({ id }, { sortOrder: i }, tx);
                }
            }
        };

        if (ctx?.tx) {
            await doReorder(ctx.tx);
        } else {
            await withTransaction(doReorder);
        }

        const reordered = validated.orderedIds
            .map((id, idx) => {
                const row = rowById.get(id);
                return row ? { ...row, sortOrder: idx } : null;
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

        return { data: { media: reordered } };
    } catch (err) {
        return toErrorOutput(err);
    }
}

/**
 * Lists the media rows for a post's gallery.
 *
 * Returns all non-deleted rows ordered by `sortOrder ASC`. Supports an optional
 * `state` filter (defaults to `'visible'`). Gated with
 * {@link checkPostCanEditMedia} so an author sees only their own post's gallery.
 *
 * @param model - PostModel instance.
 * @param actor - The actor performing the action.
 * @param data - List-media input (`postId` + optional `state`).
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<PostMediaListOutput>` containing the media array.
 */
export async function getPostMedia(
    model: PostModel,
    actor: Actor,
    data: PostMediaListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<PostMediaListOutput>> {
    try {
        const parseResult = PostMediaListInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const post = await requirePost(model, validated.postId, ctx?.tx);
        checkPostCanEditMedia(actor, post);

        const mediaModel = new PostMediaModel();
        const { items } = await mediaModel.findByPost({
            postId: validated.postId,
            state: validated.state ?? 'visible',
            pageSize: GALLERY_PAGE_SIZE,
            tx: ctx?.tx
        });

        return { data: { media: items } };
    } catch (err) {
        return toErrorOutput(err);
    }
}

/**
 * Promotes a single photo to the featured image of a post.
 *
 * Steps:
 * 1. Gate on {@link checkPostCanEditMedia}.
 * 2. Verify the target media row exists AND belongs to this post.
 * 3. Guard: target row must be `state = 'visible'` — a DB CHECK constraint
 *    forbids `is_featured = true AND state = 'archived'`, so we reject early
 *    with a clear ServiceError rather than letting the DB raise.
 * 4. In a TRANSACTION: clear the previous featured row (`is_featured = false`),
 *    then set the target row `is_featured = true`. Clear-then-set order is
 *    mandatory — setting the new one first would briefly violate the partial
 *    unique index on (post_id) WHERE is_featured.
 *
 * @param model - PostModel instance.
 * @param actor - The actor performing the action.
 * @param data - Set-featured input (`postId` + `mediaId`).
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<PostMediaSingleOutput>` containing the updated row.
 */
export async function setFeaturedPostMedia(
    model: PostModel,
    actor: Actor,
    data: PostMediaSetFeaturedInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<PostMediaSingleOutput>> {
    try {
        const parseResult = PostMediaSetFeaturedInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const post = await requirePost(model, validated.postId, ctx?.tx);
        checkPostCanEditMedia(actor, post);

        const mediaModel = new PostMediaModel();
        const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
        if (!mediaRow || mediaRow.postId !== validated.postId) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Media not found for this post');
        }

        // Guard: archived photos cannot be featured (DB CHECK constraint would fire).
        if (mediaRow.state === 'archived') {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Cannot feature an archived photo — restore it to visible first'
            );
        }

        // Transaction: clear-then-set to avoid briefly having two featured rows,
        // which would violate the partial unique index on
        // (post_id) WHERE is_featured = true AND deleted_at IS NULL.
        const doSetFeatured = async (tx: DrizzleClient): Promise<void> => {
            const existing = await mediaModel.findFeatured({ postId: validated.postId, tx });
            if (existing && existing.id !== validated.mediaId) {
                await mediaModel.update({ id: existing.id }, { isFeatured: false }, tx);
            }
            await mediaModel.update({ id: validated.mediaId }, { isFeatured: true }, tx);
        };

        if (ctx?.tx) {
            await doSetFeatured(ctx.tx);
        } else {
            await withTransaction(doSetFeatured);
        }

        const updated = await mediaModel.findById(validated.mediaId, ctx?.tx);
        if (!updated) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to retrieve updated media row after set-featured'
            );
        }
        return { data: { media: updated } };
    } catch (err) {
        return toErrorOutput(err);
    }
}
