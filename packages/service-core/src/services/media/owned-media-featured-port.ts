/**
 * @file owned-media-featured-port.ts
 * @description The single adapter that binds any per-entity media table to the
 * shared born-featured primitive (HOS-803).
 *
 * The five media tables — `accommodation_media`, `gastronomy_media`,
 * `experience_media`, `post_media`, `event_media` — are the same shape under
 * different names. Each has `is_featured`, `state`, `sort_order`, `deleted_at`
 * and exactly one owning foreign key, and each is reached through a model with
 * the same methods. The ONLY thing that varies between them is the name of that
 * foreign key.
 *
 * So there is one adapter, parameterised by that name, rather than one per
 * vertical. Five copies of this file would be five places for the release of
 * the outgoing cover to drift back into a demotion — which is what made every
 * cover replacement a permanent +1 to the gallery — and five places to forget
 * that `softDelete` alone leaves the row still flagged as the cover (C-1).
 */

import type { DrizzleClient } from '@repo/db';
import { ModerationStatusEnum } from '@repo/schemas';
import type { FeaturedMediaPort } from './add-featured-media';

/**
 * The slice of a media model this adapter drives.
 *
 * Declared structurally rather than by importing the concrete model classes,
 * because those classes are per-entity and this file is deliberately not.
 *
 * `findFeatured` is NOT part of this interface. Every model types its argument
 * as its own `FindFeaturedInput`, which names the entity's foreign key as a
 * required field, and a parameter that strict cannot accept a
 * `Record<string, unknown>` — so widening it here would mean erasing it to
 * `never` and losing the check entirely. It is passed in as a typed closure
 * instead (see {@link BuildOwnedMediaFeaturedPortInput.findFeatured}), which is
 * one line per call site and keeps the foreign key checked at each one.
 *
 * @typeParam TRow - The vertical's media row type.
 */
export type FeaturedCapableMediaModel<TRow> = {
    findAll(
        where: Record<string, unknown>,
        pagination?: unknown,
        extra?: unknown,
        tx?: DrizzleClient
    ): Promise<{ items: TRow[]; total: number }>;
    create(data: never, tx?: DrizzleClient): Promise<TRow>;
    update(where: Record<string, unknown>, data: never, tx?: DrizzleClient): Promise<TRow | null>;
    softDelete(
        where: Record<string, unknown>,
        deletedById: string | null,
        tx?: DrizzleClient
    ): Promise<number>;
};

/** Input for {@link buildOwnedMediaFeaturedPort}. */
export type BuildOwnedMediaFeaturedPortInput<TRow> = {
    /** Model instance used for every read and write. */
    readonly mediaModel: FeaturedCapableMediaModel<TRow>;
    /**
     * Name of the owning foreign-key column on the media table, in its
     * camelCase model form — `'accommodationId'`, `'gastronomyId'`,
     * `'experienceId'`, `'postId'`, `'eventId'`.
     */
    readonly ownerKey: string;
    /** Value of that foreign key: the entity gaining the cover. */
    readonly ownerId: string;
    /** Already-validated photo payload from the caller. */
    readonly media: Record<string, unknown>;
    /**
     * Reads the entity's current cover. Supplied by the caller rather than
     * taken off the model, because each model's `findFeatured` demands its own
     * foreign key by name — see the note on {@link FeaturedCapableMediaModel}.
     */
    readonly findFeatured: (tx: DrizzleClient) => Promise<TRow | null>;
    /**
     * Actor performing the upload, stamped on the soft delete of the cover
     * being replaced. A soft delete must record WHO, not only when — see
     * `scripts/check-soft-delete-actor.ts`.
     */
    readonly deletedById: string;
};

