/**
 * @file add-featured-media.ts
 * @description The shared "a cover photo is born featured" primitive, used by
 * every vertical that has both a featured image and a capped gallery (HOS-803).
 *
 * ## Why this exists
 *
 * Setting a cover used to take two requests. The client uploaded the file, then
 * called `addMedia` to register an ordinary gallery row, then called
 * `setFeaturedMedia` to promote that row. The middle step passes the gallery cap
 * gate — and since HOS-791 that gate counts the gallery ALONE, because a cover
 * is not a gallery item and must not consume a gallery slot.
 *
 * The consequence was backwards: a host whose gallery sat exactly at the cap was
 * refused at step 1 and could never reach step 2. The single action HOS-791
 * declared free of gallery quota became the only action they could not perform.
 *
 * ## The rule
 *
 * Uploading a NEW photo into the cover slot creates the row already featured and
 * SOFT-DELETES the cover it replaces, in the same transaction. Unconditionally:
 * neither the quota nor the amount of room in the gallery is consulted.
 *
 * That is what makes the operation **quota-neutral by construction**. One row
 * enters the featured slot, one leaves the table, and the visible gallery is
 * never touched — so a cover upload cannot move any cap, and there is nothing
 * for a cap to protect. Skipping the gallery gate is safe because the operation
 * provably costs the gallery nothing, not because an exception was carved out.
 *
 * ## Why deletion, and not demotion
 *
 * `setFeaturedMedia` demotes the previous cover into the gallery. Carrying that
 * onto the UPLOAD path is the mistake this file exists to prevent: it makes
 * every replacement a permanent +1 to the gallery, so repeating it walks past
 * the cap one cover-swap at a time. The atomic create does not stop that on its
 * own — the partial unique index constrains the featured row, not the residue
 * it leaves behind.
 *
 * **This applies to the upload path only.** Promoting a photo that is ALREADY in
 * the gallery stays exactly as it was: the old cover goes down into the gallery
 * and the promoted one comes out of it. That exchange is quota-neutral by
 * itself, and deleting there would destroy a photo the owner never asked to
 * remove.
 *
 * ## Soft, not hard
 *
 * The replaced cover is soft-deleted (`deletedAt`), through the model's
 * canonical `softDelete` so authorship is recorded — see
 * `scripts/check-soft-delete-actor.ts`. It leaves every cap, because all three
 * counting paths filter soft-deleted rows: the service-layer entity cap, the
 * route's plan cap via `findByAccommodation`, and the upload route's
 * `resolveVisibleGalleryCount`.
 *
 * The stored Cloudinary asset is deliberately NOT deleted. A soft delete that
 * destroys the original is not reversible, which would defeat the point of its
 * being soft.
 *
 * ## Write ordering
 *
 * The previous cover is released BEFORE the new row is inserted. The reverse
 * order would transiently leave two live rows with `is_featured = true`, which
 * the partial unique index rejects — the same clear-then-set contract
 * `setFeaturedMedia` already follows.
 */

import type { DrizzleClient } from '@repo/db';
import { withTransaction } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types';

/**
 * The cover that was replaced.
 *
 * `null` at the call site when the entity had no cover at all — the first cover
 * an entity ever gets replaces nothing.
 *
 * Carries only the id: what happened to it is no longer a variable, because it
 * is always soft-deleted.
 */
export type PreviousFeaturedOutcome = {
    /** Id of the media row that used to be the cover, now soft-deleted. */
    readonly id: string;
};

/**
 * The narrow set of media-table operations the primitive needs.
 *
 * Each vertical supplies its own adapter because the five media tables have
 * different foreign-key columns (`accommodationId`, `gastronomyId`, …) and no
 * shared base class. Keeping the port this small is what keeps the POLICY —
 * the disposition of the old cover and the write ordering — in one place
 * instead of being re-derived per entity.
 *
 * Every method receives the transaction client explicitly; none of them may
 * open a transaction of its own.
 *
 * @typeParam TRow - The vertical's media row type. Must expose `id`, which is
 * how the previous cover is addressed for deletion.
 */
