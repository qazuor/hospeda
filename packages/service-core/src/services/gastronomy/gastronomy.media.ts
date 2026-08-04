/**
 * gastronomy.media.ts
 *
 * Media (gallery photo) service helpers for gastronomy listings (HOS-372).
 *
 * Mirrors the media-management pattern from `AccommodationService.addMedia` /
 * `removeMedia` / `reorderMedia` / `adminGetMedia` / `setFeaturedMedia`, and the
 * standalone-function convention established by `gastronomy.faq.ts` (module-level
 * exported functions taking `(model, actor, data, ctx?)` instead of methods bolted
 * onto `GastronomyService`).
 *
 * ## Permission model
 *
 * All five operations (add / remove / reorder / setFeatured / get) are gated on
 * `checkGastronomyCanEditMedia`: `COMMERCE_EDIT_OWN` (listing owner) or
 * `COMMERCE_EDIT_ALL` (staff). There is no separate public read path for media —
 * public consumers read the composed `media` field on the listing itself (via
 * `gastronomy.media-read.ts`), not this management surface.
 *
 * ## No dual-write
 *
 * These helpers NEVER read or write the legacy `gastronomy.media` JSONB column.
 * All photo state lives exclusively in `gastronomy_media` rows.
 *
 * @module gastronomy.media
 */

import {
    type DrizzleClient,
    GastronomyMediaModel,
    type GastronomyModel,
    withTransaction
} from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import {
    type GastronomyMediaAddInput,
    GastronomyMediaAddInputSchema,
    type GastronomyMediaListInput,
    GastronomyMediaListInputSchema,
    type GastronomyMediaListOutput,
    type GastronomyMediaRemoveInput,
    GastronomyMediaRemoveInputSchema,
    type GastronomyMediaReorderInput,
    GastronomyMediaReorderInputSchema,
    type GastronomyMediaSetFeaturedInput,
    GastronomyMediaSetFeaturedInputSchema,
    type GastronomyMediaSingleOutput,
    ModerationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { deleteMediaAssetOrThrow } from '../media/delete-media-asset';
import { checkGastronomyCanEditMedia } from './gastronomy.permissions';

// ---------------------------------------------------------------------------
// Internal helper — load listing or throw NOT_FOUND
// ---------------------------------------------------------------------------

/**
 * Loads a gastronomy listing by ID or throws NOT_FOUND.
 *
 * @param model - The GastronomyModel instance.
 * @param gastronomyId - UUID of the listing.
 * @param tx - Optional Drizzle transaction client.
 * @returns The gastronomy DB row.
 * @throws {ServiceError} NOT_FOUND when no matching row exists.
 */
async function requireGastronomy(
    model: GastronomyModel,
    gastronomyId: string,
    tx?: ServiceContext['tx']
) {
    const entity = await model.findById(gastronomyId, tx);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy listing not found');
    }
    return entity;
}

// ---------------------------------------------------------------------------
// Media helpers (called by GastronomyService / route handlers)
// ---------------------------------------------------------------------------

/**
 * Adds a photo to a gastronomy listing gallery.
 *
 * This is a URL-receiver method: the upload to Cloudinary has already happened
 * via `POST /api/v1/admin/media/upload`. This function registers the
 * already-uploaded URL as a new `gastronomy_media` row.
 *
 * `sortOrder` is computed as max(visible sortOrder) + 1 (append to end). When
 * no visible rows exist yet, starts at 0.
 *
 * Server-controlled fields set here:
 * - `state`      → `'visible'` (newly added photos are always visible)
 * - `isFeatured` → `false` (featured is managed by {@link setFeaturedGastronomyMedia})
 * - `sortOrder`  → max(current visible sortOrder) + 1
 * - `moderationState` → defaults to `ModerationStatusEnum.PENDING` when not supplied
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated add-media input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyMediaSingleOutput>` containing the created row.
 */
