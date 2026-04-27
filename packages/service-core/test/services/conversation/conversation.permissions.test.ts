/**
 * @file conversation.permissions.test.ts
 *
 * Unit tests for the pure permission functions in conversation.permissions.ts.
 *
 * Coverage targets:
 * - checkCanViewConversation: VIEW_ALL, VIEW_ANY, VIEW_OWN (guest), VIEW_OWN (owner), forbidden
 * - checkCanReplyConversation: REPLY_ANY, REPLY_OWN (guest), REPLY_OWN (owner), CLOSED, BLOCKED, forbidden
 * - checkCanUpdateStatus: UPDATE_STATUS_ANY, UPDATE_STATUS_OWN (owner), forbidden (non-owner)
 * - checkCanBlock: BLOCK_ANY, BLOCK_OWN (owner), forbidden (non-owner)
 * - checkCanDelete: DELETE_ANY, forbidden (no permission)
 */

import type { SelectConversation } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanBlock,
    checkCanDelete,
    checkCanReplyConversation,
    checkCanUpdateStatus,
    checkCanViewConversation
} from '../../../src/services/conversation/conversation.permissions.js';
import { createActor } from '../../factories/actorFactory.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONVERSATION_ID = crypto.randomUUID();
const ACCOMMODATION_ID = crypto.randomUUID();
const USER_ID = crypto.randomUUID();
const OTHER_USER_ID = crypto.randomUUID();
const OTHER_ACCOMMODATION_ID = crypto.randomUUID();

