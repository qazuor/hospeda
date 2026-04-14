/**
 * Per-request hook state for DestinationReviewService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface DestinationReviewHookState extends Record<string, unknown> {
    /** Destination ID of the review being deleted — for stats recalculation. */
    deletedDestinationId?: string;
    /** Destination ID of the review being restored — for stats recalculation. */
    restoredDestinationIdForReview?: string;
}
