/**
 * Conversation lifecycle status values for guest-owner messaging.
 *
 * Tracks the current state of a conversation from initial anonymous
 * verification through active messaging and eventual closure or blocking.
 *
 * @module conversation-status.enum
 */

/**
 * All possible states a conversation can occupy.
 *
 * State transitions:
 * - `PENDING_VERIFICATION` → `PENDING_OWNER` (guest email verified)
 * - `PENDING_OWNER` → `OPEN` (owner replies)
 * - `OPEN` → `PENDING_GUEST` (owner sends a message, guest has not yet replied)
 * - `OPEN` / `PENDING_GUEST` / `PENDING_OWNER` → `CLOSED` (either party closes)
 * - Any state → `BLOCKED` (admin or owner blocks the conversation)
 *
 * @example
 * ```ts
 * import { ConversationStatusEnum } from '@repo/schemas';
 *
 * const status: ConversationStatusEnum = ConversationStatusEnum.PENDING_VERIFICATION;
 * ```
 */
export enum ConversationStatusEnum {
    /** Anonymous guest has submitted the initiation form; email verification link sent but not yet confirmed. */
    PENDING_VERIFICATION = 'PENDING_VERIFICATION',

    /** Guest email verified (or guest is authenticated); waiting for the owner to respond. */
    PENDING_OWNER = 'PENDING_OWNER',

    /** Owner has replied; waiting for the guest to respond. */
    PENDING_GUEST = 'PENDING_GUEST',

    /** Active conversation — both parties have exchanged at least one message. */
    OPEN = 'OPEN',

    /** Conversation ended by either party; no further messages accepted. */
    CLOSED = 'CLOSED',

    /** Conversation blocked by admin or owner due to abuse or policy violation. */
    BLOCKED = 'BLOCKED'
}