export type FeaturedMediaPort<TRow extends { readonly id: string }> = {
    /**
     * Highest `sortOrder` among the entity's visible rows, or `-1` when there
     * are none. Used to append the new row rather than collide with an existing
     * position.
     */
    readonly findMaxVisibleSortOrder: (tx: DrizzleClient) => Promise<number>;
    /** The current featured row, or `null` when the entity has no cover yet. */
    readonly findFeatured: (tx: DrizzleClient) => Promise<TRow | null>;
    /**
     * Soft-deletes the outgoing cover, recording who did it. The row leaves
     * every gallery count; its stored asset is left alone.
     */
    readonly deletePrevious: (mediaId: string, tx: DrizzleClient) => Promise<void>;
    /** Inserts the new row with `isFeatured = true` and `state = 'visible'`. */
    readonly createFeatured: (
        input: { readonly sortOrder: number },
        tx: DrizzleClient
    ) => Promise<TRow>;
};

/** Input for {@link addFeaturedMediaRow}. */
export type AddFeaturedMediaParams<TRow extends { readonly id: string }> = {
    /** The vertical's adapter over its media table. */
    readonly port: FeaturedMediaPort<TRow>;
    /**
     * The subscriber's plan gallery allowance, resolved SERVER-SIDE from the
     * entitlement context.
     *
     * It does NOT gate the swap — that is quota-neutral — and is read for
     * exactly one thing: `0` means the plan includes no photos at all, so it
     * grants no cover either and the call is refused. A merely FULL allowance
     * is not a refusal; treating it as one was the reported bug.
     *
     * `undefined` or a negative value means unlimited, or that the vertical has
     * no plan tiering. Must never be populated from a request body.
     */
    readonly planGalleryCap?: number | undefined;
    /** Existing transaction to join. When omitted, one is opened. */
    readonly tx?: DrizzleClient | undefined;
};

/** Result of {@link addFeaturedMediaRow}. */
export type AddFeaturedMediaResult<TRow extends { readonly id: string }> = {
    /** The newly created row, already featured. */
    readonly media: TRow;
    /** The cover this one replaced and deleted. `null` when there was none. */
    readonly previousFeatured: PreviousFeaturedOutcome | null;
};

/**
 * Creates a media row that is featured from the moment it exists, deleting the
 * previous cover in the same transaction.
 *
 * The caller is responsible for authorization and for validating the payload
 * before reaching here; this function owns only the disposition of the old
 * cover and the write ordering.
 *
 * @param params - Port, plan allowance and optional transaction — see {@link AddFeaturedMediaParams}.
 * @returns The created row plus the id of the cover it replaced.
 * @throws {ServiceError} `LIMIT_REACHED` when the plan grants no photos at all.
 *
 * @example
 * ```ts
 * const { media, previousFeatured } = await addFeaturedMediaRow({
 *     port: buildOwnedMediaFeaturedPort({ mediaModel, ownerKey, ownerId, media, findFeatured, deletedById }),
 *     planGalleryCap: 15
 * });
 * ```
 */
export async function addFeaturedMediaRow<TRow extends { readonly id: string }>(
    params: AddFeaturedMediaParams<TRow>
): Promise<AddFeaturedMediaResult<TRow>> {
    const { port, planGalleryCap, tx } = params;

    // The one thing the allowance still decides. A plan that includes zero
    // photos includes no cover either: HOS-791 exempts the cover from the
    // GALLERY count, it does not grant a photo to a plan that has none.
    if (planGalleryCap === 0) {
        throw new ServiceError(
            ServiceErrorCode.LIMIT_REACHED,
            'Your current plan does not include photos. Upgrade your plan to add a cover image.'
        );
    }

    const run = async (client: DrizzleClient): Promise<AddFeaturedMediaResult<TRow>> => {
        const previous = await port.findFeatured(client);

        let previousFeatured: PreviousFeaturedOutcome | null = null;

        if (previous) {
            const previousId: string = previous.id;
            await port.deletePrevious(previousId, client);
            previousFeatured = { id: previousId };
        }

        // Release-then-create: the insert happens only after the old cover has
        // left, so the partial unique index never sees two live featured rows.
        const maxSortOrder = await port.findMaxVisibleSortOrder(client);
        const media = await port.createFeatured({ sortOrder: maxSortOrder + 1 }, client);

        return { media, previousFeatured };
    };

    return tx ? run(tx) : withTransaction(run);
}
