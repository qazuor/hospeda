import { PermissionEnum, VisibilityEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateEvent,
    checkCanDeleteEvent,
    checkCanListEvents,
    checkCanRestoreEvent,
    checkCanUpdateEvent,
    checkCanViewEvent
} from '../../../src/services/event/event.permissions';
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
