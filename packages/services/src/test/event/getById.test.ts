import { EventModel } from '@repo/db';
import type { EventId, UserId } from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockEvent } from '../mockData';

/**
 * Unit tests for event.service.getById
 *
 * Covers:
 * - Admin can view any event (active, archived, private, draft)
 * - Author can view their own private/draft event
 * - Normal user can only view public and active events
 * - User with EVENT_VIEW_PRIVATE can view private events
 * - User with EVENT_VIEW_DRAFT can view draft events
 * - Disabled user cannot view any event
 * - Nonexistent event returns null
 * - Public actor can only view public and active events
 */
describe('event.service.getById', () => {
    const baseEvent = getMockEvent({
        id: 'event-1' as EventId,
        authorId: 'user-1' as UserId
    });
    const admin = {
        id: 'admin-1',
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.EVENT_VIEW_PRIVATE, PermissionEnum.EVENT_VIEW_DRAFT],
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    const superAdmin = {
        id: 'superadmin-1',
        role: RoleEnum.SUPER_ADMIN,
        permissions: [],
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    const author = {
        id: 'user-1',
        role: RoleEnum.USER,
        permissions: [],
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    const normalUser = {
        id: 'user-2',
        role: RoleEnum.USER,
        permissions: [],
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    const privatePermUser = {
        id: 'user-3',
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_VIEW_PRIVATE],
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    const draftPermUser = {
        id: 'user-4',
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_VIEW_DRAFT],
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    const disabledUser = {
        id: 'user-5',
        role: RoleEnum.USER,
        permissions: [],
        lifecycleState: LifecycleStatusEnum.INACTIVE
    };
    const publicActor = { role: RoleEnum.GUEST };

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden');
        });
    });

    it('returns null if event does not exist', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(undefined);
        const result = await EventService.getById({ id: 'not-found' }, admin);
        expect(result.event).toBeNull();
    });

    it('admin can view any event (active, archived, private, draft)', async () => {
        for (const visibility of [
            VisibilityEnum.PUBLIC,
            VisibilityEnum.PRIVATE,
            VisibilityEnum.DRAFT
        ]) {
            for (const lifecycleState of [
                LifecycleStatusEnum.ACTIVE,
                LifecycleStatusEnum.ARCHIVED
            ]) {
                vi.spyOn(EventModel, 'getById').mockResolvedValue(
                    getMockEvent({
                        ...baseEvent,
                        visibility,
                        lifecycleState
                    })
                );
                const result = await EventService.getById({ id: 'event-1' }, admin);
                expect(result.event).not.toBeNull();
            }
        }
    });

    it('superadmin can view any event', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(
            getMockEvent({
                ...baseEvent,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            })
        );
        const result = await EventService.getById({ id: 'event-1' }, superAdmin);
        expect(result.event).not.toBeNull();
    });

    it('author can view their own private/draft event', async () => {
        for (const visibility of [VisibilityEnum.PRIVATE, VisibilityEnum.DRAFT]) {
            vi.spyOn(EventModel, 'getById').mockResolvedValue(
                getMockEvent({
                    ...baseEvent,
                    visibility,
                    authorId: author.id as UserId
                })
            );
            const result = await EventService.getById({ id: 'event-1' }, author);
            expect(result.event).not.toBeNull();
        }
    });

    it('normal user can only view public and active events', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(
            getMockEvent({
                ...baseEvent,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            })
        );
        const result = await EventService.getById({ id: 'event-1' }, normalUser);
        expect(result.event).not.toBeNull();

        // Should not see private/draft/archived
        for (const visibility of [VisibilityEnum.PRIVATE, VisibilityEnum.DRAFT]) {
            vi.spyOn(EventModel, 'getById').mockResolvedValue(
                getMockEvent({
                    ...baseEvent,
                    visibility
                })
            );
            const res = await EventService.getById({ id: 'event-1' }, normalUser);
            expect(res.event).toBeNull();
        }
        vi.spyOn(EventModel, 'getById').mockResolvedValue(
            getMockEvent({
                ...baseEvent,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            })
        );
        const res2 = await EventService.getById({ id: 'event-1' }, normalUser);
        expect(res2.event).toBeNull();
    });

    it('user with EVENT_VIEW_PRIVATE can view private events', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation((_actor, _perm) => {
            if (
                Array.isArray(privatePermUser.permissions) &&
                privatePermUser.permissions.includes(PermissionEnum.EVENT_VIEW_PRIVATE)
            )
                return true;
            throw new Error('Forbidden');
        });
        vi.spyOn(EventModel, 'getById').mockResolvedValue(
            getMockEvent({
                ...baseEvent,
                visibility: VisibilityEnum.PRIVATE
            })
        );
        const result = await EventService.getById({ id: 'event-1' }, privatePermUser);
        expect(result.event).not.toBeNull();
    });

    it('user with EVENT_VIEW_DRAFT can view draft events', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation((_actor, _perm) => {
            if (
                Array.isArray(draftPermUser.permissions) &&
                draftPermUser.permissions.includes(PermissionEnum.EVENT_VIEW_DRAFT)
            )
                return true;
            throw new Error('Forbidden');
        });
        vi.spyOn(EventModel, 'getById').mockResolvedValue(
            getMockEvent({
                ...baseEvent,
                visibility: VisibilityEnum.DRAFT
            })
        );
        const result = await EventService.getById({ id: 'event-1' }, draftPermUser);
        expect(result.event).not.toBeNull();
    });

    it('disabled user cannot view any event', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(getMockEvent({ ...baseEvent }));
        const result = await EventService.getById({ id: 'event-1' }, disabledUser);
        expect(result.event).toBeNull();
    });

    it('public actor can only view public and active events', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(
            getMockEvent({
                ...baseEvent,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            })
        );
        const result = await EventService.getById({ id: 'event-1' }, publicActor);
        expect(result.event).not.toBeNull();

        // Should not see private/draft/archived
        for (const visibility of [VisibilityEnum.PRIVATE, VisibilityEnum.DRAFT]) {
            vi.spyOn(EventModel, 'getById').mockResolvedValue(
                getMockEvent({
                    ...baseEvent,
                    visibility
                })
            );
            const res = await EventService.getById({ id: 'event-1' }, publicActor);
            expect(res.event).toBeNull();
        }
        vi.spyOn(EventModel, 'getById').mockResolvedValue(
            getMockEvent({
                ...baseEvent,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            })
        );
        const res2 = await EventService.getById({ id: 'event-1' }, publicActor);
        expect(res2.event).toBeNull();
    });
});
