/**
 * @file conversation-bubble-side.ts
 * @description Resolves which side of a conversation thread a message bubble
 * belongs to, relative to the person LOOKING at the thread (HOS-2419).
 *
 * The bubble alignment used to follow the sender type alone, so in the guest's
 * own thread their messages rendered on the left, as if written by the other
 * party. "Mine" is a property of the viewer, never of the sender type.
 */

/** Which role is reading the thread. */
export type ConversationViewerRole = 'guest' | 'owner';

/** Side a bubble renders on: own messages right, the other party left. */
export type ConversationBubbleSide = 'mine' | 'theirs' | 'system';

/**
 * Resolves the bubble side for one message.
 *
 * @param input - Receive-object.
 * @param input.senderType - The message's sender type (`guest`, `owner`, `system`), any case.
 * @param input.viewerRole - The role of the person viewing the thread.
 * @returns `mine` when the viewer wrote it, `theirs` for the other party, `system` otherwise.
 */
export const resolveConversationBubbleSide = ({
    senderType,
    viewerRole
}: {
    readonly senderType: string | null | undefined;
    readonly viewerRole: ConversationViewerRole;
}): ConversationBubbleSide => {
    const sender = senderType?.toLowerCase();
    if (sender === 'guest' || sender === 'owner') {
        return sender === viewerRole ? 'mine' : 'theirs';
    }
    return 'system';
};
