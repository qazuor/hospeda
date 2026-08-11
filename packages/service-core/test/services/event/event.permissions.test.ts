import type { UserIdType } from '@repo/schemas';
import {
    ModerationStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateEvent,
    checkCanDeleteEvent,
    checkCanListEvents,
    checkCanRestoreEvent,
    checkCanUpdateEvent,
    checkCanViewEvent
} from '../../../src/services/event/event.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createMockEvent } from '../../factories/eventFactory';
import { getMockId } from '../../factories/utilsFactory';

/**
 * Tests for EventService permission helpers.
 * Covers: permission checks, error throwing, edge cases.
 */
describe('EventService permissions', () => {
    const baseActor = createActor();
    const mockEvent = createMockEvent();

    it('should allow create if actor has EVENT_CREATE', () => {
        const actor = createActor({ permissions: [PermissionEnum.EVENT_CREATE] });
        expect(() => checkCanCreateEvent(actor)).not.toThrow();
    });
    it('should forbid create if actor lacks EVENT_CREATE', () => {
        expect(() => checkCanCreateEvent(baseActor)).toThrow();
    });

    it('should allow update if actor has EVENT_UPDATE', () => {
        const actor = createActor({ permissions: [PermissionEnum.EVENT_UPDATE] });
        expect(() => checkCanUpdateEvent(actor, mockEvent)).not.toThrow();
    });
    it('should forbid update if actor lacks EVENT_UPDATE', () => {
        expect(() => checkCanUpdateEvent(baseActor, mockEvent)).toThrow();
    });

    it('should allow delete if actor has EVENT_DELETE', () => {
        const actor = createActor({ permissions: [PermissionEnum.EVENT_DELETE] });
        expect(() => checkCanDeleteEvent(actor, mockEvent)).not.toThrow();
    });
    it('should forbid delete if actor lacks EVENT_DELETE', () => {
        expect(() => checkCanDeleteEvent(baseActor, mockEvent)).toThrow();
    });

    // HOS-374 §7.6.2/§7.6.3 — author-scoped ownership plus the state lock.
    // `checkCanUpdateEvent` now takes the event (it could not be author-scoped
    // without it) and mirrors its post twin exactly.
    describe('author-scoped ownership and the state lock', () => {
        const authorId = getMockId('user', 'event-author') as UserIdType;
        const strangerId = getMockId('user', 'event-stranger') as UserIdType;
        const pendingEvent = createMockEvent({
            authorId,
            moderationState: ModerationStatusEnum.PENDING
        });
        const approvedEvent = createMockEvent({
            authorId,
            moderationState: ModerationStatusEnum.APPROVED
        });

        it('should allow the author with EVENT_UPDATE_OWN while the event is not approved', () => {
            const author = createActor({
                id: authorId,
                permissions: [PermissionEnum.EVENT_UPDATE_OWN]
            });
            expect(() => checkCanUpdateEvent(author, pendingEvent)).not.toThrow();
        });

        it('should refuse the author with only EVENT_UPDATE_OWN once the event is APPROVED', () => {
            const author = createActor({
                id: authorId,
                permissions: [PermissionEnum.EVENT_UPDATE_OWN]
            });
            expect(() => checkCanUpdateEvent(author, approvedEvent)).toThrow(ServiceError);
        });

        it('should let a trusted author (EVENT_PUBLISH_OWN) edit their own APPROVED event', () => {
            const trustedAuthor = createActor({
                id: authorId,
                permissions: [PermissionEnum.EVENT_UPDATE_OWN, PermissionEnum.EVENT_PUBLISH_OWN]
            });
            expect(() => checkCanUpdateEvent(trustedAuthor, approvedEvent)).not.toThrow();
        });

        it('should allow an actor with EVENT_UPDATE to edit an APPROVED event they did not author', () => {
            const admin = createActor({
                id: strangerId,
                permissions: [PermissionEnum.EVENT_UPDATE]
            });
            expect(() => checkCanUpdateEvent(admin, approvedEvent)).not.toThrow();
        });

        it('should forbid a non-author holding EVENT_UPDATE_OWN', () => {
            const stranger = createActor({
                id: strangerId,
                permissions: [PermissionEnum.EVENT_UPDATE_OWN]
            });
            expect(() => checkCanUpdateEvent(stranger, pendingEvent)).toThrow(ServiceError);
        });

        it('should forbid the author with no update permission at all', () => {
            const author = createActor({ id: authorId, permissions: [] });
            expect(() => checkCanUpdateEvent(author, pendingEvent)).toThrow(ServiceError);
        });

        it('should allow the author with EVENT_DELETE_OWN to delete their own event', () => {
            const trustedAuthor = createActor({
                id: authorId,
                permissions: [PermissionEnum.EVENT_DELETE_OWN]
            });
            expect(() => checkCanDeleteEvent(trustedAuthor, approvedEvent)).not.toThrow();
        });

        it('should forbid the author holding only EVENT_UPDATE_OWN from deleting', () => {
            const author = createActor({
                id: authorId,
                permissions: [PermissionEnum.EVENT_UPDATE_OWN]
            });
            expect(() => checkCanDeleteEvent(author, pendingEvent)).toThrow(ServiceError);
        });

        it('should forbid a non-author holding EVENT_DELETE_OWN', () => {
            const stranger = createActor({
                id: strangerId,
                permissions: [PermissionEnum.EVENT_DELETE_OWN]
            });
            expect(() => checkCanDeleteEvent(stranger, pendingEvent)).toThrow(ServiceError);
        });
    });

    it('should allow view if actor has EVENT_VIEW', () => {
        const actor = createActor({ permissions: [PermissionEnum.EVENT_VIEW_PRIVATE] });
        expect(() => checkCanViewEvent(actor, mockEvent)).not.toThrow();
    });
    it('should forbid view if actor lacks EVENT_VIEW', () => {
        const privateEvent = createMockEvent({ visibility: VisibilityEnum.PRIVATE });
        expect(() => checkCanViewEvent(baseActor, privateEvent)).toThrow();
    });

    // HOS-117 T-022: soft-deleted events previously leaked a full 200
    // (checkCanViewEvent had no deletedAt guard at all). Now any actor without
    // EVENT_VIEW_ALL gets GONE (410, deindex) when the event was PUBLIC before
    // deletion; a deleted PRIVATE/DRAFT event stays NOT_FOUND (404, uniform) to
    // preserve the anti-enumeration contract (SPEC-092 T-087). Staff with
    // EVENT_VIEW_ALL are exempt so the admin panel can still manage it.
    it('should throw GONE for a soft-deleted PUBLIC event when actor lacks EVENT_VIEW_ALL', () => {
        const deletedEvent = createMockEvent({
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: new Date()
        });
        try {
            checkCanViewEvent(baseActor, deletedEvent);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.GONE);
            }
        }
    });

    it('should throw NOT_FOUND (not GONE) for a soft-deleted PRIVATE event — anti-enumeration (SPEC-092 T-087)', () => {
        const deletedPrivateEvent = createMockEvent({
            visibility: VisibilityEnum.PRIVATE,
            deletedAt: new Date()
        });
        try {
            checkCanViewEvent(baseActor, deletedPrivateEvent);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        }
    });

    it('should allow staff with EVENT_VIEW_ALL to view a soft-deleted event', () => {
        const deletedEvent = createMockEvent({
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: new Date()
        });
        const staffActor = createActor({ permissions: [PermissionEnum.EVENT_VIEW_ALL] });
        expect(() => checkCanViewEvent(staffActor, deletedEvent)).not.toThrow();
    });

    it('should throw NOT_FOUND for a soft-deleted RESTRICTED event — anti-enumeration', () => {
        const deletedRestrictedEvent = createMockEvent({
            visibility: VisibilityEnum.RESTRICTED,
            deletedAt: new Date()
        });
        try {
            checkCanViewEvent(baseActor, deletedRestrictedEvent);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        }
    });

    // HOS-117 T-022 follow-up: EVENT_VIEW_ALL alone (without the
    // EVENT_VIEW_PRIVATE/EVENT_VIEW_DRAFT companions the seed roles normally
    // bundle) must be enough to view a soft-deleted PRIVATE/RESTRICTED event —
    // the deletedAt exemption is self-sufficient and no longer falls through to a
    // FORBIDDEN in the downstream visibility block.
    it('should allow an actor with ONLY EVENT_VIEW_ALL to view a soft-deleted PRIVATE event', () => {
        const deletedPrivateEvent = createMockEvent({
            visibility: VisibilityEnum.PRIVATE,
            deletedAt: new Date()
        });
        const staffActor = createActor({ permissions: [PermissionEnum.EVENT_VIEW_ALL] });
        expect(() => checkCanViewEvent(staffActor, deletedPrivateEvent)).not.toThrow();
    });

    it('should allow an actor with ONLY EVENT_VIEW_ALL to view a soft-deleted RESTRICTED event', () => {
        const deletedRestrictedEvent = createMockEvent({
            visibility: VisibilityEnum.RESTRICTED,
            deletedAt: new Date()
        });
        const staffActor = createActor({ permissions: [PermissionEnum.EVENT_VIEW_ALL] });
        expect(() => checkCanViewEvent(staffActor, deletedRestrictedEvent)).not.toThrow();
    });

    it('should allow view for a live (non-deleted) PUBLIC event', () => {
        const liveEvent = createMockEvent({
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: undefined
        });
        expect(() => checkCanViewEvent(baseActor, liveEvent)).not.toThrow();
    });

    it('should allow list for any authenticated actor', () => {
        const actor = createActor({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
        expect(() => checkCanListEvents(actor)).not.toThrow();
    });
    it('should allow list even if actor has no specific permissions', () => {
        expect(() => checkCanListEvents(baseActor)).not.toThrow();
    });

    it('should allow restore if actor has EVENT_RESTORE', () => {
        const actor = createActor({ permissions: [PermissionEnum.EVENT_RESTORE] });
        expect(() => checkCanRestoreEvent(actor)).not.toThrow();
    });
    it('should forbid restore if actor lacks EVENT_RESTORE', () => {
        expect(() => checkCanRestoreEvent(baseActor)).toThrow();
    });
});

