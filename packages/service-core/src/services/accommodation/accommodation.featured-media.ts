/**
 * @file accommodation.featured-media.ts
 * @description The accommodation adapter for the shared born-featured media
 * primitive (HOS-803).
 *
 * All of the policy — which cap governs, whether the previous cover is demoted
 * or archived, the order the writes happen in — lives in
 * `services/media/add-featured-media.ts`. This file only translates that
 * primitive's vocabulary into `accommodation_media`'s column names, so the five
 * verticals that need this behaviour share one implementation of the rules and
 * differ only in their foreign key.
 */

import type { AccommodationMediaModel, DrizzleClient } from '@repo/db';
import type { AccommodationMedia, AccommodationMediaAddPayload } from '@repo/schemas';
import { ModerationStatusEnum } from '@repo/schemas';
import type { FeaturedMediaPort } from '../media/add-featured-media';

/** Input for {@link buildAccommodationFeaturedMediaPort}. */
export type BuildAccommodationFeaturedMediaPortInput = {
    /** Model instance used for every read and write. */
    readonly mediaModel: AccommodationMediaModel;
    /** Parent accommodation the new cover belongs to. */
    readonly accommodationId: string;
    /** Already-validated photo payload from the caller. */
    readonly media: AccommodationMediaAddPayload;
};

/**
 * Builds the accommodation-flavoured port the featured-media primitive drives.
 *
 * @param input - Model, parent id and validated payload — see {@link BuildAccommodationFeaturedMediaPortInput}.
 * @returns A port bound to this accommodation and this payload.
 *
 * @example
 * ```ts
 * const port = buildAccommodationFeaturedMediaPort({ mediaModel, accommodationId, media });
 * const { media: row } = await addFeaturedMediaRow({ port, entityGalleryCap: 50 });
 * ```
 */
export function buildAccommodationFeaturedMediaPort({
    mediaModel,
    accommodationId,
    media
}: BuildAccommodationFeaturedMediaPortInput): FeaturedMediaPort<AccommodationMedia> {
    return {
        // HOS-791: the cover is not a gallery item, so every read that MEASURES
        // the gallery excludes it. Dropping `isFeatured: false` here would close
        // the gallery one photo early, which is the bug HOS-791 fixed.
        countVisibleGallery: (tx: DrizzleClient) =>
            mediaModel.count(
                {
                    accommodationId,
                    state: 'visible',
                    isFeatured: false,
                    deletedAt: null
                },
                { tx }
            ),

        // Deliberately UNFILTERED by `isFeatured`: this read hands out the next
        // free position, and skipping the featured row would reuse a sortOrder
        // already taken whenever that row holds the maximum.
        findMaxVisibleSortOrder: async (tx: DrizzleClient) => {
            const existing = await mediaModel.findAll(
                { accommodationId, state: 'visible', deletedAt: null },
                { pageSize: 1, sortBy: 'sortOrder', sortOrder: 'desc' },
                undefined,
                tx
            );
            const topOrder = existing.items[0]?.sortOrder;
            return typeof topOrder === 'number' && topOrder >= 0 ? topOrder : -1;
        },

        findFeatured: (tx: DrizzleClient) => mediaModel.findFeatured({ accommodationId, tx }),

        demote: async (mediaId: string, tx: DrizzleClient) => {
            await mediaModel.update({ id: mediaId }, { isFeatured: false }, tx);
        },

        // One statement, both columns. The CHECK constraint
        // `NOT (is_featured AND state = 'archived')` rejects any row that is
        // still featured and already archived, so these cannot be split.
        archive: async (mediaId: string, tx: DrizzleClient) => {
            await mediaModel.update(
                { id: mediaId },
                { isFeatured: false, state: 'archived', archivedAt: new Date() },
                tx
            );
        },

        createFeatured: ({ sortOrder }, tx: DrizzleClient) =>
            mediaModel.create(
                {
                    ...media,
                    accommodationId,
                    moderationState: media.moderationState ?? ModerationStatusEnum.PENDING,
                    state: 'visible' as const,
                    // The whole point: the row is featured on arrival, never a
                    // gallery row awaiting a promotion that may never come.
                    isFeatured: true,
                    sortOrder
                } as Partial<AccommodationMedia>,
                tx
            )
    };
}
