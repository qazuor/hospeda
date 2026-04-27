/**
 * @module conversation.permissions
 *
 * Pure permission-check functions for the ConversationService.
 *
 * Each function throws `ServiceError(FORBIDDEN, ..., 'REASON_CODE')` on failure.
 * NEVER checks roles — only granular `PermissionEnum` values.
 *
 * @see {@link ConversationService}
 */

import type { SelectConversation } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the actor (guest side) is the conversation owner:
 * either their userId matches or their anonymousEmail matches.
 */
function _isGuestParticipant(actor: Actor, conversation: SelectConversation): boolean {
    if (conversation.userId && conversation.userId === actor.id) {
        return true;
    }
    return false;
}

/**
 * Returns true when the actor (owner side) owns at least one accommodation
 * that matches the conversation's accommodation.
 */
function _isOwnerParticipant(
    conversation: SelectConversation,
    ownerAccommodationIds: readonly string[]
): boolean {
    return ownerAccommodationIds.includes(conversation.accommodationId);
}

// ---------------------------------------------------------------------------
// Public permission functions
// ---------------------------------------------------------------------------

/**
 * Checks whether an actor can view the given conversation.
 *
 * Grant rules (first match wins):
 * 1. Admin/super-admin with `CONVERSATION_VIEW_ALL` → always allowed.
 * 2. Actor with `CONVERSATION_VIEW_ANY` → always allowed.
 * 3. Guest (has `CONVERSATION_VIEW_OWN`) whose userId matches → allowed.
 * 4. Owner (has `CONVERSATION_VIEW_OWN`) whose accommodation is in ownerAccommodationIds → allowed.
 *
 * @param actor - Actor performing the request.
 * @param conversation - The conversation being accessed.
 * @param ownerAccommodationIds - Accommodation IDs owned by the actor (for owner check).
 *
 * @throws {ServiceError} FORBIDDEN with reason `CONVERSATION_BLOCKED` when access is denied.
 *
 * @example
 * ```ts
 * checkCanViewConversation(actor, conversation, ['acc-uuid-1']);
 * ```
 */
export function checkCanViewConversation(
    actor: Actor,
    conversation: SelectConversation,
    ownerAccommodationIds: readonly string[]
): void {
    if (
        actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ALL) ||
        actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ANY)
    ) {
        return;
    }

    if (actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN)) {
        if (
            _isGuestParticipant(actor, conversation) ||
            _isOwnerParticipant(conversation, ownerAccommodationIds)
        ) {
            return;
        }
    }

    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to view this conversation',
        undefined,
        'CONVERSATION_NOT_FOUND'
    );
}

/**
 * Checks whether an actor can reply in the given conversation.
 *
 * Grant rules:
 * 1. Actor with `CONVERSATION_REPLY_ANY` → always allowed (admin support).
 * 2. Actor with `CONVERSATION_REPLY_OWN` who is a guest or owner participant → allowed.
 *
 * Additionally, the conversation status must allow replies (not CLOSED or BLOCKED).
 *
 * @param actor - Actor performing the request.
 * @param conversation - The conversation being replied to.
 * @param ownerAccommodationIds - Accommodation IDs owned by the actor.
 *
 * @throws {ServiceError} FORBIDDEN when access is denied.
 *
 * @example
 * ```ts
 * checkCanReplyConversation(actor, conversation, []);
 * ```
 */
export function checkCanReplyConversation(
    actor: Actor,
    conversation: SelectConversation,
    ownerAccommodationIds: readonly string[]
): void {
    // CLOSED is intentionally NOT blocked here: a guest message to a CLOSED
    // conversation auto-reopens it to PENDING_OWNER via the state machine in
    // MessageService.computeNextStatus (AC-003-06). Only BLOCKED is terminal.
    if (conversation.status === 'BLOCKED') {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Conversation is blocked',
            undefined,
            'CONVERSATION_BLOCKED'
        );
    }

    if (actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_ANY)) {
        return;
    }

    if (actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_OWN)) {
        if (
            _isGuestParticipant(actor, conversation) ||
            _isOwnerParticipant(conversation, ownerAccommodationIds)
        ) {
            return;
        }
    }

    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to reply in this conversation',
        undefined,
        'CONVERSATION_BLOCKED'
    );
}

/**
 * Checks whether an actor can update the status of the given conversation.
 *
 * Grant rules:
 * 1. Actor with `CONVERSATION_UPDATE_STATUS_ANY` → always allowed (admin moderation).
 * 2. Actor with `CONVERSATION_UPDATE_STATUS_OWN` who owns an accommodation in the conversation → allowed.
 *
 * @param actor - Actor performing the request.
 * @param conversation - The conversation whose status is being changed.
 * @param ownerAccommodationIds - Accommodation IDs owned by the actor.
 *
 * @throws {ServiceError} FORBIDDEN when access is denied.
 *
 * @example
 * ```ts
 * checkCanUpdateStatus(actor, conversation, ['acc-uuid-1']);
 * ```
 */
export function checkCanUpdateStatus(
    actor: Actor,
    conversation: SelectConversation,
    ownerAccommodationIds: readonly string[]
): void {
    if (actor.permissions.includes(PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY)) {
        return;
    }

    if (
        actor.permissions.includes(PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN) &&
        _isOwnerParticipant(conversation, ownerAccommodationIds)
    ) {
        return;
    }

    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to update conversation status',
        undefined,
        'CONVERSATION_BLOCKED'
    );
}

/**
 * Checks whether an actor can block the given conversation.
 *
 * Grant rules:
 * 1. Actor with `CONVERSATION_BLOCK_ANY` → always allowed (admin abuse prevention).
 * 2. Actor with `CONVERSATION_BLOCK_OWN` who owns an accommodation in the conversation → allowed.
 *
 * @param actor - Actor performing the request.
 * @param conversation - The conversation to block.
 * @param ownerAccommodationIds - Accommodation IDs owned by the actor.
 *
 * @throws {ServiceError} FORBIDDEN when access is denied.
 *
 * @example
 * ```ts
 * checkCanBlock(actor, conversation, ['acc-uuid-1']);
 * ```
 */
export function checkCanBlock(
    actor: Actor,
    conversation: SelectConversation,
    ownerAccommodationIds: readonly string[]
): void {
    if (actor.permissions.includes(PermissionEnum.CONVERSATION_BLOCK_ANY)) {
        return;
    }

    if (
        actor.permissions.includes(PermissionEnum.CONVERSATION_BLOCK_OWN) &&
        _isOwnerParticipant(conversation, ownerAccommodationIds)
    ) {
        return;
    }

    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to block this conversation',
        undefined,
        'CONVERSATION_BLOCKED'
    );
}

/**
 * Checks whether an actor can soft-delete the given conversation.
 *
 * Only admins/super-admins with `CONVERSATION_DELETE_ANY` may delete.
 * There is no self-service delete in MVP.
 *
 * @param actor - Actor performing the request.
 * @param _conversation - The conversation to delete (reserved for future checks).
 *
 * @throws {ServiceError} FORBIDDEN when access is denied.
 *
 * @example
 * ```ts
 * checkCanDelete(actor, conversation);
 * ```
 */
export function checkCanDelete(actor: Actor, _conversation: SelectConversation): void {
    if (actor.permissions.includes(PermissionEnum.CONVERSATION_DELETE_ANY)) {
        return;
    }

    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: CONVERSATION_DELETE_ANY required to delete conversations',
        undefined,
        'CONVERSATION_BLOCKED'
    );
}
