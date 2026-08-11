/**
 * Per-request hook state for PostService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface PostHookState extends Record<string, unknown> {
    /** ID being updated.. set in update() override, read in _beforeUpdate. */
    updateId?: string;
    /**
     * Post identifiers captured before soft-delete for post-delete side effects.
     *
     * Both identifiers are captured because the detail page tags itself with
     * BOTH (`post-<slug>` and `post-<id>`), and the row is gone by the time the
     * `_after*` hook runs — so whatever is not captured here can never be
     * purged.
     */
    deletedPost?: { slug: string; id: string };
    /** Post identifiers captured before restore for post-restore side effects. */
    restoredPost?: { slug: string; id: string };
    /** ID of the entity being hard-deleted, used for Cloudinary media cleanup. */
    deletedEntityId?: string;
    /**
     * Translatable field values captured from the entity BEFORE an update
     * (SPEC-212, AC-5). Set by `_beforeUpdate`, read by `_afterUpdate` to
     * emit a translate call only for fields whose Spanish source text changed.
     *
     * Keys: `title`, `summary`, `content`.
     * `undefined` value means the field was absent on the pre-update entity.
     */
    previousTranslatableFields?: Readonly<Record<string, string | undefined>>;
}
