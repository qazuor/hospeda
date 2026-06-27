/**
 * Approval workflow status values for social posts in the Hospeda social automation system (SPEC-254).
 *
 * Tracks the editorial review state independently of the post lifecycle status,
 * enabling fine-grained visibility into the approval workflow without conflating
 * it with the scheduling/publishing pipeline.
 *
 * @module social-approval-status.enum
 */

/**
 * All possible approval states for a social post.
 *
 * @example
 * ```ts
 * import { SocialApprovalStatusEnum } from '@repo/schemas';
 *
 * const approvalStatus: SocialApprovalStatusEnum = SocialApprovalStatusEnum.PENDING;
 * ```
 */
export enum SocialApprovalStatusEnum {
    /** Post is awaiting admin review; no approval decision has been made yet. */
    PENDING = 'PENDING',

    /** Admin has reviewed and approved the post content. */
    APPROVED = 'APPROVED',

    /** Admin has rejected the post; it will not be published as-is. */
    REJECTED = 'REJECTED',

    /** Admin has reviewed the post and requested changes before it can be approved. */
    CHANGES_REQUESTED = 'CHANGES_REQUESTED'
}
