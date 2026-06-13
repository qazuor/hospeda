/**
 * Per-request hook state for EventService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface EventHookState extends Record<string, unknown> {
    /**
     * ID of the entity being updated. Set by the public `update()` override so
     * that `_beforeUpdate` can fetch the pre-update entity (SPEC-212 AC-5).
     */
    updateId?: string;
    /** Entity data captured before soft-delete for post-delete side effects. */
    deletedEvent?: { slug: string; category?: string };
    /** Entity data captured before restore for post-restore side effects. */
    restoredEvent?: { slug: string; category?: string };
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
