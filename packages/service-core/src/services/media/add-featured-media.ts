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
 * ## Why a dedicated path and not a flag on `addMedia`
 *
 * The obvious repair — let the client say "this upload is the cover" and relax
 * the cap when it does — is exploitable. Nothing obliges a client to send the
 * follow-up promotion, and the server cannot verify a request that has not been
 * made, so a caller that sets the flag on EVERY upload simply has no gallery cap
 * at all: fifty exempt rows on a plan that grants fifteen.
 *
 * The exemption is only sound when the server GUARANTEES the outcome. Here the
 * row is created already featured, inside a transaction, and the partial unique
 * index (`uq_<entity>_media_single_featured`) permits exactly one such row per
 * entity. There is no window in which a quota-exempt row exists that is not the
 * cover, and repetition cannot accumulate them.
 *
 * ## The half that is easy to miss: what happens to the OLD cover
 *
 * `setFeaturedMedia` demotes the previous cover into the gallery. Left alone,
 * that turns every cover replacement into a permanent +1 to the gallery — and
 * repeating it walks straight past the cap one swap at a time, which is the very
 * evasion the dedicated path was supposed to close. The unique index does not
 * help: it constrains the featured row, not the residue.
 *
 * So the disposition of the previous cover is decided against the cap rather
 * than fixed:
 *
 *   - room in the gallery  → DEMOTE it (today's behaviour; the host keeps the photo)
 *   - gallery already full → ARCHIVE it (`state = 'archived'`, reversible through
 *     the existing restore endpoint; it leaves the visible gallery, so the count
 *     does not move)
 *
 * which makes the post-condition hold unconditionally:
 *
 *   **after this returns, visible gallery rows <= effective cap, and exactly one
 *   featured row exists.**
 *
 * Archiving rather than refusing is what keeps the original bug fixed: a host at
 * the cap can always replace their cover, and never loses the old photo.
 *
 * ## Write ordering
 *
 * The previous cover is cleared BEFORE the new row is inserted. The reverse
 * order would transiently leave two rows with `is_featured = true`, which the
 * partial unique index rejects — the same clear-then-set contract
 * `setFeaturedMedia` already follows.
 *
 * ## Caps: two of them, and only one is ever waived
 *
 * `entityGalleryCap` is the per-entity structural cap (`getGalleryCap`) and
 * always applies — a cover is still a media row and still costs a stored asset.
 * `planGalleryCap` is the subscriber's plan allowance, known only to the API
 * route (it needs the Hono context the entitlement middleware populates), so it
 * is passed in. It is a SERVER-DERIVED value: it must never be reachable from a
 * request body, or the evasion above returns through the front door.
 */

import type { DrizzleClient } from '@repo/db';
import { withTransaction } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types';

/**
 * What became of the cover that this one replaced.
 *
 * - `demoted`  — kept, and moved into the gallery as an ordinary photo.
 * - `archived` — moved out of the visible gallery because it had no room left.
 *   Not deleted: the row and its binary survive, and the existing restore
 *   endpoint brings it back once a gallery slot frees up.
 */
export type PreviousFeaturedDisposition = 'demoted' | 'archived';

/** The previous cover and what happened to it, or `null` when there was none. */
export type PreviousFeaturedOutcome = {
    /** Id of the media row that used to be the cover. */
    readonly id: string;
    /** Whether it was kept in the gallery or archived out of it. */
    readonly disposition: PreviousFeaturedDisposition;
};

/**
 * The narrow set of media-table operations the primitive needs.
 *
 * Each vertical supplies its own adapter because the five media tables have
 * different foreign-key columns (`accommodationId`, `gastronomyId`, …) and no
 * shared base class. Keeping the port this small is what keeps the POLICY —
 * cap arithmetic, disposition choice, write ordering — in one place instead of
 * being re-derived per entity.
 *
 * Every method receives the transaction client explicitly; none of them may
 * open a transaction of its own.
 *
 * @typeParam TRow - The vertical's media row type. Must expose `id`, which is
 * how the previous cover is addressed for demotion or archival.
 */
export type FeaturedMediaPort<TRow extends { readonly id: string }> = {
    /**
     * Number of rows in the VISIBLE gallery: `state = 'visible'`,
     * `isFeatured = false`, not soft-deleted. The featured row is excluded on
     * purpose (HOS-791) — it is not a gallery item.
     */
    readonly countVisibleGallery: (tx: DrizzleClient) => Promise<number>;
    /**
     * Highest `sortOrder` among the entity's visible rows, or `-1` when there
     * are none. Used to append the new row rather than collide with an existing
     * position.
     */
    readonly findMaxVisibleSortOrder: (tx: DrizzleClient) => Promise<number>;
    /** The current featured row, or `null` when the entity has no cover yet. */
    readonly findFeatured: (tx: DrizzleClient) => Promise<TRow | null>;
    /** Clears `isFeatured` on a row, leaving it visible in the gallery. */
    readonly demote: (mediaId: string, tx: DrizzleClient) => Promise<void>;
    /**
     * Clears `isFeatured` AND archives the row in a SINGLE write. Both columns
     * must move together: the CHECK constraint
     * `NOT (is_featured AND state = 'archived')` rejects any intermediate state
     * where the row is still featured and already archived.
     */
    readonly archive: (mediaId: string, tx: DrizzleClient) => Promise<void>;
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
    /** Per-entity structural cap (`getGalleryCap`). Never waived. */
    readonly entityGalleryCap: number;
    /**
     * The subscriber's plan gallery allowance, resolved SERVER-SIDE from the
     * entitlement context. `undefined` or `-1` means unlimited (or that the
     * vertical has no plan tiering at all). `0` means the plan grants no photos
     * and the call is refused outright.
     *
     * Must never be populated from a request body.
     */
    readonly planGalleryCap?: number | undefined;
    /** Existing transaction to join. When omitted, one is opened. */
    readonly tx?: DrizzleClient | undefined;
};

/** Result of {@link addFeaturedMediaRow}. */
export type AddFeaturedMediaResult<TRow extends { readonly id: string }> = {
    /** The newly created row, already featured. */
    readonly media: TRow;
    /** The cover this one replaced, and its fate. `null` when there was none. */
    readonly previousFeatured: PreviousFeaturedOutcome | null;
};

/**
 * Resolves the cap that actually governs the gallery.
 *
 * The tighter of the two wins. A plan allowance of `-1` (or absent) means
 * unlimited, in which case only the structural cap applies.
 *
 * @param params - The two caps.
 * @returns The effective gallery cap.
 */
export function resolveEffectiveGalleryCap({
    entityGalleryCap,
    planGalleryCap
}: {
    readonly entityGalleryCap: number;
    readonly planGalleryCap?: number | undefined;
}): number {
    if (planGalleryCap === undefined || planGalleryCap < 0) {
        return entityGalleryCap;
    }
    return Math.min(entityGalleryCap, planGalleryCap);
}

/**
 * Creates a media row that is featured from the moment it exists, disposing of
 * the previous cover in the same transaction.
 *
 * The caller is responsible for authorization and for validating the payload
 * before reaching here; this function owns only the cap arithmetic, the
 * disposition of the old cover, and the write ordering.
 *
 * @param params - Port, caps and optional transaction — see {@link AddFeaturedMediaParams}.
 * @returns The created row plus what happened to the previous cover.
 * @throws {ServiceError} `LIMIT_REACHED` when the plan grants no photos at all.
 *
 * @example
 * ```ts
 * const { media, previousFeatured } = await addFeaturedMediaRow({
 *     port: buildAccommodationFeaturedMediaPort({ mediaModel, accommodationId, payload }),
 *     entityGalleryCap: getGalleryCap('accommodation'),
 *     planGalleryCap: 15
 * });
 * ```
 */
export async function addFeaturedMediaRow<TRow extends { readonly id: string }>(
    params: AddFeaturedMediaParams<TRow>
): Promise<AddFeaturedMediaResult<TRow>> {
    const { port, entityGalleryCap, planGalleryCap, tx } = params;

    // A plan that allows zero photos allows no cover either. Refusing here is
    // deliberate: HOS-791 exempts the cover from the GALLERY count, it does not
    // grant a photo to a plan that includes none.
    if (planGalleryCap === 0) {
        throw new ServiceError(
            ServiceErrorCode.LIMIT_REACHED,
            'Your current plan does not include photos. Upgrade your plan to add a cover image.'
        );
    }

    const effectiveCap = resolveEffectiveGalleryCap({ entityGalleryCap, planGalleryCap });

    const run = async (client: DrizzleClient): Promise<AddFeaturedMediaResult<TRow>> => {
        const previous = await port.findFeatured(client);

        let previousFeatured: PreviousFeaturedOutcome | null = null;

        if (previous) {
            const previousId: string = previous.id;

            // Counted BEFORE the demotion, so the number describes the gallery
            // the demoted row would be joining.
            const galleryCount = await port.countVisibleGallery(client);

            if (galleryCount < effectiveCap) {
                await port.demote(previousId, client);
                previousFeatured = { id: previousId, disposition: 'demoted' };
            } else {
                // No room. Archiving keeps the photo and keeps the count where
                // it is — refusing instead would reinstate the original bug.
                await port.archive(previousId, client);
                previousFeatured = { id: previousId, disposition: 'archived' };
            }
        }

        // Clear-then-set: the insert happens only after the old cover has given
        // up `is_featured`, so the partial unique index never sees two.
        const maxSortOrder = await port.findMaxVisibleSortOrder(client);
        const media = await port.createFeatured({ sortOrder: maxSortOrder + 1 }, client);

        return { media, previousFeatured };
    };

    return tx ? run(tx) : withTransaction(run);
}