function makeConversation(overrides: Partial<SelectConversation> = {}): SelectConversation {
    const now = new Date();
    return {
        id: CONVERSATION_ID,
        accommodationId: ACCOMMODATION_ID,
        userId: null,
        anonymousName: null,
        anonymousEmail: null,
        anonymousEmailVerified: false,
        anonymousPhone: null,
        status: 'OPEN' as SelectConversation['status'],
        blockReason: null,
        locale: 'es',
        archivedByGuest: false,
        archivedByOwner: false,
        lastReadAtByGuest: null,
        lastReadAtByOwner: null,
        firstGuestMessageAt: null,
        firstOwnerReplyAt: null,
        lastActivityAt: null,
        lastGuestMessageAt: null,
        lastOwnerMessageAt: null,
        closedAt: null,
        blockedAt: null,
        guestMessageCount: 0,
        ownerMessageCount: 0,
        createdAt: now,
        updatedAt: now,
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// checkCanViewConversation
// ---------------------------------------------------------------------------

describe('checkCanViewConversation', () => {
    describe('when actor has CONVERSATION_VIEW_ALL', () => {
        it('should allow access regardless of ownership', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.CONVERSATION_VIEW_ALL]
            });
            const conversation = makeConversation({ userId: USER_ID });

            // Act & Assert — must not throw
            expect(() => checkCanViewConversation(actor, conversation, [])).not.toThrow();
        });
    });

    describe('when actor has CONVERSATION_VIEW_ANY', () => {
        it('should allow access regardless of ownership', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.CONVERSATION_VIEW_ANY]
            });
            const conversation = makeConversation({ userId: USER_ID });

            // Act & Assert
            expect(() => checkCanViewConversation(actor, conversation, [])).not.toThrow();
        });
    });

    describe('when actor has CONVERSATION_VIEW_OWN as guest', () => {
        it('should allow access when userId matches actor.id', () => {
            // Arrange
            const actor = createActor({
                id: USER_ID,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CONVERSATION_VIEW_OWN]
            });
            const conversation = makeConversation({ userId: USER_ID });

            // Act & Assert
            expect(() => checkCanViewConversation(actor, conversation, [])).not.toThrow();
        });

        it('should deny access when userId does not match', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CONVERSATION_VIEW_OWN]
            });
            const conversation = makeConversation({ userId: USER_ID });

            // Act & Assert
            expect(() => checkCanViewConversation(actor, conversation, [])).toThrow();
        });
    });

    describe('when actor has CONVERSATION_VIEW_OWN as owner', () => {
        it('should allow access when accommodationId is in ownerAccommodationIds', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.CONVERSATION_VIEW_OWN]
            });
            const conversation = makeConversation({ accommodationId: ACCOMMODATION_ID });

            // Act & Assert
            expect(() =>
                checkCanViewConversation(actor, conversation, [ACCOMMODATION_ID])
            ).not.toThrow();
        });

        it('should deny access when accommodation is not in ownerAccommodationIds', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.CONVERSATION_VIEW_OWN]
            });
            const conversation = makeConversation({ accommodationId: ACCOMMODATION_ID });

            // Act & Assert
            expect(() =>
                checkCanViewConversation(actor, conversation, [OTHER_ACCOMMODATION_ID])
            ).toThrow();
        });
    });

    describe('when actor has no view permissions', () => {
        it('should throw FORBIDDEN with CONVERSATION_NOT_FOUND reason', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.USER,
                permissions: []
            });
            const conversation = makeConversation({ userId: USER_ID });

            // Act & Assert
            expect(() => checkCanViewConversation(actor, conversation, [])).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN', reason: 'CONVERSATION_NOT_FOUND' })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// checkCanReplyConversation
// ---------------------------------------------------------------------------

describe('checkCanReplyConversation', () => {
    describe('when conversation is CLOSED', () => {
        it('should NOT throw — CLOSED is intentionally permitted so that a guest message auto-reopens the conversation via the state machine in MessageService.computeNextStatus (AC-003-06). Only BLOCKED is terminal at the permission layer.', () => {
            // Arrange
            const actor = createActor({
                id: USER_ID,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
            });
            const conversation = makeConversation({
                status: 'CLOSED',
                userId: USER_ID
            });

            // Act & Assert — must NOT throw; state machine in MessageService handles transition.
            expect(() => checkCanReplyConversation(actor, conversation, [])).not.toThrow();
        });
    });

    describe('when conversation is BLOCKED', () => {
        it('should throw FORBIDDEN with CONVERSATION_BLOCKED reason', () => {
            // Arrange
            const actor = createActor({
                id: USER_ID,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.CONVERSATION_REPLY_ANY]
            });
            const conversation = makeConversation({ status: 'BLOCKED' });

            // Act & Assert
            expect(() => checkCanReplyConversation(actor, conversation, [])).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN', reason: 'CONVERSATION_BLOCKED' })
            );
        });
    });

    describe('when actor has CONVERSATION_REPLY_ANY', () => {
        it('should allow reply in OPEN conversation', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.CONVERSATION_REPLY_ANY]
            });
            const conversation = makeConversation({ status: 'OPEN' });

            // Act & Assert
            expect(() => checkCanReplyConversation(actor, conversation, [])).not.toThrow();
        });
    });

    describe('when actor has CONVERSATION_REPLY_OWN as guest participant', () => {
        it('should allow reply when userId matches', () => {
            // Arrange
            const actor = createActor({
                id: USER_ID,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
            });
            const conversation = makeConversation({ status: 'OPEN', userId: USER_ID });

            // Act & Assert
            expect(() => checkCanReplyConversation(actor, conversation, [])).not.toThrow();
        });
    });

    describe('when actor has CONVERSATION_REPLY_OWN as owner', () => {
        it('should allow reply when accommodationId is in ownerAccommodationIds', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
            });
            const conversation = makeConversation({
                status: 'OPEN',
                accommodationId: ACCOMMODATION_ID
            });

            // Act & Assert
            expect(() =>
                checkCanReplyConversation(actor, conversation, [ACCOMMODATION_ID])
            ).not.toThrow();
        });

        it('should deny reply when accommodation is not in ownerAccommodationIds', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
            });
            const conversation = makeConversation({
                status: 'OPEN',
                accommodationId: ACCOMMODATION_ID
            });

            // Act & Assert
            expect(() =>
                checkCanReplyConversation(actor, conversation, [OTHER_ACCOMMODATION_ID])
            ).toThrow();
        });
    });

    describe('when actor has no reply permissions', () => {
        it('should throw FORBIDDEN', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.USER,
                permissions: []
            });
            const conversation = makeConversation({ status: 'OPEN' });

            // Act & Assert
            expect(() => checkCanReplyConversation(actor, conversation, [])).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// checkCanUpdateStatus
// ---------------------------------------------------------------------------

describe('checkCanUpdateStatus', () => {
    describe('when actor has CONVERSATION_UPDATE_STATUS_ANY', () => {
        it('should allow update for any conversation', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY]
            });
            const conversation = makeConversation();

            // Act & Assert
            expect(() => checkCanUpdateStatus(actor, conversation, [])).not.toThrow();
        });
    });

    describe('when actor has CONVERSATION_UPDATE_STATUS_OWN', () => {
        it('should allow update when owner of the accommodation', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN]
            });
            const conversation = makeConversation({ accommodationId: ACCOMMODATION_ID });

            // Act & Assert
            expect(() =>
                checkCanUpdateStatus(actor, conversation, [ACCOMMODATION_ID])
            ).not.toThrow();
        });

        it('should throw FORBIDDEN when not owner of the accommodation', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN]
            });
            const conversation = makeConversation({ accommodationId: ACCOMMODATION_ID });

            // Act & Assert
            expect(() =>
                checkCanUpdateStatus(actor, conversation, [OTHER_ACCOMMODATION_ID])
            ).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
        });
    });

    describe('when actor has no update-status permissions', () => {
        it('should throw FORBIDDEN', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.USER,
                permissions: []
            });
            const conversation = makeConversation();

            // Act & Assert
            expect(() => checkCanUpdateStatus(actor, conversation, [ACCOMMODATION_ID])).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// checkCanBlock
// ---------------------------------------------------------------------------

describe('checkCanBlock', () => {
    describe('when actor has CONVERSATION_BLOCK_ANY', () => {
        it('should allow blocking any conversation', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.CONVERSATION_BLOCK_ANY]
            });
            const conversation = makeConversation();

            // Act & Assert
            expect(() => checkCanBlock(actor, conversation, [])).not.toThrow();
        });
    });

    describe('when actor has CONVERSATION_BLOCK_OWN', () => {
        it('should allow blocking when owner of the accommodation', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.CONVERSATION_BLOCK_OWN]
            });
            const conversation = makeConversation({ accommodationId: ACCOMMODATION_ID });

            // Act & Assert
            expect(() => checkCanBlock(actor, conversation, [ACCOMMODATION_ID])).not.toThrow();
        });

        it('should throw FORBIDDEN when not owner of the accommodation', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.CONVERSATION_BLOCK_OWN]
            });
            const conversation = makeConversation({ accommodationId: ACCOMMODATION_ID });

            // Act & Assert
            expect(() => checkCanBlock(actor, conversation, [OTHER_ACCOMMODATION_ID])).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' })
            );
        });
    });

    describe('when actor has no block permissions', () => {
        it('should throw FORBIDDEN', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.USER,
                permissions: []
            });
            const conversation = makeConversation();

            // Act & Assert
            expect(() => checkCanBlock(actor, conversation, [ACCOMMODATION_ID])).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// checkCanDelete
// ---------------------------------------------------------------------------

describe('checkCanDelete', () => {
    describe('when actor has CONVERSATION_DELETE_ANY', () => {
        it('should allow delete', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.CONVERSATION_DELETE_ANY]
            });
            const conversation = makeConversation();

            // Act & Assert
            expect(() => checkCanDelete(actor, conversation)).not.toThrow();
        });
    });

    describe('when actor lacks CONVERSATION_DELETE_ANY', () => {
        it('should throw FORBIDDEN even for the conversation owner', () => {
            // Arrange — guest who owns the conversation
            const actor = createActor({
                id: USER_ID,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
            });
            const conversation = makeConversation({ userId: USER_ID });

            // Act & Assert
            expect(() => checkCanDelete(actor, conversation)).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' })
            );
        });

        it('should throw FORBIDDEN for actor with no permissions', () => {
            // Arrange
            const actor = createActor({
                id: OTHER_USER_ID,
                role: RoleEnum.USER,
                permissions: []
            });
            const conversation = makeConversation();

            // Act & Assert
            expect(() => checkCanDelete(actor, conversation)).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' })
            );
        });
    });
});
