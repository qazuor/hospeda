/**
 * Per-request hook state for AccommodationReviewService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface AccommodationReviewHookState extends Record<string, unknown> {
    /** Accommodation ID of the review being deleted — for stats recalculation. */
    deletedAccommodationId?: string;
    /** Accommodation ID of the review being restored — for stats recalculation. */
    restoredAccommodationId?: string;
}
