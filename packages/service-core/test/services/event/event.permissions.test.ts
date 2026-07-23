import { PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
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
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';

/**
 * Tests for EventService permission helpers.
 * Covers: permission checks, error throwing, edge cases.
 */
describe('EventService permissions', () => {
    const baseActor = createUser();
    const mockEvent = createMockEvent();

    it('should allow create if actor has EVENT_CREATE', () => {
        const actor = createUser({ permissions: [PermissionEnum.EVENT_CREATE] });
        expect(() => checkCanCreateEvent(actor)).not.toThrow();
    });
    it('should forbid create if actor lacks EVENT_CREATE', () => {
        expect(() => checkCanCreateEvent(baseActor)).toThrow();
    });

    it('should allow update if actor has EVENT_UPDATE', () => {
        const actor = createUser({ permissions: [PermissionEnum.EVENT_UPDATE] });
        expect(() => checkCanUpdateEvent(actor)).not.toThrow();
    });
    it('should forbid update if actor lacks EVENT_UPDATE', () => {
        expect(() => checkCanUpdateEvent(baseActor)).toThrow();
    });

    it('should allow delete if actor has EVENT_DELETE', () => {
        const actor = createUser({ permissions: [PermissionEnum.EVENT_DELETE] });
        expect(() => checkCanDeleteEvent(actor)).not.toThrow();
    });
    it('should forbid delete if actor lacks EVENT_DELETE', () => {
        expect(() => checkCanDeleteEvent(baseActor)).toThrow();
    });

    it('should allow view if actor has EVENT_VIEW', () => {
        const actor = createUser({ permissions: [PermissionEnum.EVENT_VIEW_PRIVATE] });
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
        const staffActor = createUser({ permissions: [PermissionEnum.EVENT_VIEW_ALL] });
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
        const staffActor = createUser({ permissions: [PermissionEnum.EVENT_VIEW_ALL] });
        expect(() => checkCanViewEvent(staffActor, deletedPrivateEvent)).not.toThrow();
    });

    it('should allow an actor with ONLY EVENT_VIEW_ALL to view a soft-deleted RESTRICTED event', () => {
        const deletedRestrictedEvent = createMockEvent({
            visibility: VisibilityEnum.RESTRICTED,
            deletedAt: new Date()
        });
        const staffActor = createUser({ permissions: [PermissionEnum.EVENT_VIEW_ALL] });
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
        const actor = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
        expect(() => checkCanListEvents(actor)).not.toThrow();
    });
    it('should allow list even if actor has no specific permissions', () => {
        expect(() => checkCanListEvents(baseActor)).not.toThrow();
    });

    it('should allow restore if actor has EVENT_RESTORE', () => {
        const actor = createUser({ permissions: [PermissionEnum.EVENT_RESTORE] });
        expect(() => checkCanRestoreEvent(actor)).not.toThrow();
    });
    it('should forbid restore if actor lacks EVENT_RESTORE', () => {
        expect(() => checkCanRestoreEvent(baseActor)).toThrow();
    });
});
