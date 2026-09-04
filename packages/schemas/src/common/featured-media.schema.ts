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
 * A cover replacement therefore has TWO outcomes to report, not one: the row
 * that was created, and what became of the row it replaced. The second half is
 * not cosmetic. The client renders the previous cover differently depending on
 * whether it joined the gallery or left it, so a response that omitted it would
 * leave a photo on screen that the server has archived.
 */

import { z } from 'zod';

/**
 * What happened to the cover that a new one replaced.
 *
 * - `demoted`  — kept, and moved into the gallery as an ordinary photo. This is
 *   the common case and matches what promoting a row has always done.
 * - `archived` — moved out of the VISIBLE gallery, because the gallery had no
 *   slot left to receive it. Nothing is deleted: the row and its stored asset
 *   survive and the existing restore endpoint brings the photo back once a slot
 *   frees up.
 *
 * The choice is the server's, and it is what keeps the gallery quota honest.
 * Always demoting would add one gallery row per replacement, so repeating the
 * swap would carry a host past their cap a photo at a time.
 */
export const PreviousFeaturedDispositionSchema = z.enum(['demoted', 'archived'], {
    message: 'zodError.common.media.featured.disposition.invalid'
});

/** Inferred type for {@link PreviousFeaturedDispositionSchema}. */
export type PreviousFeaturedDispositionType = z.infer<typeof PreviousFeaturedDispositionSchema>;

/**
 * The cover that was replaced, and its fate.
 *
 * `null` at the call site when the entity had no cover at all — the first cover
 * an entity ever gets replaces nothing.
 */
export const PreviousFeaturedOutcomeSchema = z.object({
    /** Id of the media row that used to be the cover. */
    id: z.string().uuid({ message: 'zodError.common.media.featured.previousId.invalid' }),
    /** Whether it was kept in the gallery or archived out of it. */
    disposition: PreviousFeaturedDispositionSchema
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
