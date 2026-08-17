/**
 * event.media.ts
 *
 * Media (gallery photo) service helpers for events (HOS-390).
 *
 * Mirrors `gastronomy.media.ts` (HOS-372) field-for-field, including the
 * standalone-function convention: module-level exported functions taking
 * `(model, actor, data, ctx?)` instead of methods bolted onto `EventService`.
 *
 * ## Permission model
 *
 * All five operations (add / remove / reorder / setFeatured / get) are gated on
 * {@link checkEventCanEditMedia}, which delegates to `checkCanUpdateEvent`:
 * editing an event's photos IS editing the event, so it cannot require less than
 * updating the event itself (HOS-374 §7.6.2). There is no separate public read
 * path for media — public consumers read the composed `media` field on the event
 * itself (via `event.media-read.ts`), not this management surface.
 *
 * ## No dual-write
 *
 * These helpers NEVER read or write the legacy `events.media` JSONB column.
 * All PHOTO state lives exclusively in `event_media` rows. Videos are the one
 * exception and stay in the JSONB blob (SPEC-204 D1) — they carry no per-row
 * state and no gallery ordering, so they were never migrated.
 *
 * @module event.media
 */

import { type DrizzleClient, EventMediaModel, type EventModel, withTransaction } from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import {
    type EventMediaAddInput,
    EventMediaAddInputSchema,
    type EventMediaListInput,
    EventMediaListInputSchema,
    type EventMediaListOutput,
    type EventMediaRemoveInput,
    EventMediaRemoveInputSchema,
    type EventMediaReorderInput,
    EventMediaReorderInputSchema,
    type EventMediaSetFeaturedInput,
    EventMediaSetFeaturedInputSchema,
    type EventMediaSingleOutput,
    ModerationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { deleteMediaAssetOrThrow } from '../media/delete-media-asset';
import { checkEventCanEditMedia } from './event.permissions';

/** Max rows loaded when resequencing or validating a gallery. */
const GALLERY_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Loads an event by ID or throws NOT_FOUND.
 *
 * @param model - The EventModel instance.
 * @param eventId - UUID of the event.
 * @param tx - Optional Drizzle transaction client.
 * @returns The event DB row.
 * @throws {ServiceError} NOT_FOUND when no matching row exists.
 */
async function requireEvent(model: EventModel, eventId: string, tx?: ServiceContext['tx']) {
    const entity = await model.findById(eventId, tx);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Event not found');
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
 * Adds a photo to an event's gallery.
 *
 * This is a URL-receiver function: the upload to Cloudinary has already
 * happened via the media-upload endpoint. This function registers the
 * already-uploaded URL as a new `event_media` row.
 *
 * Server-controlled fields set here:
 * - `state`      → `'visible'` (newly added photos are always visible)
 * - `isFeatured` → `false` (featured is managed by {@link setFeaturedEventMedia})
 * - `sortOrder`  → max(current visible sortOrder) + 1, or 0 when none exist
 * - `moderationState` → defaults to `ModerationStatusEnum.PENDING` when omitted
 *
 * @param model - EventModel instance.
 * @param actor - The actor performing the action.
 * @param data - Add-media input (`eventId` + photo payload).
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<EventMediaSingleOutput>` containing the created row.
 */
export async function addEventMedia(
    model: EventModel,
    actor: Actor,
    data: EventMediaAddInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<EventMediaSingleOutput>> {
    try {
        const parseResult = EventMediaAddInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const event = await requireEvent(model, validated.eventId, ctx?.tx);
        checkEventCanEditMedia(actor, event);

        const mediaModel = new EventMediaModel();

        // Compute next sortOrder: max(visible sortOrder) + 1, or 0 if none yet.
        // Uses `findAll` sorted DESC with pageSize 1 rather than `findByEvent`
        // (which orders ASC and is page-capped) so the true maximum is read even
        // for a gallery larger than one page.
        const existing = await mediaModel.findAll(
            { eventId: validated.eventId, state: 'visible', deletedAt: null },
            { pageSize: 1, sortBy: 'sortOrder', sortOrder: 'desc' },
            undefined,
            ctx?.tx
        );
        const topOrder = existing.items[0]?.sortOrder ?? -1;
        const nextSortOrder = typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;

        const createdMedia = await mediaModel.create(
            {
                ...validated.media,
                eventId: validated.eventId,
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
 * Removes a single photo from an event's gallery.
 *
 * Steps:
 * 1. Gate on {@link checkEventCanEditMedia}.
 * 2. Verify the media row exists AND belongs to this event.
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
 * @param model - EventModel instance.
 * @param actor - The actor performing the action.
 * @param data - Remove-media input (`eventId` + `mediaId`).
 * @param mediaProvider - Optional ImageProvider used to delete the binary.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function removeEventMedia(
    model: EventModel,
    actor: Actor,
    data: EventMediaRemoveInput,
    mediaProvider?: ImageProvider | null,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = EventMediaRemoveInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const event = await requireEvent(model, validated.eventId, ctx?.tx);
        checkEventCanEditMedia(actor, event);

        const mediaModel = new EventMediaModel();
        const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
        if (!mediaRow || mediaRow.eventId !== validated.eventId) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Media not found for this event');
        }

        // Binary first, row second — see JSDoc above.
        await deleteMediaAssetOrThrow({ provider: mediaProvider ?? null, row: mediaRow });

        const doRemove = async (tx: DrizzleClient): Promise<void> => {
            await mediaModel.softDelete({ id: validated.mediaId }, actor.id, tx);

            const { items: remaining } = await mediaModel.findByEvent({
                eventId: validated.eventId,
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
 * Reorders an event's gallery photos.
 *
 * Steps:
 * 1. Gate on {@link checkEventCanEditMedia}.
 * 2. Load all current VISIBLE rows for the event.
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
 * @param model - EventModel instance.
 * @param actor - The actor performing the action.
 * @param data - Reorder input (`eventId` + `orderedIds`).
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<EventMediaListOutput>` containing the reordered rows.
 */
export async function reorderEventMedia(
    model: EventModel,
    actor: Actor,
    data: EventMediaReorderInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<EventMediaListOutput>> {
    try {
        const parseResult = EventMediaReorderInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const event = await requireEvent(model, validated.eventId, ctx?.tx);
        checkEventCanEditMedia(actor, event);

        const mediaModel = new EventMediaModel();
        const { items: visibleRows } = await mediaModel.findByEvent({
            eventId: validated.eventId,
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
                `orderedIds does not match visible media for this event — ${details.join('; ')}`
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
 * Lists the media rows for an event's gallery.
 *
 * Returns all non-deleted rows ordered by `sortOrder ASC`. Supports an optional
 * `state` filter (defaults to `'visible'`). Gated with
 * {@link checkEventCanEditMedia} so an author sees only their own event's gallery.
 *
 * @param model - EventModel instance.
 * @param actor - The actor performing the action.
 * @param data - List-media input (`eventId` + optional `state`).
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<EventMediaListOutput>` containing the media array.
 */
export async function getEventMedia(
    model: EventModel,
    actor: Actor,
    data: EventMediaListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<EventMediaListOutput>> {
    try {
        const parseResult = EventMediaListInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const event = await requireEvent(model, validated.eventId, ctx?.tx);
        checkEventCanEditMedia(actor, event);

        const mediaModel = new EventMediaModel();
        const { items } = await mediaModel.findByEvent({
            eventId: validated.eventId,
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
 * Promotes a single photo to the featured image of an event.
 *
 * Steps:
 * 1. Gate on {@link checkEventCanEditMedia}.
 * 2. Verify the target media row exists AND belongs to this event.
 * 3. Guard: target row must be `state = 'visible'` — a DB CHECK constraint
 *    forbids `is_featured = true AND state = 'archived'`, so we reject early
 *    with a clear ServiceError rather than letting the DB raise.
 * 4. In a TRANSACTION: clear the previous featured row (`is_featured = false`),
 *    then set the target row `is_featured = true`. Clear-then-set order is
 *    mandatory — setting the new one first would briefly violate the partial
 *    unique index on (event_id) WHERE is_featured.
 *
 * @param model - EventModel instance.
 * @param actor - The actor performing the action.
 * @param data - Set-featured input (`eventId` + `mediaId`).
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<EventMediaSingleOutput>` containing the updated row.
 */
export async function setFeaturedEventMedia(
    model: EventModel,
    actor: Actor,
    data: EventMediaSetFeaturedInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<EventMediaSingleOutput>> {
    try {
        const parseResult = EventMediaSetFeaturedInputSchema.safeParse(data);
        if (!parseResult.success) return validationError(parseResult.error.issues);
        const validated = parseResult.data;

        const event = await requireEvent(model, validated.eventId, ctx?.tx);
        checkEventCanEditMedia(actor, event);

        const mediaModel = new EventMediaModel();
        const mediaRow = await mediaModel.findById(validated.mediaId, ctx?.tx);
        if (!mediaRow || mediaRow.eventId !== validated.eventId) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Media not found for this event');
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
        // (event_id) WHERE is_featured = true AND deleted_at IS NULL.
        const doSetFeatured = async (tx: DrizzleClient): Promise<void> => {
            const existing = await mediaModel.findFeatured({ eventId: validated.eventId, tx });
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
