/**
 * accommodation.publish-readiness.ts
 *
 * The ONE mapping from a stored accommodation (plus its `accommodation_media`
 * rows) to the facts `resolveMissingPublishRequirements` judges (H-101). It is
 * pure, so a caller that already loaded the media rows for many accommodations
 * in one batch query (`findByAccommodations`) can evaluate all of them without
 * a query per listing (HOS-2331 `get_owner_summary`), while
 * `AccommodationService.readPublishCompleteness` keeps evaluating one.
 *
 * @module accommodation.publish-readiness
 */

import type {
    Accommodation,
    AccommodationMedia,
    AccommodationPublishReadinessInput
} from '@repo/schemas';
import { composeAccommodationMedia } from './accommodation.media-compose';

/**
 * Builds the publish-readiness facts of one accommodation.
 *
 * @param input.accommodation - The stored accommodation
 * @param input.mediaRows - Its `accommodation_media` rows (empty when it has none)
 * @returns The facts the publish requirements are judged on
 *
 * @example
 * ```ts
 * const grouped = await mediaModel.findByAccommodations({ accommodationIds: ids });
 * const facts = buildAccommodationPublishReadinessInput({
 *     accommodation,
 *     mediaRows: grouped.get(accommodation.id) ?? []
 * });
 * const missing = resolveMissingPublishRequirements({ input: facts });
 * ```
 */
export function buildAccommodationPublishReadinessInput({
    accommodation,
    mediaRows
}: {
    readonly accommodation: Accommodation;
    readonly mediaRows: readonly AccommodationMedia[];
}): AccommodationPublishReadinessInput {
    const composedMedia = composeAccommodationMedia({
        rows: mediaRows,
        videos: accommodation.videos
    });
    const extraInfo = accommodation.extraInfo ?? {};
    return {
        description: accommodation.description,
        capacity: extraInfo.capacity,
        // HOS-2060: the minimum stay is a house rule now.
        minNights: accommodation.policies?.minNights ?? undefined,
        bedrooms: extraInfo.bedrooms,
        bathrooms: extraInfo.bathrooms,
        hasMainImage: Boolean(composedMedia.featuredImage?.url)
    };
}