/**
 * Builds the port the featured-media primitive drives, for any entity whose
 * media table follows the shared shape.
 *
 * Holds no policy: the disposition of the old cover and the order of the writes
 * both live in {@link import('./add-featured-media').addFeaturedMediaRow}.
 *
 * @param input - Model, foreign key, owner id, payload, cover reader and actor — see {@link BuildOwnedMediaFeaturedPortInput}.
 * @returns A port bound to this entity and this payload.
 *
 * @example
 * ```ts
 * const port = buildOwnedMediaFeaturedPort({
 *     mediaModel: new GastronomyMediaModel(),
 *     ownerKey: 'gastronomyId',
 *     ownerId: gastronomyId,
 *     media: validated.media,
 *     findFeatured: (tx) => mediaModel.findFeatured({ gastronomyId, tx }),
 *     deletedById: actor.id
 * });
 * ```
 */
export function buildOwnedMediaFeaturedPort<TRow extends { readonly id: string }>({
    mediaModel,
    ownerKey,
    ownerId,
    media,
    findFeatured,
    deletedById
}: BuildOwnedMediaFeaturedPortInput<TRow>): FeaturedMediaPort<TRow> {
    const owner = { [ownerKey]: ownerId };

    return {
        // Deliberately NOT filtered by `isFeatured`: this read hands out the
        // next free position, and skipping the featured row would reuse a
        // sortOrder already taken whenever that row holds the maximum.
        findMaxVisibleSortOrder: async (tx: DrizzleClient) => {
            const existing = await mediaModel.findAll(
                { ...owner, state: 'visible', deletedAt: null },
                { pageSize: 1, sortBy: 'sortOrder', sortOrder: 'desc' },
                undefined,
                tx
            );
            const topOrder = existing.items[0]
                ? (existing.items[0] as { sortOrder?: number }).sortOrder
                : undefined;
            return typeof topOrder === 'number' && topOrder >= 0 ? topOrder : -1;
        },

        findFeatured,

        // TWO writes, and the order matters (HOS-803 C-1).
        //
        // `softDelete` patches `deletedAt`/`updatedAt`/`deletedById` and NOTHING
        // else, so on its own it leaves the released cover carrying
        // `is_featured = true`. The partial unique index is
        // `WHERE is_featured = true AND deleted_at IS NULL`, so it cannot see
        // that row — and `findById` does not filter soft-deletes, so
        // `setFeaturedMedia` could resolve it and re-feature it, demoting the
        // LIVE cover into the gallery to make room for a row that no longer
        // exists. Gallery +1 per cycle, uncapped. The guards added to the three
        // `setFeatured` functions close the other side of that door; this
        // clears the flag so there is nothing behind it either.
        //
        // Clearing it first also means the row is never both deleted and
        // flagged, so a future un-delete cannot collide with the incoming cover.
        //
        // The `where` carries the owning foreign key as well as the id. The id
        // comes from `findFeatured` and is already owner-scoped, so this is
        // belt-and-braces — but it costs nothing and it stops a future caller
        // from reaching another entity's row through this port.
        //
        // The stored asset is untouched on purpose: a soft delete that destroys
        // the original is not reversible.
        deletePrevious: async (mediaId: string, tx: DrizzleClient) => {
            await mediaModel.update({ id: mediaId, ...owner }, { isFeatured: false } as never, tx);
            // Canonical writer, so `deletedById` is stamped by the base model
            // rather than by an object literal — the shape
            // scripts/check-soft-delete-actor.ts checks for.
            await mediaModel.softDelete({ id: mediaId, ...owner }, deletedById, tx);
        },

        createFeatured: ({ sortOrder }, tx: DrizzleClient) =>
            mediaModel.create(
                {
                    ...media,
                    ...owner,
                    moderationState:
                        (media.moderationState as ModerationStatusEnum | undefined) ??
                        ModerationStatusEnum.PENDING,
                    state: 'visible',
                    // The whole point: featured on arrival, never a gallery row
                    // awaiting a promotion that may never be requested.
                    isFeatured: true,
                    sortOrder
                } as never,
                tx
            )
    };
}
