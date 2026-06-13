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
    /** ID of the entity being hard-deleted, used for Cloudinary media cleanup. */
    deletedEntityId?: string;
    /**
     * Translatable field values captured from the entity BEFORE an update
     * (SPEC-212, AC-5). Set by `_beforeUpdate`, read by `_afterUpdate` to
     * emit a translate call only for fields whose Spanish source text changed.
     *
     * Keys: `name`, `summary`, `description`.
     * `undefined` value means the field was absent on the pre-update entity.
     */
    previousTranslatableFields?: Readonly<Record<string, string | undefined>>;
}
