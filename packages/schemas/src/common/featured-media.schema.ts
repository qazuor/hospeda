/**
 * @file featured-media.schema.ts
 * @description Shared shapes for the "upload straight to featured" endpoints
 * that every vertical with a cover image exposes (HOS-803).
 *
 * Setting a cover used to be two requests — register an ordinary gallery row,
 * then promote it — and the first of the two was refused whenever the gallery
 * sat at its cap, which made replacing a cover impossible for exactly the hosts
 * who most wanted to. The dedicated endpoints create the row already featured,
 * in one transaction.
 *
 * A cover replacement therefore touches TWO rows: the one created, and the one
 * it replaced, which is soft-deleted in the same transaction. The response names
 * both — the second so a client holding the old row learns it is gone rather
 * than keeping it on screen.
 */

import { z } from 'zod';

/**
 * The cover that was replaced by a newly uploaded one.
 *
 * `null` at the call site when the entity had no cover at all — the first cover
 * an entity ever gets replaces nothing.
 *
 * Carries only the id. There is no `disposition` field: what happens to the old
 * cover is not a variable. Uploading a NEW photo into the cover slot always
 * soft-deletes the one it replaces, whether or not the gallery has room, which
 * is what makes the swap quota-neutral — one row into the featured slot, one out
 * of the table, gallery untouched.
 *
 * The id is still reported because the deletion is a destructive side effect the
 * caller did not ask for by id, and a response that performed it silently would
 * leave any consumer holding that row — a cached list, a log, an optimistic
 * client — with no way to learn which one went.
 *
 * Note this describes the UPLOAD path only. Promoting a photo already in the
 * gallery still demotes the old cover into it and deletes nothing.
 */
export const PreviousFeaturedOutcomeSchema = z.object({
    /** Id of the media row that used to be the cover, now soft-deleted. */
    id: z.string().uuid({ message: 'zodError.common.media.featured.previousId.invalid' })
});

/** Inferred type for {@link PreviousFeaturedOutcomeSchema}. */
export type PreviousFeaturedOutcomeType = z.infer<typeof PreviousFeaturedOutcomeSchema>;

/**
 * The plan gallery allowance a featured-media service call may be given.
 *
 * SERVER-DERIVED, always. Only the API route can resolve it, because it reads
 * the entitlement context the middleware populates. It is declared here so the
 * service input can validate it, and it must never appear in a request body
 * schema: a client able to state its own cap could restore precisely the
 * evasion this endpoint family was built to close.
 *
 * `undefined` means the vertical has no plan tiering, or the plan is unlimited.
 * A negative value carries the entitlement layer's own spelling of "unlimited".
 */
export const PlanGalleryCapSchema = z
    .number()
    .int({ message: 'zodError.common.media.featured.planCap.int' })
    .optional();
