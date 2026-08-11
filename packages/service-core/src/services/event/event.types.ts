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
    /**
     * Entity identifiers captured before soft-delete for post-delete side effects.
     *
     * Both identifiers are captured because the detail page tags itself with
     * BOTH (`event-<slug>` and `event-<id>`), and the row is gone by the time
     * the `_after*` hook runs — so whatever is not captured here can never be
     * purged.
     */
    deletedEvent?: { slug: string; id: string };
    /** Entity identifiers captured before restore for post-restore side effects. */
    restoredEvent?: { slug: string; id: string };
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