export async function addGastronomyMedia(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyMediaAddInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyMediaSingleOutput>> {
    try {
        const parseResult = GastronomyMediaAddInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const validated = parseResult.data;

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditMedia(actor, gastronomy);

        const mediaModel = new GastronomyMediaModel();

        // Compute next sortOrder: max(visible sortOrder) + 1, or 0 if none yet.
        const existing = await mediaModel.findAll(
            { gastronomyId: validated.gastronomyId, state: 'visible', deletedAt: null },
            { pageSize: 1, sortBy: 'sortOrder', sortOrder: 'desc' },
            undefined,
            ctx?.tx
        );
        const topOrder = existing.items[0]?.sortOrder ?? -1;
        const nextSortOrder = typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;

        const rowToCreate = {
            ...validated.media,
            gastronomyId: validated.gastronomyId,
            moderationState: validated.media.moderationState ?? ModerationStatusEnum.PENDING,
            state: 'visible' as const,
            isFeatured: false,
            sortOrder: nextSortOrder
        };

        const createdMedia = await mediaModel.create(rowToCreate, ctx?.tx);
        return { data: { media: createdMedia } };
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Removes a single photo from a gastronomy listing gallery.
 *
 * Steps:
 * 1. Gate on `checkGastronomyCanEditMedia`.
 * 2. Verify the media row exists AND belongs to this gastronomy listing.
 * 3. Soft-delete the row (sets `deletedAt`).
 * 4. Resequence the remaining visible rows to a dense 0-based `sortOrder`
 *    (preserves their relative order). Both steps run in a single transaction.
 *
 * Deletes the Cloudinary binary too, when a `mediaProvider` is supplied (HOS-372).
 * That step runs after authorization and row resolution but BEFORE the DB
 * transaction: a storage failure aborts the removal with the row intact, so the
 * user can retry and an orphaned asset becomes impossible rather than merely
 * unlikely. Callers that omit the provider get the previous DB-only behavior.
 * See `services/media/delete-media-asset.ts` for the full ordering rationale.
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated remove-media input.
 * @param mediaProvider - Optional ImageProvider used to delete the binary.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function removeGastronomyMedia(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyMediaRemoveInput,
    mediaProvider?: ImageProvider | null,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = GastronomyMediaRemoveInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const validated = parseResult.data;

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditMedia(actor, gastronomy);

        const mediaModel = new GastronomyMediaModel();
        const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
        if (!mediaRow || mediaRow.gastronomyId !== validated.gastronomyId) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Media not found for this gastronomy listing'
            );
        }

        // Binary first, row second. Runs outside the transaction on purpose —
        // an external call cannot be rolled back, so it must fail before the DB
        // is touched rather than after (see delete-media-asset.ts).
        await deleteMediaAssetOrThrow({ provider: mediaProvider ?? null, row: mediaRow });

        // Soft-delete + resequence in a single transaction.
        const doRemove = async (tx: DrizzleClient): Promise<void> => {
            await mediaModel.softDelete({ id: validated.mediaId }, tx);

            // Reload the remaining visible rows to resequence them.
            const { items: remaining } = await mediaModel.findByGastronomy({
                gastronomyId: validated.gastronomyId,
                state: 'visible',
                pageSize: 200,
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
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Reorders a gastronomy listing's gallery photos.
 *
 * Steps:
 * 1. Gate on `checkGastronomyCanEditMedia`.
 * 2. Load all current VISIBLE rows for the listing.
 * 3. Validate that `orderedIds` is exactly the set of current visible row ids —
 *    no missing entries, no extras, no foreign ids, and no duplicates. Rejects
 *    with `VALIDATION_ERROR` on any mismatch.
 * 4. Batch-update each row's `sortOrder` to its index in `orderedIds`.
 *    All updates run in a single transaction.
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
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated reorder input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyMediaListOutput>` containing the reordered rows.
 */
export async function reorderGastronomyMedia(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyMediaReorderInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyMediaListOutput>> {
    try {
        const parseResult = GastronomyMediaReorderInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const validated = parseResult.data;

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditMedia(actor, gastronomy);

        const mediaModel = new GastronomyMediaModel();

        // Load all visible rows to validate and resequence.
        const { items: visibleRows } = await mediaModel.findByGastronomy({
            gastronomyId: validated.gastronomyId,
            state: 'visible',
            pageSize: 200,
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
                `orderedIds does not match visible media for this gastronomy listing — ${details.join('; ')}`
            );
        }

        // Build a map for fast row lookup so we can return the updated list.
        const rowById = new Map(visibleRows.map((r) => [r.id, r]));

        // Apply all sortOrder updates in a single transaction.
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

        // Return the reordered rows with their updated sortOrder values.
        const reordered = validated.orderedIds
            .map((id, idx) => {
                const row = rowById.get(id);
                return row ? { ...row, sortOrder: idx } : null;
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

        return { data: { media: reordered } };
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Lists the media rows for a gastronomy listing gallery.
 *
 * Returns all non-deleted rows ordered by `sortOrder ASC`. Supports an optional
 * `state` filter (defaults to `'visible'`). Gated with
 * `checkGastronomyCanEditMedia` so an owner sees only their own listing's gallery.
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated list-media input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyMediaListOutput>` containing the media array.
 */
export async function getGastronomyMedia(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyMediaListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyMediaListOutput>> {
    try {
        const parseResult = GastronomyMediaListInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const validated = parseResult.data;

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditMedia(actor, gastronomy);

        const mediaModel = new GastronomyMediaModel();
        const { items } = await mediaModel.findByGastronomy({
            gastronomyId: validated.gastronomyId,
            state: validated.state ?? 'visible',
            pageSize: 200,
            tx: ctx?.tx
        });

        return { data: { media: items } };
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Promotes a single photo to the featured image of a gastronomy listing.
 *
 * Steps:
 * 1. Gate on `checkGastronomyCanEditMedia`.
 * 2. Verify the target media row exists AND belongs to this gastronomy listing.
 * 3. Guard: target row must be `state = 'visible'` — a DB CHECK constraint
 *    forbids `is_featured = true AND state = 'archived'`, so we reject early
 *    with a clear ServiceError rather than letting the DB raise.
 * 4. In a TRANSACTION: clear the previous featured row (`is_featured = false`),
 *    then set the target row `is_featured = true`. Clear-then-set order is
 *    mandatory — setting the new one first would briefly violate the partial
 *    unique index on (gastronomy_id) WHERE is_featured.
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated set-featured input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyMediaSingleOutput>` containing the updated row.
 */
export async function setFeaturedGastronomyMedia(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyMediaSetFeaturedInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyMediaSingleOutput>> {
    try {
        const parseResult = GastronomyMediaSetFeaturedInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const validated = parseResult.data;

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditMedia(actor, gastronomy);

        const mediaModel = new GastronomyMediaModel();
        const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
        if (!mediaRow || mediaRow.gastronomyId !== validated.gastronomyId) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Media not found for this gastronomy listing'
            );
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
        // (gastronomy_id) WHERE is_featured = true AND deleted_at IS NULL.
        const doSetFeatured = async (tx: DrizzleClient): Promise<void> => {
            const existing = await mediaModel.findFeatured({
                gastronomyId: validated.gastronomyId,
                tx
            });
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

        // Re-fetch the updated row to return the current DB state.
        const updated = await mediaModel.findById(validated.mediaId, ctx?.tx);
        if (!updated) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to retrieve updated media row after set-featured'
            );
        }
        return { data: { media: updated } };
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}