// HOS-374 §5.1.1/§7.6.5 — the single-row half of the public read floor.
// `checkCanViewEvent` used to consult only `deletedAt` and `visibility`, so a
// PENDING or ARCHIVED event with `visibility=PUBLIC` was fully readable by an
// anonymous actor through getById/getBySlug/getSummary. It is not anymore, but
// its author and the elevated view permissions still reach it.
//
// Every actor here carries an EXPLICIT id. `createActor()` and the event
// factory both default to `getMockId('user')`, so a default actor IS the
// author of a default event and would silently pass through the author bypass
// instead of exercising the floor.
describe('checkCanViewEvent — public read floor', () => {
    const authorId = getMockId('user', 'floor-author') as UserIdType;
    const strangerId = getMockId('user', 'floor-stranger') as UserIdType;
    const stranger = createActor({ id: strangerId, permissions: [] });

    const approvedEvent = createMockEvent({
        authorId,
        visibility: VisibilityEnum.PUBLIC,
        moderationState: ModerationStatusEnum.APPROVED
    });
    const pendingEvent = createMockEvent({
        authorId,
        visibility: VisibilityEnum.PUBLIC,
        moderationState: ModerationStatusEnum.PENDING
    });
    const rejectedEvent = createMockEvent({
        authorId,
        visibility: VisibilityEnum.PUBLIC,
        moderationState: ModerationStatusEnum.REJECTED
    });

    it('hides a PENDING event from a stranger even when its visibility is PUBLIC', () => {
        expect(pendingEvent.visibility).toBe(VisibilityEnum.PUBLIC);
        expect(() => checkCanViewEvent(stranger, pendingEvent)).toThrow(ServiceError);
    });

    it('answers NOT_FOUND, never FORBIDDEN — a 403 would confirm the event exists', () => {
        try {
            checkCanViewEvent(stranger, pendingEvent);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        }
    });

    it('hides a REJECTED event from a stranger', () => {
        expect(() => checkCanViewEvent(stranger, rejectedEvent)).toThrow(ServiceError);
    });

    it('lets the author read back their own PENDING event', () => {
        const author = createActor({ id: authorId, permissions: [] });
        expect(() => checkCanViewEvent(author, pendingEvent)).not.toThrow();
    });

    for (const permission of [
        PermissionEnum.EVENT_VIEW_ALL,
        PermissionEnum.EVENT_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_DRAFT
    ]) {
        it(`lets an actor holding ${permission} read a PENDING event`, () => {
            const privileged = createActor({ id: strangerId, permissions: [permission] });
            expect(() => checkCanViewEvent(privileged, pendingEvent)).not.toThrow();
        });
    }

    it('still serves an APPROVED, ACTIVE, PUBLIC event to a stranger', () => {
        // The floor must not swallow the normal case.
        expect(() => checkCanViewEvent(stranger, approvedEvent)).not.toThrow();
    });
});
