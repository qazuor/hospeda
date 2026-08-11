/**
 * Review state of a partner's self-authored content (HOS-278 AC-11).
 *
 * Tracks the CURRENT submission only. Whether the partner has ever cleared
 * review — the fact the payment gate reads — lives in
 * `partners.contentApprovedAt`, not here. The two are deliberately separate:
 * a partner who is already published and edits their logo goes back to
 * {@link PartnerContentReviewStateEnum.PENDING} while keeping the approval
 * date they earned, so an edit never revokes the right to be charged for a
 * listing that is still showing vetted content.
 */
export enum PartnerContentReviewStateEnum {
    /** Content was submitted and is waiting for an admin to look at it. */
    PENDING = 'pending',
    /** An admin accepted the submission; the pending copy became the live one. */
    APPROVED = 'approved',
    /**
     * An admin turned the submission down.
     *
     * Distinct from "never submitted anything" on purpose: discarding the
     * pending copy without recording the refusal leaves the partner staring at
     * the same empty form, with nothing to tell them the logo they uploaded is
     * the reason they are still not published.
     */
    REJECTED = 'rejected'
}
