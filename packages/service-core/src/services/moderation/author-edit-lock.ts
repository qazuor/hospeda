import { ModerationStatusEnum } from '@repo/schemas';

/**
 * Input for {@link isAuthorEditLockedByModeration}.
 */
export interface AuthorEditLockInput {
    /** The platform's current moderation verdict on the content. */
    readonly moderationState: ModerationStatusEnum | null | undefined;
    /**
     * Whether the actor may raise and lower publication on their own content
     * (a `*_PUBLISH_OWN` grant). A trusted editor is never locked, because they
     * can already unpublish, edit and republish to reach the same end state.
     */
    readonly canPublishOwn: boolean;
}

/**
 * Decides whether the moderation verdict locks content against edits by its
 * own author.
 *
 * This is the first write-side state gate in the codebase (HOS-374 §7.6.3):
 * every other permission check gates on ownership or on a permission flag, so
 * the rule is expressed once, here, instead of inline in each entity's
 * permission helper.
 *
 * An author who only holds `*_UPDATE_OWN` loses edit rights the moment the
 * platform approves their content — approved content is live, and changing it
 * silently would bypass the review that approved it. Holding `*_PUBLISH_OWN`
 * lifts the lock.
 *
 * The lock applies ONLY to the author path. An actor holding the broad
 * `*_UPDATE` permission (admin) is authorized before this predicate is ever
 * consulted.
 *
 * @param input - The moderation verdict plus the actor's publish capability.
 * @returns `true` when the author must be refused the edit.
 */
export const isAuthorEditLockedByModeration = ({
    moderationState,
    canPublishOwn
}: AuthorEditLockInput): boolean => {
    if (canPublishOwn) return false;
    return moderationState === ModerationStatusEnum.APPROVED;
};
