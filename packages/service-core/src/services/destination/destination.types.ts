/**
 * Per-request hook state for DestinationService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context for concurrency safety.
 */
export interface DestinationHookState extends Record<string, unknown> {
    /** ID being updated .. set in update() override, read in _beforeUpdate. */
    updateId?: string;
    /** Pending path cascade data .. set in _beforeUpdate, read in update() after super call. */
    pendingPathUpdate?: { parentId: string; oldPath: string; newPath: string };
    /** Slug of the destination being deleted .. set in _beforeSoftDelete/_beforeHardDelete. */
    deletedDestinationSlug?: string;
    /** Slug of the destination being restored .. set in _beforeRestore. */
    restoredDestinationSlug?: string;
}
