/**
 * gallery-count.ts
 *
 * Single source of truth for "how many gallery photos does this entity already
 * have", used by BOTH upload endpoints when enforcing the per-entity gallery cap.
 *
 * ## Why this is shared rather than inlined
 *
 * The cap check previously existed as two independent copies — one in
 * `protected/upload-entity.ts`, one in `admin/upload.ts` — that had already
 * drifted apart: the admin copy counted relational rows for accommodations while
 * the protected copy still read the JSONB blob for every entity type. Two copies
 * of a limit check is a fail-open waiting to happen, because updating one and
 * forgetting the other silently removes the cap on that path rather than breaking
 * anything visibly.
 *
 * Keeping the resolution here means a vertical whose media moves to a relational
 * table gets counted correctly on every upload path at once (HOS-372).
 *
 * ## Where each entity type is counted from
 *
 * | Entity type   | Counted from                                  |
 * |---------------|-----------------------------------------------|
 * | accommodation | `accommodation_media` rows (`state='visible'`) |
 * | gastronomy    | `gastronomy_media` rows (`state='visible'`)    |
 * | experience    | `experience_media` rows (`state='visible'`)    |
 * | destination   | JSONB `media.gallery`                          |
 * | event         | JSONB `media.gallery`                          |
 * | post          | JSONB `media.gallery`                          |
 *
 * The JSONB branch is NOT legacy dead code: destinations, events and posts still
 * keep their whole media object in a JSONB column and were never part of the
 * relational migration. It is the correct source for them.
 *
 * @module routes/media/gallery-count
 */

import { accommodationMediaModel, experienceMediaModel, gastronomyMediaModel } from '@repo/db';

/**
 * Inputs for {@link resolveVisibleGalleryCount}.
 */
export interface ResolveVisibleGalleryCountInput {
    /** The entity type the upload targets. */
    readonly entityType: string;
    /** UUID of the entity the upload targets. */
    readonly entityId: string;
    /**
     * The already-fetched entity, used only for the JSONB-backed entity types.
     * Passed in rather than re-fetched because both callers have loaded it for
     * their ownership check already.
     */
    readonly entity: unknown;
}

/** Reads `media.gallery.length` off an entity whose media is still a JSONB blob. */
function countFromJsonb(entity: unknown): number {
    const media = (entity as { media?: { gallery?: unknown[] } } | null | undefined)?.media;
    return media?.gallery?.length ?? 0;
}

/**
 * Returns how many VISIBLE gallery photos an entity currently has, reading from
 * whichever store owns that entity type's media.
 *
 * Archived rows are deliberately excluded: an archived photo is not occupying a
 * gallery slot, so counting it would cap an owner below their real allowance.
 *
 * @param input - {@link ResolveVisibleGalleryCountInput}
 * @returns The current visible gallery photo count.
 */
export async function resolveVisibleGalleryCount(
    input: ResolveVisibleGalleryCountInput
): Promise<number> {
    const { entityType, entityId, entity } = input;

    switch (entityType) {
        case 'accommodation': {
            const { total } = await accommodationMediaModel.findByAccommodation({
                accommodationId: entityId,
                state: 'visible'
            });
            return total;
        }
        case 'gastronomy': {
            const { total } = await gastronomyMediaModel.findByGastronomy({
                gastronomyId: entityId,
                state: 'visible'
            });
            return total;
        }
        case 'experience': {
            const { total } = await experienceMediaModel.findByExperience({
                experienceId: entityId,
                state: 'visible'
            });
            return total;
        }
        default:
            return countFromJsonb(entity);
    }
}
